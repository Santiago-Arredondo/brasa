import { diffDays } from './dates.js';

/**
 * "Calor" de la brasa (0..1): suma de las sesiones de los últimos días con decaimiento.
 * Lo reciente pesa más; el modo mínimo calienta la mitad. Entrenar a diario
 * durante ~2 semanas lleva la brasa al máximo; dejar de entrenar la enfría poco a poco.
 */
export const HEAT_WINDOW_DAYS = 14;
const HEAT_PER_SESSION = 0.13;
const DECAY = 0.9;
const MODE_WEIGHT = { full: 1, minimo: 0.5 };

export function emberHeat(sessions, today) {
  const weightByDay = new Map();
  for (const session of sessions) {
    const age = diffDays(session.date, today);
    if (age < 0 || age >= HEAT_WINDOW_DAYS) continue;
    const weight = MODE_WEIGHT[session.mode] ?? 1;
    weightByDay.set(age, Math.max(weightByDay.get(age) ?? 0, weight));
  }

  let heat = 0;
  for (const [age, weight] of weightByDay) {
    heat += HEAT_PER_SESSION * weight * DECAY ** age;
  }
  return Math.min(1, Math.round(heat * 1000) / 1000);
}

export const EMBER_LEVELS = [
  { id: 'ceniza', name: 'Ceniza', min: 0, message: 'Todo fuego empieza con una chispa.' },
  { id: 'chispa', name: 'Chispa', min: 0.1, message: 'Ya encendiste algo. Protégelo.' },
  { id: 'brasa', name: 'Brasa', min: 0.3, message: 'Hay calor de verdad. Sigue alimentándolo.' },
  { id: 'llama', name: 'Llama', min: 0.6, message: 'Esto ya es un hábito. Se nota.' },
  { id: 'hoguera', name: 'Hoguera', min: 0.85, message: 'Imparable. Eres la prueba de que se puede.' },
];

export function emberLevel(heat) {
  return [...EMBER_LEVELS].reverse().find((level) => heat >= level.min) ?? EMBER_LEVELS[0];
}
