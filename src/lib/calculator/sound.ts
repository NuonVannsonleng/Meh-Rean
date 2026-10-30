// Key sounds for the calculator, like a clicky mechanical keyboard switch,
// made with the Web Audio API (no sound files to download). Each press is two
// bursts of filtered noise: the sharp, high "click" of the switch snapping, then
// a lower "thock" as the key bottoms out a moment later. No tones, so it never
// sounds like a beep. Each press varies a little, as real keys do.

export type ClickKind = "num" | "fn" | "equals";

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Half a second of white noise, made once and reused. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** One burst of noise through a filter, with a fast attack and an exponential fall. */
function burst(ctx: AudioContext, at: number, seconds: number, filter: BiquadFilterType, frequency: number, q: number, peak: number) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const shape = ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.value = frequency;
  shape.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  source.connect(shape).connect(gain).connect(ctx.destination);
  source.start(at, Math.random() * 0.4);
  source.stop(at + seconds + 0.01);
}

export function playClick(kind: ClickKind): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime + 0.002;
    const vary = () => 0.92 + Math.random() * 0.16;
    const big = kind === "equals";
    // The click: short and bright.
    burst(audio, now, 0.012, "highpass", 3800 * vary(), 0.7, 0.5 * vary());
    // The bottom-out: a little later, lower and rounder; bigger keys sound deeper.
    burst(audio, now + 0.009, big ? 0.045 : 0.03, "bandpass", (big ? 650 : kind === "num" ? 1000 : 1250) * vary(), 0.9, (big ? 0.42 : 0.3) * vary());
    // A tiny buzz on phones that support it (Android).
    navigator.vibrate?.(5);
  } catch {
    // No sound is fine.
  }
}
