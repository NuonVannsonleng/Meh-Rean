import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChatMediaUrl } from "../../hooks/useChatMediaUrl";
import { t } from "../../i18n/en";
import { formatDuration, toWaveform } from "../../lib/chat";
import type { MessageAttachment } from "../../types";

/** Only one voice note plays at a time, across every open thread. */
const PLAY_EVENT = "meh-rean:voice-play";
const SPEEDS = [1, 1.5, 2];

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor" aria-hidden="true">
      {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.8l-10-6.5A1 1 0 0 0 8 5.5z" />}
    </svg>
  );
}

export default function VoicePlayer({ attachment, mine }: { attachment: MessageAttachment; mine: boolean }) {
  const { url, failed } = useChatMediaUrl(attachment);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const waveform = attachment.waveform?.length ? attachment.waveform : toWaveform([]);
  // Recorded WebM often reports an infinite duration, so the stored one wins.
  const duration = attachment.duration && attachment.duration > 0 ? attachment.duration : 0;
  const progress = duration ? Math.min(1, position / duration) : 0;

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<HTMLAudioElement>).detail !== audio.current) audio.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  const toggle = async () => {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: element }));
    element.playbackRate = speed;
    try {
      await element.play();
    } catch {
      setPlaying(false);
    }
  };

  const seekTo = (ratio: number) => {
    const element = audio.current;
    if (!element || !duration) return;
    const time = Math.max(0, Math.min(duration, ratio * duration));
    element.currentTime = time;
    setPosition(time);
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    seekTo((event.clientX - box.left) / box.width);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 5 : -5;
      seekTo((position + step) / (duration || 1));
    }
  };

  const played = mine ? "bg-white" : "bg-accent";
  const unplayed = mine ? "bg-white/40" : "bg-ink-400/45";

  return (
    <div className="flex w-[min(15.5rem,62vw)] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void toggle();
        }}
        disabled={!url}
        aria-label={playing ? t.messages.pause : t.messages.play}
        className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${
          mine ? "text-brand-700 bg-white" : "bg-brand-600 text-white"
        }`}
      >
        <PlayIcon playing={playing} />
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label={t.messages.voiceMessage}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${formatDuration(position)} / ${formatDuration(duration)}`}
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointer(event);
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onKey}
          className="flex h-7 cursor-pointer items-center gap-[2px] rounded outline-offset-2"
        >
          {waveform.map((value, index) => (
            <span
              key={index}
              className={`w-[3px] flex-1 rounded-full transition-colors ${
                (index + 0.5) / waveform.length <= progress ? played : unplayed
              }`}
              style={{ height: `${Math.max(12, value)}%` }}
            />
          ))}
        </div>
        <div className={`mt-0.5 flex items-center justify-between text-[11px] tabular-nums ${mine ? "text-white/80" : "text-ink-500"}`}>
          <span>{failed ? t.messages.fileUnavailable : formatDuration(playing || position ? position : duration)}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length]);
            }}
            aria-label={t.messages.playbackSpeed(speed)}
            className={`press rounded-full px-1.5 font-semibold ${mine ? "bg-white/20" : "bg-surface"}`}
          >
            {speed}×
          </button>
        </div>
      </div>

      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setPosition(0);
          }}
          className="hidden"
        />
      )}
    </div>
  );
}
