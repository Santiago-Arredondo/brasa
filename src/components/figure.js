import { html } from '../core/dom.js';

/**
 * Figura de referencia del ejercicio.
 * - Si el ejercicio tiene `image`, muestra esa imagen (foto/GIF propio).
 * - Si no, dibuja una figura SVG animada entre sus poses (SMIL), sin dependencias.
 */

const DEFAULT_TEMPO = 2;
const EASE = '0.45 0 0.55 1';

const spine = (pose) => pose.s ?? [(pose.n[0] + pose.p[0]) / 2, (pose.n[1] + pose.p[1]) / 2];

/** Orden de dibujo: lo lejano primero, lo cercano encima. */
const SEGMENTS = [
  { kind: 'far', joints: (p) => [p.n, p.le, p.lh] },
  { kind: 'far', joints: (p) => [p.p, p.lk, p.lf] },
  { kind: 'torso', joints: (p) => [p.n, spine(p), p.p] },
  { kind: 'near', joints: (p) => [p.p, p.rk, p.rf] },
  { kind: 'near', joints: (p) => [p.n, p.re, p.rh] },
];

const toPoints = (joints) => joints.map(([x, y]) => `${x},${y}`).join(' ');

const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function animate(attribute, frames, tempo) {
  return html`<animate
    attributeName="${attribute}"
    values="${[...frames, frames[0]].join(';')}"
    keyTimes="0;0.5;1"
    calcMode="spline"
    keySplines="${EASE};${EASE}"
    dur="${tempo}s"
    repeatCount="indefinite"
  />`;
}

function propShape(prop) {
  if (!prop) return '';
  if (prop.kind === 'wall') {
    return html`<line class="figure__prop-line" x1="${prop.x}" y1="8" x2="${prop.x}" y2="93" />`;
  }
  return html`<rect class="figure__prop" x="${prop.x}" y="${prop.y}" width="${prop.w}" height="${prop.h}" rx="2" />`;
}

/**
 * @param {object} exercise
 * @param {{ size?: 'sm'|'md'|'lg', animated?: boolean, className?: string }} options
 */
export function exerciseFigure(exercise, { size = 'md', animated = true, className = '' } = {}) {
  const label = `Referencia: ${exercise.name}`;

  if (exercise.image) {
    return html`<img class="figure figure--${size} ${className}" src="${exercise.image}" alt="${label}" loading="lazy" />`;
  }

  const poses = exercise.poses?.length ? exercise.poses : [];
  if (!poses.length) return '';

  const moving = animated && poses.length > 1 && !prefersReducedMotion();
  // En estático se muestra la pose de "acción" (la última), que es la más reconocible.
  const still = poses[poses.length - 1];
  const tempo = exercise.tempo ?? DEFAULT_TEMPO;

  return html`
    <svg class="figure figure--${size} ${className}" viewBox="0 0 100 100" role="img" aria-label="${label}">
      ${propShape(exercise.prop)}
      <line class="figure__ground" x1="4" y1="93.5" x2="96" y2="93.5" />
      ${SEGMENTS.map(
        (segment) => html`<polyline class="figure__limb figure__limb--${segment.kind}" points="${toPoints(segment.joints(still))}">
          ${moving ? animate('points', poses.map((p) => toPoints(segment.joints(p))), tempo) : ''}
        </polyline>`,
      )}
      <circle class="figure__head" cx="${still.h[0]}" cy="${still.h[1]}" r="6.5">
        ${moving ? animate('cx', poses.map((p) => p.h[0]), tempo) : ''}
        ${moving ? animate('cy', poses.map((p) => p.h[1]), tempo) : ''}
      </circle>
    </svg>
  `;
}
