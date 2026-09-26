import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_SECONDS, toWaveform } from "../lib/chat";
import { ApiError } from "../types";

export interface RecordedVoice {
  file: File;
  duration: number;
  waveform: number[];
}

type RecorderState = "idle" | "starting" | "recording";

/** Preferred first: Opus in WebM (Chrome, Firefox, Edge), then AAC in MP4 (Safari). */
const FORMATS = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
/** One loudness sample every this many milliseconds. */
const SAMPLE_MS = 80;
/** Bars in the live meter while recording. */
const LIVE_BARS = 36;

export const canRecordVoice =
  typeof window !== "undefined" &&
  typeof window.MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

function extensionFor(type: string): string {
  if (type.includes("mp4")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Records a voice note from the microphone, with a live loudness meter and a
 * waveform for the finished note. `onLimit` fires when the time limit is hit.
 */
export function useVoiceRecorder(onLimit: () => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<number | undefined>(undefined);
  const limitHandler = useRef(onLimit);
  limitHandler.current = onLimit;

  const release = useCallback(() => {
    window.clearInterval(ticker.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audio.current?.close().catch(() => {});
    audio.current = null;
    recorder.current = null;
    setState("idle");
    setElapsed(0);
    setLevels([]);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!canRecordVoice) throw new ApiError("UNKNOWN", 400, "recording not supported");
    setState("starting");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      setState("idle");
      const name = error instanceof DOMException ? error.name : "";
      throw new ApiError(name === "NotAllowedError" || name === "SecurityError" ? "MICROPHONE_BLOCKED" : "UNKNOWN", 403);
    }

    const type = FORMATS.find((format) => MediaRecorder.isTypeSupported(format)) ?? "";
    const next = type ? new MediaRecorder(media, { mimeType: type }) : new MediaRecorder(media);
    stream.current = media;
    recorder.current = next;
    chunks.current = [];
    samples.current = [];
    next.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };

    // A loudness meter: RMS of the waveform, sampled on a timer.
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(media).connect(analyser);
    audio.current = context;
    const buffer = new Uint8Array(analyser.fftSize);

    startedAt.current = performance.now();
    next.start(250);
    setState("recording");

    ticker.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const value of buffer) sum += ((value - 128) / 128) ** 2;
      const level = Math.sqrt(sum / buffer.length);
      samples.current.push(level);
      setLevels((current) => [...current.slice(-(LIVE_BARS - 1)), Math.min(1, level * 4)]);

      const seconds = (performance.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_VOICE_SECONDS) limitHandler.current();
    }, SAMPLE_MS);
  }, [state]);

  /** Stops and hands back the finished note, or null if nothing was captured. */
  const stop = useCallback(async (): Promise<RecordedVoice | null> => {
    const active = recorder.current;
    if (!active) return null;
    const duration = Math.min(MAX_VOICE_SECONDS, (performance.now() - startedAt.current) / 1000);
    const type = active.mimeType || "audio/webm";

    const blob = await new Promise<Blob>((resolve) => {
      active.onstop = () => resolve(new Blob(chunks.current, { type }));
      if (active.state === "inactive") resolve(new Blob(chunks.current, { type }));
      else active.stop();
    });
    const waveform = toWaveform(samples.current);
    release();

    if (!blob.size || duration < 0.5) return null;
    const file = new File([blob], `voice-message.${extensionFor(type)}`, { type });
    return { file, duration, waveform };
  }, [release]);

  const cancel = useCallback(() => {
    const active = recorder.current;
    if (active && active.state !== "inactive") {
      active.onstop = null;
      active.stop();
    }
    release();
  }, [release]);

  return { state, elapsed, levels, start, stop, cancel };
}
