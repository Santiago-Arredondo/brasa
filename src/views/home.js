import { html, render } from '../core/dom.js';
import { emberSVG } from '../components/ember.js';
import { exerciseFigure } from '../components/figure.js';
import { defaultTypeFor, getWorkoutType, WORKOUT_TYPES } from '../data/workout-types.js';
import { addDays, startOfWeek, toISODate, WEEKDAY_INITIALS } from '../domain/dates.js';
import { emberHeat, emberLevel } from '../domain/ember.js';
import { getDayStatus } from '../domain/streak.js';
import { generateWorkout } from '../domain/workout.js';

const dateFormatter = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

function greeting(hour) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Mensaje principal según el estado: aquí vive la "psicología anti-abandono". */
function statusMessage(status, sessionsCount) {
  if (status.doneToday) {
    return { tone: 'ok', text: 'Brasa alimentada hoy. Mañana la mantienes viva.' };
  }
  if (status.atRisk) {
    return {
      tone: 'risk',
      text: 'Ayer descansaste, y está bien. Pero hoy no: nunca dos días seguidos. Aunque sean 2 minutos.',
    };
  }
  if (status.cold) {
    return {
      tone: 'risk',
      text: 'Tu brasa se enfrió. Lo importante no es caer, es volver. Hoy empieza de nuevo, sin culpa.',
    };
  }
  if (sessionsCount === 0) {
    return { tone: 'neutral', text: 'Tu primera chispa te espera. El día 1 es el más difícil y el más importante.' };
  }
  return { tone: 'neutral', text: 'Tu brasa sigue viva. Aliméntala hoy y mantén la cadena.' };
}

function weekStrip(sessions, today) {
  const modeByDay = new Map();
  sessions.forEach((s) => {
    if (modeByDay.get(s.date) !== 'full') modeByDay.set(s.date, s.mode);
  });
  const monday = startOfWeek(today);

  return html`
    <ol class="week" aria-label="Esta semana">
      ${WEEKDAY_INITIALS.map((initial, i) => {
        const day = addDays(monday, i);
        const mode = modeByDay.get(day);
        const classes = ['week__day', mode && `is-${mode}`, day === today && 'is-today'].filter(Boolean).join(' ');
        const state = mode === 'full' ? 'entrenaste' : mode === 'minimo' ? 'modo mínimo' : 'sin entrenar';
        return html`<li class="${classes}">
          <span class="week__dot" aria-hidden="true"></span>
          <span aria-hidden="true">${initial}</span>
          <span class="visually-hidden">${day}: ${state}</span>
        </li>`;
      })}
    </ol>
  `;
}

function typePicker(selectedId) {
  return html`
    <fieldset class="type-picker">
      <legend class="visually-hidden">Tipo de entrenamiento</legend>
      ${WORKOUT_TYPES.map(
        (t) => html`<label class="type-chip">
          <input type="radio" name="workout-type" value="${t.id}" ${t.id === selectedId ? 'checked' : ''} />
          <span class="type-chip__body"><span aria-hidden="true">${t.icon}</span>${t.name}</span>
        </label>`,
      )}
    </fieldset>
  `;
}

export function homeView({ store, sync }) {
  let root;

  function draw() {
    const { profile, sessions, preferences, reminder } = store.getState();
    const now = new Date();
    const today = toISODate(now);
    const status = getDayStatus(sessions, today);
    const heat = emberHeat(sessions, today);
    const level = emberLevel(heat);
    const type = getWorkoutType(preferences.workoutType ?? defaultTypeFor(profile.goal));
    const workout = generateWorkout({ profile, date: today, type: type.id });
    const message = statusMessage(status, sessions.length);
    const showWhy = status.atRisk || status.cold;
    const showCloudSave = sync && sync.getStatus().phase !== 'disabled' && !sync.isSignedIn();
    const startHref = `#/entreno?tipo=${type.id}`;

    render(
      root,
      html`
        <section class="home">
          <header>
            <p class="eyebrow">${dateFormatter.format(now)}</p>
            <h1>${greeting(now.getHours())}, ${profile.name}</h1>
          </header>

          <div class="home__hero">
            ${emberSVG(heat, { label: `Tu brasa está en nivel ${level.name}` })}
            <span class="badge">${level.name}</span>
            <p class="home__streak">
              <strong>${status.current}</strong> ${status.current === 1 ? 'día encendida' : 'días encendida'}
            </p>
            ${weekStrip(sessions, today)}
          </div>

          <p class="home__status home__status--${message.tone}" role="status">${message.text}</p>

          ${showCloudSave
            ? html`<a class="card card--subtle nudge" href="#/perfil">
                <span aria-hidden="true">☁️</span>
                <span><strong>Tu progreso aún está solo en este dispositivo</strong><br /><span class="muted">Activa «Guardar mi progreso» para respaldarlo.</span></span>
              </a>`
            : ''}

          ${showWhy
            ? html`<blockquote class="why-quote">
                “${profile.why}”
                <cite>Tu porqué</cite>
              </blockquote>`
            : ''}

          <article class="card mission" aria-labelledby="mission-title">
            <header>
              <p class="eyebrow">Misión de hoy</p>
              <h2 id="mission-title">${type.name} · ${workout.minutes} minutos</h2>
              <p class="muted" style="font-size:var(--fs-sm)">${type.description}</p>
            </header>
            ${typePicker(type.id)}
            <ul class="ex-grid" aria-label="Ejercicios de hoy">
              ${workout.exercises.map(
                (ex) => html`<li>${exerciseFigure(ex, { size: 'sm', animated: false })}<span>${ex.name}</span></li>`,
              )}
            </ul>
            <div class="mission__actions">
              <a class="btn btn--primary btn--lg btn--block" href="${startHref}">
                ${status.doneToday ? 'Entrenar otra vez' : 'Encender mi brasa'}
              </a>
              ${status.doneToday
                ? ''
                : html`<a class="btn btn--ghost btn--block" href="${startHref}&modo=minimo">
                    ¿Día difícil? Haz solo 2 minutos
                  </a>`}
            </div>
          </article>

          ${!reminder.enabled && sessions.length > 0
            ? html`<a class="card card--subtle nudge" href="#/perfil">
                <span aria-hidden="true">⏰</span>
                <span><strong>¿Te recordamos mañana?</strong><br /><span class="muted">Activa tu recordatorio diario.</span></span>
              </a>`
            : ''}

          <aside class="card card--subtle">
            <h2>La regla de oro</h2>
            <p class="muted" style="margin-top:var(--sp-2)">
              Nunca falles dos días seguidos. Un día malo es humano; dos seguidos es el comienzo de dejarlo.
            </p>
          </aside>
        </section>
      `,
    );
  }

  function onChange(event) {
    if (event.target.name !== 'workout-type') return;
    const selected = event.target.value;
    store.actions.setWorkoutType(selected);
    const scroll = window.scrollY;
    draw();
    window.scrollTo(0, scroll);
    root.querySelector(`input[name="workout-type"][value="${CSS.escape(selected)}"]`)?.focus({ preventScroll: true });
  }

  return {
    mount(el) {
      root = el;
      root.addEventListener('change', onChange);
      draw();
    },
    destroy() {
      root.removeEventListener('change', onChange);
    },
  };
}
