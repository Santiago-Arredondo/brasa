import { html } from '../core/dom.js';

/* Forma de la llama (viewBox 200x240, base en y≈206). Las capas internas son la misma forma escalada. */
const FLAME =
  'M100 18 C112 58 150 82 156 132 C162 178 134 206 100 206 C66 206 38 180 44 136 C48 104 66 92 72 64 C82 82 90 88 94 96 C98 70 96 44 100 18 Z';
const scaleAroundBase = (s) => `translate(100 206) scale(${s}) translate(-100 -206)`;

const SPARKS = [
  { x: 80, drift: -14, delay: 0 },
  { x: 120, drift: 12, delay: 0.7 },
  { x: 100, drift: 4, delay: 1.3 },
  { x: 66, drift: -20, delay: 1.9 },
  { x: 134, drift: 18, delay: 0.4 },
  { x: 92, drift: -6, delay: 2.3 },
  { x: 112, drift: 9, delay: 1.6 },
  { x: 74, drift: -10, delay: 1.0 },
];

let instance = 0;

/**
 * Brasa animada. `heat` (0..1) controla tamaño, color, brillo y chispas.
 * Todo el movimiento es CSS y respeta prefers-reduced-motion.
 */
export function emberSVG(heat, { size = 'lg', label = '' } = {}) {
  const h = Math.min(1, Math.max(0, Number(heat) || 0));
  const gradientId = `ember-glow-${(instance += 1)}`;
  const sparks = SPARKS.slice(0, Math.round(h * SPARKS.length));

  return html`
    <div class="ember ember--${size}" style="--heat:${h}" role="img" aria-label="${label}">
      <svg viewBox="0 0 200 240" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="${gradientId}">
            <stop offset="0%" stop-color="#ff7a2e" stop-opacity="0.55" />
            <stop offset="100%" stop-color="#ff5f1f" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle class="ember__glow" cx="100" cy="160" r="100" fill="url(#${gradientId})" />
        <g class="ember__fire">
          <path class="ember__flame ember__flame--outer" d="${FLAME}" />
          <g transform="${scaleAroundBase(0.7)}">
            <path class="ember__flame ember__flame--mid" d="${FLAME}" />
          </g>
          <g transform="${scaleAroundBase(0.42)}">
            <path class="ember__flame ember__flame--core" d="${FLAME}" />
          </g>
        </g>
        <g class="ember__logs">
          <rect x="42" y="200" width="116" height="18" rx="9" transform="rotate(-8 100 209)" />
          <rect x="42" y="200" width="116" height="18" rx="9" transform="rotate(8 100 209)" />
        </g>
        ${sparks.map(
          (s) => html`<circle
            class="ember__spark"
            cx="${s.x}"
            cy="150"
            r="2.5"
            style="--drift:${s.drift}px; animation-delay:${s.delay}s"
          />`,
        )}
      </svg>
    </div>
  `;
}
