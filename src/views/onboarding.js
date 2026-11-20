import { html, render } from '../core/dom.js';
import { GOALS, LEVELS, MINUTE_OPTIONS, WHY_SUGGESTIONS } from '../data/options.js';

const HOLD_MS = 1600;
const NAME_MAX = 30;
const WHY_MIN = 10;
const WHY_MAX = 200;

const STEPS = [
  { id: 'name', isValid: (d) => d.name.trim().length >= 2 },
  { id: 'goal', isValid: (d) => GOALS.some((g) => g.id === d.goal) },
  { id: 'level', isValid: (d) => LEVELS.some((l) => l.id === d.level) },
  { id: 'minutes', isValid: (d) => MINUTE_OPTIONS.includes(d.minutes) },
  { id: 'why', isValid: (d) => d.why.trim().length >= WHY_MIN },
  { id: 'sign', isValid: () => true },
];

const NUMERIC_FIELDS = new Set(['level', 'minutes']);

/** El Pacto: onboarding en pasos que termina en un compromiso firmado. */
export function onboardingView({ store, sync, navigate }) {
  const existing = store.getState().profile;
  const draft = {
    name: existing?.name ?? '',
    goal: existing?.goal ?? '',
    level: existing?.level ?? 0,
    minutes: existing?.minutes ?? 10,
    why: existing?.why ?? '',
  };

  let root;
  let stepIndex = 0;
  let holdTimer = null;
  let redirectTimer = null;
  let signed = false;

  const step = () => STEPS[stepIndex];

  /* ---------- Plantillas por paso ---------- */

  const radioOptions = (name, items, selected) =>
    items.map(
      (item) => html`
        <label class="option">
          <input type="radio" name="${name}" value="${item.id}" ${item.id === selected ? 'checked' : ''} />
          <span class="option__body">
            <span class="option__title">${item.title}</span>
            <span class="option__desc">${item.description}</span>
          </span>
        </label>
      `,
    );

  const templates = {
    name: () => html`
      <h1 class="onboarding__title" id="step-title">Esta vez <em>no</em> vas a parar.</h1>
      <p class="muted">
        Aquí no empezamos con un plan perfecto. Empezamos con un pacto contigo. Te toma un minuto.
      </p>
      <div class="field">
        <label class="field__label" for="name">¿Cómo te llamamos?</label>
        <input
          class="input"
          id="name"
          name="name"
          autocomplete="given-name"
          maxlength="${NAME_MAX}"
          value="${draft.name}"
          required
        />
      </div>
    `,
    goal: () => html`
      <h1 class="onboarding__title" id="step-title">¿Qué quieres lograr, ${draft.name.trim()}?</h1>
      <fieldset class="options">
        <legend class="visually-hidden">Tu meta</legend>
        ${radioOptions('goal', GOALS, draft.goal)}
      </fieldset>
    `,
    level: () => html`
      <h1 class="onboarding__title" id="step-title">¿Dónde estás hoy?</h1>
      <p class="muted">Sin juicios. Todo se ajusta a ti.</p>
      <fieldset class="options">
        <legend class="visually-hidden">Tu nivel</legend>
        ${radioOptions('level', LEVELS, draft.level)}
      </fieldset>
    `,
    minutes: () => html`
      <h1 class="onboarding__title" id="step-title">¿Cuánto tiempo puedes darte, <em>incluso en un mal día</em>?</h1>
      <fieldset class="options options--minutes">
        <legend class="visually-hidden">Minutos por día</legend>
        ${MINUTE_OPTIONS.map(
          (m) => html`
            <label class="option option--compact">
              <input type="radio" name="minutes" value="${m}" ${m === draft.minutes ? 'checked' : ''} />
              <span class="option__body">${m}<span class="option__desc">min</span></span>
            </label>
          `,
        )}
      </fieldset>
      <p class="muted">
        Elige lo que puedas cumplir <strong>siempre</strong>. La constancia le gana a la intensidad.
      </p>
    `,
    why: () => html`
      <h1 class="onboarding__title" id="step-title">¿Por qué <em>ahora</em>?</h1>
      <p class="muted">Te lo vamos a recordar justo cuando quieras rendirte. Escríbelo con tus palabras.</p>
      <div class="field">
        <label class="visually-hidden" for="why">Tu porqué</label>
        <textarea class="textarea" id="why" name="why" maxlength="${WHY_MAX}" required>${draft.why}</textarea>
        <p class="counter" data-ref="counter" aria-live="polite">${draft.why.length}/${WHY_MAX}</p>
      </div>
      <div class="suggestions" aria-label="Ideas">
        ${WHY_SUGGESTIONS.map(
          (text) => html`<button type="button" class="suggestion" data-action="suggest" data-text="${text}">
            ${text}
          </button>`,
        )}
      </div>
    `,
    sign: () => {
      const goal = GOALS.find((g) => g.id === draft.goal);
      return html`
        <h1 class="onboarding__title" id="step-title">Tu pacto</h1>
        <article class="pact">
          <p>
            Yo, <strong>${draft.name.trim()}</strong>, me comprometo a moverme
            <strong>${draft.minutes} minutos</strong> al día para <strong>${goal.title.toLowerCase()}</strong>.
          </p>
          <ul class="pact__clauses">
            <li>En un mal día, haré al menos <strong>2 minutos</strong>.</li>
            <li>Nunca fallaré <strong>dos días seguidos</strong>.</li>
          </ul>
          <p class="pact__why">“${draft.why.trim()}”</p>
        </article>
        <button
          type="button"
          class="hold-btn"
          data-action="sign"
          style="--hold-ms:${HOLD_MS}ms"
          aria-describedby="sign-hint"
        >
          <span class="hold-btn__fill" aria-hidden="true"></span>
          <span class="hold-btn__label" data-ref="sign-label">Mantén presionado para firmar</span>
        </button>
        <p class="muted" id="sign-hint" style="text-align:center;font-size:var(--fs-sm)">
          Funciona con el dedo, el mouse o manteniendo Enter. Podrás editarlo en «Mi pacto».
        </p>
      `;
    },
  };

  /* ---------- Render ---------- */

  function draw() {
    const current = step();
    const progress = ((stepIndex + 1) / STEPS.length) * 100;

    render(
      root,
      html`
        <section class="onboarding" aria-labelledby="step-title">
          <header class="onboarding__top">
            ${stepIndex > 0
              ? html`<button type="button" class="btn btn--ghost btn--icon" data-action="back" aria-label="Paso anterior">
                  ←
                </button>`
              : html`<span class="brand">brasa</span>`}
            <div
              class="progress"
              role="progressbar"
              aria-label="Progreso del pacto"
              aria-valuemin="1"
              aria-valuemax="${STEPS.length}"
              aria-valuenow="${stepIndex + 1}"
            >
              <span style="width:${progress}%"></span>
            </div>
          </header>
          <form class="onboarding__step" novalidate>
            ${templates[current.id]()}
            ${current.id === 'sign'
              ? ''
              : html`<button class="btn btn--primary btn--lg btn--block" type="submit" data-ref="next">
                  Continuar
                </button>`}
          </form>
          ${stepIndex === 0 && !existing && sync?.getStatus().phase !== 'disabled'
            ? html`<p class="onboarding__restore">
                ¿Ya firmaste tu pacto en otro dispositivo? <a href="#/cuenta">Recupera tu brasa</a>
              </p>`
            : ''}
        </section>
      `,
    );

    refreshNext();
    focusStep();
  }

  function focusStep() {
    const target = root.querySelector('input:not([type=radio]), textarea') ?? root.querySelector('#step-title');
    if (target?.id === 'step-title') target.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  }

  function refreshNext() {
    const next = root.querySelector('[data-ref="next"]');
    if (next) next.disabled = !step().isValid(draft);
  }

  /* ---------- Firma (mantener presionado) ---------- */

  function startHold(button) {
    if (holdTimer || signed) return;
    button.classList.add('is-holding');
    navigator.vibrate?.(15);
    holdTimer = setTimeout(() => completeSign(button), HOLD_MS);
  }

  function cancelHold(button) {
    if (!holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    button.classList.remove('is-holding');
  }

  function completeSign(button) {
    holdTimer = null;
    signed = true;
    button.classList.remove('is-holding');
    button.classList.add('is-signed');
    root.querySelector('[data-ref="sign-label"]').textContent = '¡Pacto firmado! 🔥';
    navigator.vibrate?.([40, 60, 80]);

    store.actions.signPact({
      name: draft.name.trim(),
      goal: draft.goal,
      level: draft.level,
      minutes: draft.minutes,
      why: draft.why.trim(),
    });
    redirectTimer = setTimeout(() => navigate('/hoy'), 900);
  }

  /* ---------- Eventos (delegados) ---------- */

  function onInput(event) {
    const { name, value } = event.target;
    if (!name || !(name in draft)) return;
    draft[name] = NUMERIC_FIELDS.has(name) ? Number(value) : value;
    if (name === 'why') root.querySelector('[data-ref="counter"]').textContent = `${value.length}/${WHY_MAX}`;
    refreshNext();
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!step().isValid(draft)) return;
    stepIndex = Math.min(stepIndex + 1, STEPS.length - 1);
    draw();
  }

  function onClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action } = button.dataset;

    if (action === 'back') {
      stepIndex = Math.max(0, stepIndex - 1);
      draw();
    } else if (action === 'suggest') {
      const textarea = root.querySelector('#why');
      textarea.value = button.dataset.text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
  }

  const signButton = (event) => event.target.closest('[data-action="sign"]');

  function onPointerDown(event) {
    const button = signButton(event);
    if (!button) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    startHold(button);
  }

  function onPointerUp(event) {
    const button = signButton(event);
    if (button) cancelHold(button);
  }

  function onKeyDown(event) {
    const button = signButton(event);
    if (!button || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat) startHold(button);
  }

  function onKeyUp(event) {
    const button = signButton(event);
    if (button && ['Enter', ' '].includes(event.key)) cancelHold(button);
  }

  const preventContextMenu = (event) => signButton(event) && event.preventDefault();

  const listeners = {
    input: onInput,
    change: onInput,
    submit: onSubmit,
    click: onClick,
    pointerdown: onPointerDown,
    pointerup: onPointerUp,
    pointercancel: onPointerUp,
    keydown: onKeyDown,
    keyup: onKeyUp,
    contextmenu: preventContextMenu,
  };

  return {
    mount(el) {
      root = el;
      Object.entries(listeners).forEach(([type, fn]) => root.addEventListener(type, fn));
      draw();
    },
    destroy() {
      clearTimeout(holdTimer);
      clearTimeout(redirectTimer);
      Object.entries(listeners).forEach(([type, fn]) => root.removeEventListener(type, fn));
    },
  };
}
