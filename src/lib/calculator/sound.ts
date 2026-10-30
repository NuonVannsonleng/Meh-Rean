// Key clicks for the calculator, made with the Web Audio API (no sound files
// to download): a short burst of filtered noise for the plastic key and a soft
// tick under it. Number keys sound a little lower, = a little fuller.

export type ClickKind = "num" | "fn" | "equals";

let audio: AudioContext | null = null;

export function playClick(kind: ClickKind): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;

    const length = Math.floor(audio.sampleRate * 0.03);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;
    const noise = audio.createBufferSource();
    noise.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = kind === "num" ? 2200 : 3200;
    filter.Q.value = 1.2;
    const noiseGain = audio.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(filter).connect(noiseGain).connect(audio.destination);
    noise.start(now);

    const tick = audio.createOscillator();
    tick.type = "sine";
    tick.frequency.setValueAtTime(kind === "equals" ? 660 : kind === "num" ? 420 : 520, now);
    const tickGain = audio.createGain();
    const length2 = kind === "equals" ? 0.09 : 0.05;
    tickGain.gain.setValueAtTime(0.12, now);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + length2);
    tick.connect(tickGain).connect(audio.destination);
    tick.start(now);
    tick.stop(now + length2 + 0.02);

    // A tiny buzz on phones that support it (Android).
    navigator.vibrate?.(6);
  } catch {
    // No sound is fine.
  }
}
