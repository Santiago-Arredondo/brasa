import { addDays } from './dates.js';

/**
 * Regla de oro de Brasa: "Nunca falles dos veces".
 * Un día sin entrenar NO rompe la racha; dos días seguidos sin entrenar, sí.
 * La racha cuenta días activos dentro de la cadena vigente.
 */
export const MAX_CONSECUTIVE_MISSES = 2;

const activeDays = (sessions) => new Set(sessions.map((s) => s.date));

export function computeStreaks(sessions, today) {
  if (!sessions.length) return { current: 0, best: 0 };

  const days = activeDays(sessions);
  const first = [...days].sort()[0];
  let current = 0;
  let best = 0;
  let misses = 0;

  for (let day = first; day <= today; day = addDays(day, 1)) {
    if (days.has(day)) {
      current += 1;
      misses = 0;
      best = Math.max(best, current);
    } else if (day !== today) {
      // Hoy aún no termina: no cuenta como fallo.
      misses += 1;
      if (misses >= MAX_CONSECUTIVE_MISSES) current = 0;
    }
  }

  return { current, best };
}

/**
 * Estado del día para la pantalla principal.
 * atRisk: ayer no entrenaste y hoy tampoco todavía → si hoy fallas, se apaga.
 */
export function getDayStatus(sessions, today) {
  const days = activeDays(sessions);
  const yesterday = addDays(today, -1);
  const { current, best } = computeStreaks(sessions, today);
  const doneToday = days.has(today);

  return {
    current,
    best,
    doneToday,
    atRisk: !doneToday && !days.has(yesterday) && current > 0,
    cold: !doneToday && current === 0 && sessions.length > 0,
  };
}
