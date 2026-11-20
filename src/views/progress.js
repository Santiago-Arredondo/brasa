import { html, plural, render } from '../core/dom.js';
import { getWorkoutType } from '../data/workout-types.js';
import { addDays, fromISODate, startOfWeek, toISODate, WEEKDAY_INITIALS } from '../domain/dates.js';
import { EMBER_LEVELS, emberHeat, emberLevel } from '../domain/ember.js';
import { computeStreaks } from '../domain/streak.js';

const WEEKS = 12;
const HISTORY_SIZE = 5;
const longDate = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' });

function heatmap(sessions, today) {
  const levelByDay = new Map();
  sessions.forEach((s) => {
    const value = s.mode === 'minimo' ? 1 : 2;
    levelByDay.set(s.date, Math.max(levelByDay.get(s.date) ?? 0, value));
  });

  const start = addDays(startOfWeek(today), -(WEEKS - 1) * 7);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const activeCount = days.filter((d) => levelByDay.has(d)).length;

  return html`
    <div class="heatmap-wrap">
      <div class="heatmap-days" aria-hidden="true">${WEEKDAY_INITIALS.map((d) => html`<span>${d}</span>`)}</div>
      <div class="heatmap" role="img" aria-label="${plural(activeCount, 'día activo', 'días activos')} en las últimas ${WEEKS} semanas">
        ${days.map(
          (day) => html`<span
            class="heat-cell"
            data-level="${levelByDay.get(day) ?? 0}"
            ${day === today ? 'data-today' : ''}
            ${day > today ? 'data-future' : ''}
            title="${day}"
          ></span>`,
        )}
      </div>
    </div>
    <div class="legend" aria-hidden="true">
      <span>Nada</span><span class="heat-cell"></span><span class="heat-cell" data-level="1"></span>
      <span class="heat-cell" data-level="2"></span><span>Completo</span>
    </div>
  `;
}

export function progressView({ store, sync }) {
  return {
    mount(root) {
      const { sessions } = store.getState();
      const showCloudSave = sync && sync.getStatus().phase !== 'disabled' && !sync.isSignedIn();
      const today = toISODate();
      const { current, best } = computeStreaks(sessions, today);
      const heat = emberHeat(sessions, today);
      const level = emberLevel(heat);
      const levelIndex = EMBER_LEVELS.indexOf(level);
      const totalMinutes = sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);
      const recent = [...sessions].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, HISTORY_SIZE);

      render(
        root,
        html`
          <section class="progress-view">
            <header>
              <p class="eyebrow">Tu historia</p>
              <h1>Progreso</h1>
            </header>

            ${showCloudSave
              ? html`<a class="card card--subtle nudge" href="#/perfil">
                  <span aria-hidden="true">☁️</span>
                  <span><strong>Estas sesiones solo están en este dispositivo</strong><br /><span class="muted">Ve a «Mi pacto» y elige «Guardar mi progreso» para respaldarlas.</span></span>
                </a>`
              : ''}

            <dl class="stats">
              <div class="stat"><dt>Racha actual</dt><dd>${current}</dd></div>
              <div class="stat"><dt>Mejor racha</dt><dd>${best}</dd></div>
              <div class="stat"><dt>Sesiones</dt><dd>${sessions.length}</dd></div>
              <div class="stat"><dt>Minutos</dt><dd>${totalMinutes}</dd></div>
            </dl>

            <article class="card">
              <h2>Últimas ${WEEKS} semanas</h2>
              <p class="muted" style="margin:var(--sp-2) 0 var(--sp-4)">Cada cuadro encendido es una promesa cumplida.</p>
              ${heatmap(sessions, today)}
            </article>

            <article class="card">
              <h2>Niveles de tu brasa</h2>
              <p class="muted" style="margin-top:var(--sp-2)">${level.message}</p>
              <ol class="ladder">
                ${EMBER_LEVELS.map(
                  (l, i) => html`<li
                    class="${i === levelIndex ? 'is-current' : i < levelIndex ? 'is-reached' : ''}"
                    ${i === levelIndex ? html`aria-current="step"` : ''}
                  >
                    ${l.name}
                  </li>`,
                )}
              </ol>
            </article>

            <article class="card">
              <h2>Sesiones recientes</h2>
              ${recent.length
                ? html`<ul class="history">
                    ${recent.map(
                      (s) => html`<li>
                        <span>${longDate.format(fromISODate(s.date))}</span>
                        <span class="muted">
                          ${getWorkoutType(s.type).icon} ${getWorkoutType(s.type).name}
                          · ${s.mode === 'minimo' ? 'mínimo' : `${s.minutes} min`}
                        </span>
                      </li>`,
                    )}
                  </ul>`
                : html`<p class="muted" style="margin-top:var(--sp-2)">
                    Aún no hay sesiones. <a href="#/hoy">Enciende tu primera chispa</a>.
                  </p>`}
            </article>
          </section>
        `,
      );
    },
  };
}
