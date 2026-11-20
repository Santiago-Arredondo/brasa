import { html, plural, render } from '../core/dom.js';
import { createFeedback } from '../core/feedback.js';
import { emberSVG } from '../components/ember.js';
import { exerciseFigure } from '../components/figure.js';
import { FEELINGS } from '../data/options.js';
import { getWorkoutType } from '../data/workout-types.js';
import { toISODate } from '../domain/dates.js';
import { emberHeat, emberLevel } from '../domain/ember.js';
import { computeStreaks } from '../domain/streak.js';
import { createSequenceTimer } from '../domain/timer.js';
import { generateWorkout } from '../domain/workout.js';

const PREP_SECONDS = 5;
const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function workoutView({ store, navigate, params }) {
  const mode = params.modo === 'minimo' ? 'minimo' : 'full';
  const today = toISODate();
  const workout = generateWorkout({ profile: store.getState().profile, date: today, type: params.tipo, mode });
  const workoutType = getWorkoutType(workout.type);
  const phaseLabel = { prep: 'Prepárate', work: '¡Dale!', rest: workoutType.restLabel ?? 'Respira' };
  const steps = [{ kind: 'prep', seconds: PREP_SECONDS, next: workout.steps[0].exercise }, ...workout.steps];

  // Número de ejercicio (1..N) para cada paso, y siguiente paso de trabajo.
  const totalWork = workout.steps.filter((s) => s.kind === 'work').length;
  let counter = 0;
  const workNumber = steps.map((s) => (s.kind === 'work' ? ++counter : counter));
  const nextWorkAfter = (i) => steps.slice(i + 1).find((s) => s.kind === 'work');

  const feedback = createFeedback();
  let root;
  let refs = {};
  let lastBeepSecond = null;
  let resumeAfterDialog = false;
  let sessionId = null;

  const timer = createSequenceTimer({
    steps,
    onStep: handleStep,
    onTick: handleTick,
    onDone: handleDone,
  });

  /** Contenido de cada paso. `exercise` es el que se muestra en la figura. */
  function describeStep(step, index) {
    if (step.kind === 'prep') {
      return { exercise: step.next, preview: true, name: step.next.name, cue: step.next.cue, next: 'Mira la figura y prepárate' };
    }
    if (step.kind === 'rest') {
      return { exercise: step.next, preview: true, name: phaseLabel.rest, cue: `Lo siguiente: ${step.next.name}`, next: '' };
    }
    const upcoming = nextWorkAfter(index);
    return {
      exercise: step.exercise,
      preview: false,
      name: step.exercise.name,
      cue: step.exercise.cue,
      next: upcoming ? `Sigue: ${upcoming.exercise.name}` : 'Último. ¡Todo lo que tengas!',
    };
  }

  /* ---------- Pantallas ---------- */

  function renderIntro() {
    const isMinimo = mode === 'minimo';
    const timingText =
      workout.rest > 0
        ? `${workout.work}s de trabajo · ${workout.rest}s de ${phaseLabel.rest.toLowerCase()} · ${plural(totalWork, 'bloque', 'bloques')}`
        : `${plural(totalWork, 'bloque', 'bloques')} de ${workout.work}s sin pausa`;

    render(
      root,
      html`
        <section class="intro" aria-labelledby="intro-title">
          <div class="player__top">
            <a class="btn btn--ghost btn--icon" href="#/hoy" aria-label="Volver">←</a>
            <span class="eyebrow">${workoutType.icon} ${workoutType.name}${isMinimo ? ' · Modo mínimo' : ''}</span>
            <span style="width:48px"></span>
          </div>
          <header class="stack">
            <h1 id="intro-title">${isMinimo ? 'Solo 2 minutos. Nada más.' : `${workout.minutes} minutos para ti`}</h1>
            <p class="muted">
              ${isMinimo ? 'En un día difícil, 2 minutos cuentan. Lo que importa es no romper la cadena.' : timingText}
            </p>
          </header>
          <ol class="intro__list">
            ${workout.exercises.map(
              (ex) => html`<li>
                <span class="intro__figure">${exerciseFigure(ex, { size: 'md' })}</span>
                <span><strong>${ex.name}</strong><small>${ex.cue}</small></span>
              </li>`,
            )}
          </ol>
          <button type="button" class="btn btn--primary btn--lg btn--block" data-action="start">Empezar</button>
        </section>
      `,
    );
    root.querySelector('#intro-title').setAttribute('tabindex', '-1');
  }

  function renderPlayer() {
    render(
      root,
      html`
        <section class="player" data-phase="prep" aria-label="Entrenamiento en curso">
          <div class="player__top">
            <button type="button" class="btn btn--ghost btn--icon" data-action="quit" aria-label="Salir del entrenamiento">
              ✕
            </button>
            <span class="eyebrow" data-ref="counter"></span>
            <button type="button" class="btn btn--ghost btn--icon" data-action="sound" aria-pressed="false" aria-label="Silenciar sonido">
              🔊
            </button>
          </div>

          <p class="player__phase" data-ref="phase"></p>

          <div class="ring">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle class="ring__track" cx="100" cy="100" r="${RING_RADIUS}" fill="none" stroke-width="8" />
              <circle
                class="ring__bar"
                data-ref="bar"
                cx="100"
                cy="100"
                r="${RING_RADIUS}"
                fill="none"
                stroke-width="8"
                stroke-dasharray="${RING_CIRCUMFERENCE}"
                stroke-dashoffset="${RING_CIRCUMFERENCE}"
              />
            </svg>
            <div class="ring__center">
              <div class="ring__figure" data-ref="figure"></div>
              <span class="ring__time" data-ref="time" aria-hidden="true"></span>
            </div>
          </div>

          <div class="stack">
            <h1 class="player__name" data-ref="name"></h1>
            <p class="player__cue" data-ref="cue"></p>
            <p class="player__next" data-ref="next"></p>
          </div>

          <p class="visually-hidden" aria-live="assertive" data-ref="announcer"></p>

          <div class="player__controls">
            <span></span>
            <button type="button" class="btn btn--primary btn--lg" data-action="toggle" data-ref="toggle">Pausa</button>
            <button type="button" class="btn btn--secondary" data-action="skip">Saltar</button>
          </div>

          <dialog class="dialog" data-ref="dialog" aria-labelledby="quit-title">
            <form method="dialog">
              <h2 id="quit-title">¿Seguro que quieres salir?</h2>
              <p class="muted" style="margin-top:var(--sp-2)">
                Si sales ahora, esta sesión no cuenta. ¿Y si terminas aunque sea más lento?
              </p>
              <div class="dialog__actions">
                <button class="btn btn--primary" value="stay" autofocus>Sigo entrenando</button>
                <button class="btn btn--ghost" value="quit">Salir</button>
              </div>
            </form>
          </dialog>
        </section>
      `,
    );

    refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]));
    refs.dialog.addEventListener('close', onDialogClose);
  }

  function renderDone() {
    const { sessions } = store.getState();
    const heat = emberHeat(sessions, today);
    const level = emberLevel(heat);
    const { current } = computeStreaks(sessions, today);

    render(
      root,
      html`
        <section class="done" aria-labelledby="done-title">
          ${emberSVG(heat, { label: `Tu brasa ahora está en nivel ${level.name}` })}
          <div class="stack">
            <p class="eyebrow">Misión cumplida</p>
            <h1 id="done-title">¡Brasa alimentada!</h1>
            <p class="muted">
              ${mode === 'minimo'
                ? 'Dos minutos que valen oro: hoy no rompiste la cadena.'
                : 'Cada sesión suma calor. Así se construye la disciplina.'}
            </p>
          </div>
          <dl class="stats stats--3">
            <div class="stat"><dt>Minutos</dt><dd>${workout.minutes}</dd></div>
            <div class="stat"><dt>Racha</dt><dd>${current}</dd></div>
            <div class="stat"><dt>Nivel</dt><dd style="font-size:var(--fs-md)">${level.name}</dd></div>
          </dl>
          <fieldset class="feelings">
            <legend>¿Cómo te sentiste?</legend>
            ${FEELINGS.map(
              (f) => html`<button type="button" class="btn btn--secondary" data-feeling="${f.id}" aria-pressed="false">
                ${f.label}
              </button>`,
            )}
          </fieldset>
          <a class="btn btn--primary btn--lg btn--block" href="#/hoy">Volver a mi brasa</a>
        </section>
      `,
    );

    const title = root.querySelector('#done-title');
    title.setAttribute('tabindex', '-1');
    title.focus();
  }

  /* ---------- Callbacks del temporizador ---------- */

  function handleStep(snap) {
    const { step, index } = snap;
    const content = describeStep(step, index);

    root.querySelector('.player').dataset.phase = step.kind;
    refs.phase.textContent = phaseLabel[step.kind];
    refs.name.textContent = content.name;
    refs.cue.textContent = content.cue;
    refs.next.textContent = content.next;
    refs.counter.textContent = `Ejercicio ${Math.max(1, workNumber[index])} de ${totalWork}`;
    refs.announcer.textContent = `${phaseLabel[step.kind]}. ${content.name}. ${step.seconds} segundos.`;
    render(refs.figure, exerciseFigure(content.exercise, { size: 'lg' }));
    refs.figure.classList.toggle('is-preview', content.preview);

    lastBeepSecond = null;
    if (index > 0) {
      feedback.beep(step.kind === 'work' ? 880 : 520, 0.25);
      feedback.vibrate(step.kind === 'work' ? [80, 40, 80] : 120);
    }
    handleTick(snap);
  }

  function handleTick(snap) {
    const seconds = Math.ceil(snap.remainingMs / 1000);
    refs.time.textContent = seconds;
    refs.bar.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - snap.progress);
    refs.toggle.textContent = snap.running ? 'Pausa' : 'Seguir';

    if (snap.running && seconds <= 3 && seconds > 0 && seconds !== lastBeepSecond) {
      lastBeepSecond = seconds;
      feedback.beep(660, 0.08);
    }
  }

  function handleDone() {
    feedback.beep(1046, 0.4);
    feedback.vibrate([100, 50, 100, 50, 200]);
    sessionId = store.actions.logSession({ date: today, type: workout.type, mode, minutes: workout.minutes });
    renderDone();
  }

  /* ---------- Interacción ---------- */

  function togglePause() {
    if (timer.isRunning()) timer.pause();
    else timer.resume();
  }

  function openQuitDialog() {
    resumeAfterDialog = timer.isRunning();
    timer.pause();
    refs.dialog.showModal();
  }

  function onDialogClose() {
    if (refs.dialog.returnValue === 'quit') {
      timer.stop();
      navigate('/hoy');
    } else if (resumeAfterDialog) {
      timer.resume();
    }
  }

  function onClick(event) {
    const feelingButton = event.target.closest('[data-feeling]');
    if (feelingButton) {
      store.actions.rateSession(sessionId, feelingButton.dataset.feeling);
      root.querySelectorAll('[data-feeling]').forEach((b) => b.setAttribute('aria-pressed', String(b === feelingButton)));
      return;
    }

    const button = event.target.closest('[data-action]');
    switch (button?.dataset.action) {
      case 'start':
        feedback.unlock();
        renderPlayer();
        timer.start();
        break;
      case 'toggle':
        togglePause();
        break;
      case 'skip':
        timer.skip();
        break;
      case 'quit':
        openQuitDialog();
        break;
      case 'sound': {
        const muted = feedback.toggleMute();
        button.textContent = muted ? '🔇' : '🔊';
        button.setAttribute('aria-pressed', String(muted));
        button.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
        break;
      }
      default:
    }
  }

  function onKeyDown(event) {
    if (event.code !== 'Space' || !refs.toggle?.isConnected || refs.dialog?.open) return;
    if (event.target.closest('button, a')) return; // deja que el botón enfocado actúe normalmente
    event.preventDefault();
    togglePause();
  }

  return {
    mount(el) {
      root = el;
      root.addEventListener('click', onClick);
      document.addEventListener('keydown', onKeyDown);
      renderIntro();
    },
    destroy() {
      timer.stop();
      feedback.dispose();
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    },
  };
}
