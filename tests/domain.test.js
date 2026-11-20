import { createStore, migrate } from '../src/core/store.js';
import { EXERCISES } from '../src/data/exercises.js';
import { WORKOUT_TYPES } from '../src/data/workout-types.js';
import { buildReminderICS, nextReminderAt } from '../src/domain/reminder.js';
import { escapeHTML, html } from '../src/core/dom.js';
import { addDays, diffDays, startOfWeek } from '../src/domain/dates.js';
import { emberHeat, emberLevel } from '../src/domain/ember.js';
import { computeStreaks, getDayStatus } from '../src/domain/streak.js';
import { createSequenceTimer } from '../src/domain/timer.js';
import { generateWorkout } from '../src/domain/workout.js';
import { assert, assertEqual, test } from './runner.js';

const TODAY = '2026-11-14';
const daysAgo = (n, mode = 'full') => ({ date: addDays(TODAY, -n), mode, minutes: 10 });

/* ---------- Fechas ---------- */
test('dates: addDays cruza meses y años', () => {
  assertEqual(addDays('2026-12-31', 1), '2027-01-01');
  assertEqual(addDays('2026-03-01', -1), '2026-02-28');
});
test('dates: diffDays y startOfWeek (lunes)', () => {
  assertEqual(diffDays('2026-11-01', '2026-11-14'), 13);
  assertEqual(startOfWeek('2026-11-14'), '2026-11-09'); // sábado → lunes 9
});

/* ---------- Rachas: "nunca falles dos veces" ---------- */
test('streak: sin sesiones = 0', () => {
  assertEqual(computeStreaks([], TODAY), { current: 0, best: 0 });
});
test('streak: 3 días seguidos terminando hoy', () => {
  assertEqual(computeStreaks([daysAgo(2), daysAgo(1), daysAgo(0)], TODAY).current, 3);
});
test('streak: fallar UN día no rompe la racha', () => {
  assertEqual(computeStreaks([daysAgo(3), daysAgo(2), daysAgo(0)], TODAY), { current: 3, best: 3 });
});
test('streak: fallar DOS días seguidos sí la rompe', () => {
  assertEqual(computeStreaks([daysAgo(4), daysAgo(3), daysAgo(0)], TODAY), { current: 1, best: 2 });
});
test('streak: hoy sin entrenar aún no cuenta como fallo', () => {
  const status = getDayStatus([daysAgo(2), daysAgo(1)], TODAY);
  assertEqual(status.current, 2);
  assert(!status.atRisk, 'no debería estar en riesgo');
});
test('streak: ayer sin entrenar y hoy tampoco → en riesgo', () => {
  const status = getDayStatus([daysAgo(3), daysAgo(2)], TODAY);
  assert(status.atRisk, 'debería estar en riesgo');
  assertEqual(status.current, 2);
});
test('streak: tras dos fallos la brasa está fría', () => {
  const status = getDayStatus([daysAgo(5)], TODAY);
  assert(status.cold && status.current === 0);
});
test('streak: sesiones repetidas el mismo día cuentan una vez', () => {
  assertEqual(computeStreaks([daysAgo(0), daysAgo(0)], TODAY).current, 1);
});

/* ---------- Calor de la brasa ---------- */
test('ember: sin sesiones = 0 (Ceniza)', () => {
  assertEqual(emberHeat([], TODAY), 0);
  assertEqual(emberLevel(0).id, 'ceniza');
});
test('ember: 14 días seguidos ≈ hoguera', () => {
  const sessions = Array.from({ length: 14 }, (_, i) => daysAgo(i));
  const heat = emberHeat(sessions, TODAY);
  assert(heat >= 0.85, `heat=${heat}`);
  assertEqual(emberLevel(heat).id, 'hoguera');
});
test('ember: modo mínimo calienta menos que completo', () => {
  assert(emberHeat([daysAgo(0, 'minimo')], TODAY) < emberHeat([daysAgo(0)], TODAY));
});
test('ember: sesiones antiguas (>14 días) no suman', () => {
  assertEqual(emberHeat([daysAgo(20)], TODAY), 0);
});

/* ---------- Generador de entrenamiento ---------- */
const profile = { goal: 'fuerza', level: 1, minutes: 10 };

