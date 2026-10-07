/**
 * In-app notification pop sound (Web Audio API, no asset file).
 * Browsers require a user gesture before audio can play — call `unlockNotificationAudio`
 * on first interaction (handled automatically via global listeners below).
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/** Call after user gesture so later `playNotificationSound` is allowed. */
export function unlockNotificationAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {
      /* ignore */
    });
  }
}

/** Pleasant two-tone pop (~350ms). */
export function playNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const run = (): void => {
    const t = ctx.currentTime;

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gain = ctx.createGain();

    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(880, t);
    oscB.frequency.setValueAtTime(1174.66, t + 0.09);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(t);
    oscA.stop(t + 0.14);
    oscB.start(t + 0.09);
    oscB.stop(t + 0.38);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => {
      /* blocked until user interacts */
    });
    return;
  }
  run();
}

function installGestureUnlock(): void {
  if (typeof window === 'undefined') return;

  const unlock = (): void => {
    unlockNotificationAudio();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
}

installGestureUnlock();
