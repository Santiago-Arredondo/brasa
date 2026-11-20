/**
 * Utilidades de fecha en hora LOCAL usando strings ISO 'YYYY-MM-DD'.
 * Usar strings evita errores de zona horaria y permite comparar con < y >.
 */

export function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Días entre `from` y `to` (to - from). Math.round absorbe cambios de horario de verano. */
export function diffDays(from, to) {
  return Math.round((fromISODate(to) - fromISODate(from)) / 86_400_000);
}

/** Lunes de la semana que contiene `iso`. */
export function startOfWeek(iso) {
  const weekday = (fromISODate(iso).getDay() + 6) % 7; // 0 = lunes
  return addDays(iso, -weekday);
}

export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