test('workout: es determinista por fecha', () => {
  const a = generateWorkout({ profile, date: TODAY });
  const b = generateWorkout({ profile, date: TODAY });
  assertEqual(a.exercises.map((e) => e.id), b.exercises.map((e) => e.id));
});
test('workout: no excede los minutos del pacto', () => {
  for (const minutes of [5, 10, 15, 20, 30]) {
    for (const level of [1, 2, 3]) {
      const w = generateWorkout({ profile: { ...profile, minutes, level }, date: TODAY });
      assert(w.totalSeconds <= minutes * 60, `${minutes}min/n${level}: ${w.totalSeconds}s`);
      assert(w.totalSeconds >= minutes * 60 * 0.8, `${minutes}min/n${level} muy corto: ${w.totalSeconds}s`);
    }
  }
});
test('workout: respeta el nivel (sin burpees para principiantes)', () => {
  const w = generateWorkout({ profile, date: TODAY });
  assert(w.exercises.every((e) => e.level <= 1));
});
test('workout: modo mínimo dura ≤ 2 minutos', () => {
  const w = generateWorkout({ profile, date: TODAY, mode: 'minimo' });
  assert(w.totalSeconds <= 120 && w.minutes === 2);
});
test('workout: alterna trabajo/descanso y termina en trabajo', () => {
  const { steps } = generateWorkout({ profile, date: TODAY });
  steps.forEach((s, i) => assertEqual(s.kind, i % 2 === 0 ? 'work' : 'rest'));
  assertEqual(steps.at(-1).kind, 'work');
});

test('workout: cada tipo, nivel y duración genera un entrenamiento válido', () => {
  for (const type of WORKOUT_TYPES) {
    for (const level of [1, 2, 3]) {
      for (const minutes of [5, 10, 15, 20, 30]) {
        const w = generateWorkout({ profile: { ...profile, level, minutes }, date: TODAY, type: type.id });
        const tag = `${type.id}/n${level}/${minutes}min`;
        assertEqual(w.type, type.id, tag);
        assert(w.exercises.length > 0, `${tag}: sin ejercicios`);
        assert(w.exercises.every((e) => e.types.includes(type.id) && e.level <= level), `${tag}: ejercicio fuera de tipo/nivel`);
        assert(w.totalSeconds <= minutes * 60 && w.totalSeconds >= minutes * 60 * 0.8, `${tag}: ${w.totalSeconds}s`);
      }
      const minimo = generateWorkout({ profile: { ...profile, level }, date: TODAY, type: type.id, mode: 'minimo' });
      assert(minimo.totalSeconds <= 120 && minimo.totalSeconds >= 90, `${type.id} mínimo: ${minimo.totalSeconds}s`);
    }
  }
});
test('workout: caminata no tiene descansos y alterna ritmos en orden', () => {
  const w = generateWorkout({ profile, date: TODAY, type: 'caminata' });
  assert(w.steps.every((s) => s.kind === 'work'));
  assertEqual(w.steps.slice(0, 3).map((s) => s.exercise.id), ['paso-comodo', 'paso-rapido', 'paso-comodo']);
});
test('workout: sin tipo usa el sugerido por la meta', () => {
  assertEqual(generateWorkout({ profile: { ...profile, goal: 'grasa' }, date: TODAY }).type, 'cardio');
});

/* ---------- Catálogo y figuras ---------- */
const JOINTS = ['h', 'n', 'p', 'le', 'lh', 're', 'rh', 'lk', 'lf', 'rk', 'rf'];
test('catálogo: ids únicos y tipos existentes', () => {
  const ids = EXERCISES.map((e) => e.id);
  assertEqual(new Set(ids).size, ids.length, 'ids duplicados');
  const typeIds = new Set(WORKOUT_TYPES.map((t) => t.id));
  EXERCISES.forEach((e) => assert(e.types.length && e.types.every((t) => typeIds.has(t)), `${e.id}: tipo inválido`));
});
test('catálogo: cada ejercicio tiene imagen o poses completas dentro del lienzo', () => {
  for (const e of EXERCISES) {
    if (e.image) continue;
    assert(e.poses?.length >= 1 && e.poses.length <= 2, `${e.id}: 1 o 2 poses`);
    for (const pose of e.poses) {
      for (const joint of JOINTS) {
        const point = pose[joint];
        assert(Array.isArray(point) && point.length === 2, `${e.id}: falta ${joint}`);
        assert(point.every((v) => Number.isFinite(v) && v >= -2 && v <= 102), `${e.id}.${joint} fuera del lienzo`);
      }
    }
  }
});

