/**
 * Feedback sensorial del entrenamiento: pitidos (Web Audio) y vibración.
 * El AudioContext se crea tras un gesto del usuario (política de autoplay de los navegadores).
 */
export function createFeedback() {
  let ctx = null;
  let muted = false;

  function unlock() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      ctx = new AudioCtx();
    } catch {
      ctx = null;
    }
  }

  function beep(frequency = 880, duration = 0.12) {
    if (muted || !ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function vibrate(pattern) {
    if (!muted) navigator.vibrate?.(pattern);
  }

  return {
    unlock,
    beep,
    vibrate,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted: () => muted,
    dispose() {
      ctx?.close?.();
      ctx = null;
    },
  };
}
