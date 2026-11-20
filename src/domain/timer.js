/**
 * Temporizador de secuencia de pasos (prep → trabajo → descanso → ...).
 * Calcula el tiempo con marcas absolutas (no cuenta ticks), así no se desfasa
 * si el navegador ralentiza la pestaña. Reloj y scheduler inyectables para tests.
 */
export function createSequenceTimer({
  steps,
  onStep,
  onTick,
  onDone,
  now = () => performance.now(),
  schedule = (fn, ms) => setInterval(fn, ms),
  cancel = (id) => clearInterval(id),
  tickMs = 200,
}) {
  let index = 0;
  let stepStartedAt = 0;
  let elapsedBefore = 0;
  let running = false;
  let finished = false;
  let intervalId = null;

  const durationMs = () => steps[index].seconds * 1000;
  const elapsed = () => elapsedBefore + (running ? now() - stepStartedAt : 0);
  const remainingMs = () => Math.max(0, durationMs() - elapsed());

  function snapshot() {
    const remaining = remainingMs();
    return {
      index,
      step: steps[index],
      remainingMs: remaining,
      progress: 1 - remaining / durationMs(),
      running,
      finished,
    };
  }

  function startTicking() {
    stopTicking();
    intervalId = schedule(tick, tickMs);
  }

  function stopTicking() {
    if (intervalId !== null) cancel(intervalId);
    intervalId = null;
  }

  function goTo(nextIndex) {
    if (nextIndex >= steps.length) {
      finished = true;
      running = false;
      stopTicking();
      onDone?.();
      return;
    }
    index = nextIndex;
    elapsedBefore = 0;
    stepStartedAt = now();
    onStep?.(snapshot());
  }

  function tick() {
    if (!running || finished) return;
    if (remainingMs() <= 0) goTo(index + 1);
    if (!finished) onTick?.(snapshot());
  }

  return {
    start() {
      if (running || finished) return;
      running = true;
      goTo(0);
      startTicking();
    },
    pause() {
      if (!running) return;
      elapsedBefore += now() - stepStartedAt;
      running = false;
      stopTicking();
      onTick?.(snapshot());
    },
    resume() {
      if (running || finished) return;
      running = true;
      stepStartedAt = now();
      startTicking();
      onTick?.(snapshot());
    },
    skip() {
      if (finished) return;
      goTo(index + 1);
    },
    stop() {
      running = false;
      stopTicking();
    },
    tick,
    isRunning: () => running,
    getSnapshot: snapshot,
  };
}