/* ---------- Recordatorios ---------- */
test('reminder: próxima alarma hoy si la hora no ha pasado', () => {
  const at = nextReminderAt(new Date(2026, 10, 14, 8, 0), '19:30');
  assertEqual([at.getDate(), at.getHours(), at.getMinutes()], [14, 19, 30]);
});
test('reminder: mañana si la hora ya pasó (o es exactamente ahora)', () => {
  assertEqual(nextReminderAt(new Date(2026, 10, 14, 20, 0), '19:30').getDate(), 15);
  assertEqual(nextReminderAt(new Date(2026, 10, 14, 19, 30), '19:30').getDate(), 15);
});
test('reminder: .ics diario válido y con texto escapado', () => {
  const ics = buildReminderICS({ time: '07:15', why: 'Por mí, por mi salud; ya', now: new Date(2026, 10, 14, 8, 0) });
  assert(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'), 'estructura');
  assert(ics.includes('DTSTART:20261115T071500'), 'empieza mañana 07:15');
  assert(ics.includes('RRULE:FREQ=DAILY'), 'diario');
  assert(ics.includes('Por mí\\, por mi salud\\; ya'), 'escapado');
  assert(ics.split('\r\n').every((line) => [...line].length <= 75), 'líneas plegadas');
});

/* ---------- Temporizador ---------- */
function fakeTimer(steps) {
  let clock = 0;
  const events = [];
  const timer = createSequenceTimer({
    steps,
    now: () => clock,
    schedule: () => 1,
    cancel: () => {},
    onStep: (s) => events.push(`step:${s.index}`),
    onDone: () => events.push('done'),
  });
  return { timer, events, advance: (ms) => ((clock += ms), timer.tick()) };
}

test('timer: avanza de paso al agotarse el tiempo', () => {
  const { timer, events, advance } = fakeTimer([{ seconds: 2 }, { seconds: 1 }]);
  timer.start();
  advance(1000);
  assertEqual(timer.getSnapshot().remainingMs, 1000);
  advance(1000);
  assertEqual(events, ['step:0', 'step:1']);
  advance(1000);
  assertEqual(events.at(-1), 'done');
});
test('timer: la pausa congela el tiempo', () => {
  const { timer, advance } = fakeTimer([{ seconds: 5 }]);
  timer.start();
  advance(1000);
  timer.pause();
  advance(10_000);
  assertEqual(timer.getSnapshot().remainingMs, 4000);
  timer.resume();
  advance(1000);
  assertEqual(timer.getSnapshot().remainingMs, 3000);
});
test('timer: saltar pasa al siguiente paso', () => {
  const { timer, events } = fakeTimer([{ seconds: 30 }, { seconds: 30 }]);
  timer.start();
  timer.skip();
  assertEqual(events, ['step:0', 'step:1']);
});

/* ---------- Store ---------- */
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), data };
}

test('store: persiste el pacto y las sesiones', () => {
  const storage = memoryStorage();
  const store = createStore({ storage });
  store.actions.signPact({ name: 'Ana', goal: 'fuerza', level: 1, minutes: 10, why: 'Porque sí puedo' });
  const id = store.actions.logSession({ date: TODAY, mode: 'full', minutes: 10 });
  store.actions.rateSession(id, 'bien');

  const reloaded = createStore({ storage });
  assertEqual(reloaded.getState().profile.name, 'Ana');
  assertEqual(reloaded.getState().sessions[0].feeling, 'bien');
});
test('store: datos corruptos → estado inicial (no rompe la app)', () => {
  const store = createStore({ storage: memoryStorage({ 'brasa:v1': '{no-json' }) });
  assertEqual(store.getState().profile, null);
});

test('store: migra datos de la v1 sin perder nada', () => {
  const v1 = { version: 1, profile: { name: 'Ana' }, sessions: [{ id: 'a', date: TODAY, mode: 'full', minutes: 10 }] };
  const state = migrate(v1);
  assertEqual(state.version, 3);
  assertEqual(state.profile.name, 'Ana');
  assertEqual(state.sessions[0].type, 'funcional');
  assertEqual(state.reminder, { enabled: false, time: '19:00' });
});

/* ---------- Seguridad ---------- */
test('dom: html escapa contenido del usuario', () => {
  const evil = '<img src=x onerror=alert(1)>';
  assertEqual(String(html`<p>${evil}</p>`), `<p>${escapeHTML(evil)}</p>`);
  assert(!String(html`<p>${evil}</p>`).includes('<img'));
});
