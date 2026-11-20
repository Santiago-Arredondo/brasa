/**
 * Lógica pura de recordatorios: cálculo de la próxima alarma y archivo de calendario (.ics).
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(time) {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error(`Hora inválida: ${time}`);
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export const isValidTime = (time) => TIME_PATTERN.test(time);

/** Próxima ocurrencia de `time` (HH:MM, hora local) estrictamente después de `now`. */
export function nextReminderAt(now, time) {
  const { hours, minutes } = parseTime(time);
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/* ---------- iCalendar (RFC 5545) ---------- */

const pad = (n) => String(n).padStart(2, '0');

/** Fecha-hora local "flotante": la alarma suena a esa hora en la zona del usuario. */
const icsLocal = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const escapeICS = (text) =>
  String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Pliega líneas largas (máx. 75 octetos; usamos 60 caracteres por los acentos/emojis). */
function fold(line) {
  const chars = [...line];
  if (chars.length <= 60) return line;
  const parts = [];
  for (let i = 0; i < chars.length; i += 60) parts.push(chars.slice(i, i + 60).join(''));
  return parts.join('\r\n ');
}

export function buildReminderICS({ time, why = '', appUrl = '', now = new Date() }) {
  const start = nextReminderAt(now, time);
  const description = why
    ? `Tu porqué: “${why}”. Aunque sean 2 minutos: nunca dos días seguidos.`
    : 'Aunque sean 2 minutos: nunca dos días seguidos.';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brasa//Recordatorio diario//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:brasa-recordatorio-diario@brasa.app',
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsLocal(start)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeICS('🔥 Alimenta tu brasa')}`,
    `DESCRIPTION:${escapeICS(description)}`,
    appUrl && `URL:${appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS('Alimenta tu brasa')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.map(fold).join('\r\n')}\r\n`;
}
