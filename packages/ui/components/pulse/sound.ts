/**
 * Pulse sound — tiny synthetic chime per variant, via the Web Audio API.
 *
 * Ported from caring_data_react (src/caringdata-ui/Pulse/sound.ts). Keep both copies in sync.
 *
 * No audio assets: each cue is a short two-note blip generated in code. Opt-in
 * per toast with `sound: true` (default off). If the browser blocks audio,
 * playback is skipped silently — sound must never break a toast.
 */

type PulseSoundVariant = 'success' | 'error' | 'warning' | 'info' | 'action';

/** Two-note cue per variant: [first Hz, second Hz]. Rising = good, falling = bad. */
const VARIANT_NOTES: Record<PulseSoundVariant, [number, number]> = {
  success: [660, 880],
  error: [440, 330],
  warning: [560, 560],
  info: [620, 740],
  action: [600, 800],
};

let audioCtx: AudioContext | null = null;

/** Lazily create (and reuse) a single AudioContext. Returns null if unsupported. */
const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (audioCtx) {
    return audioCtx;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  try {
    audioCtx = new AudioContextConstructor();
  } catch {
    return null;
  }

  return audioCtx;
};

/** Play one short note on the shared context, fading out to avoid a click. */
const playNote = (ctx: AudioContext, freq: number, startAt: number, duration: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration);
};

/**
 * Play the cue for a variant. No-op (never throws) if audio is unsupported,
 * blocked, or the context can't be resumed — sound is decorative.
 */
export const playPulseSound = (variant: PulseSoundVariant) => {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  try {
    const [firstNote, secondNote] = VARIANT_NOTES[variant];
    const now = ctx.currentTime;

    playNote(ctx, firstNote, now, 0.12);
    playNote(ctx, secondNote, now + 0.1, 0.16);
  } catch {
    // Ignore — a missing chime must never break a toast.
  }
};
