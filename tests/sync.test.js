/** Tests de la sincronización con la nube (sin red: cliente de Supabase falso). */
import { createStore, migrate } from '../src/core/store.js';
import { createSync, fromSessionRow, toSessionRow } from '../src/core/sync.js';
import { mergeSessions, mergeSettings } from '../src/domain/merge.js';
import { assert, assertEqual, test } from './runner.js';

const memoryStorage = () => {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) };
};
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/** Imita lo que Brasa usa de supabase-js: auth, from().select/eq/order/range/maybeSingle/upsert y rpc. */
function fakeSupabase({ profiles = [], sessions = [], session = null } = {}) {
  const db = { profiles: [...profiles], sessions: [...sessions] };
  const calls = [];
  let onAuth;

  function query(table) {
    let rows = db[table];
    let range = null;
    const builder = {
      select: () => builder,
      order: () => builder,
      eq(column, value) {
        rows = rows.filter((r) => r[column] === value);
        return builder;
      },
      range(from, to) {
        range = [from, to];
        return builder;
      },
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then(resolve, reject) {
        const data = range ? rows.slice(range[0], range[1] + 1) : rows;
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
      async upsert(input, { onConflict }) {
        const keys = onConflict.split(',');
        const list = [].concat(input);
        for (const row of list) {
          const i = db[table].findIndex((r) => keys.every((k) => r[k] === row[k]));
          if (i >= 0) db[table][i] = { ...db[table][i], ...row };
          else db[table].push({ ...row });
        }
        calls.push(`upsert:${table}:${list.length}`);
        return { error: null };
      },
    };
    return builder;
  }

  return {
    db,
    calls,
    from: query,
    async rpc(name) {
      calls.push(`rpc:${name}`);
      db.profiles = [];
      db.sessions = [];
      return { error: null };
    },
    auth: {
      onAuthStateChange(callback) {
        onAuth = callback;
        queueMicrotask(() => callback('INITIAL_SESSION', session));
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithOtp() {
        calls.push('otp');
        return { error: null };
      },
      async verifyOtp({ email, token }) {
        if (token !== '123456') return { error: { message: 'Token has expired or is invalid', status: 403 } };
        onAuth('SIGNED_IN', { user: { id: 'u1', email } });
        return { error: null };
      },
      async signOut() {
        onAuth('SIGNED_OUT', null);
        return { error: null };
      },
    },
  };
}

async function setup(client, prepare) {
  const store = createStore({ storage: memoryStorage() });
  prepare?.(store);
  const sync = createSync({ store, configured: true, loadClient: async () => client, debounceMs: 0 });
  await sync.start();
  await tick();
  await sync.settled();
  return { store, sync };
}

const PACT = { name: 'Ana', goal: 'fuerza', level: 1, minutes: 10, why: 'Porque sí puedo' };
const remoteProfile = (updatedAt = '2026-11-01T10:00:00+00:00') => ({
  user_id: 'u1',
  profile: { ...PACT, name: 'Ana (nube)', signedAt: '2026-11-01T10:00:00.000Z' },
  preferences: { workoutType: 'yoga' },
  updated_at: updatedAt,
});
const remoteSession = (id, extra = {}) => ({
  user_id: 'u1',
  id,
  date: '2026-11-10',
  type: 'cardio',
  mode: 'full',
  minutes: 10,
  feeling: null,
  completed_at: '2026-11-10T18:00:00+00:00',
  updated_at: '2026-11-10T18:00:00+00:00',
  ...extra,
});

/* ---------- Fusión (pura) ---------- */
test('merge: une sesiones por id y gana la edición más reciente', () => {
  const local = [{ id: 'a', date: '2026-11-02', updatedAt: '2026-11-02T10:00:00.000Z', feeling: 'bien' }];
  const remote = [
    { id: 'a', date: '2026-11-02', updatedAt: '2026-11-02T09:00:00.000Z' },
    { id: 'b', date: '2026-11-01', updatedAt: '2026-11-01T09:00:00.000Z' },
  ];
  const merged = mergeSessions(local, remote);
  assertEqual(merged.map((s) => s.id), ['b', 'a'], 'ordenadas por fecha');
  assertEqual(merged[1].feeling, 'bien');
});
test('merge: un dispositivo nuevo adopta el pacto de la nube', () => {
  const local = { profile: null, preferences: { workoutType: null }, settingsUpdatedAt: null };
  const remote = { profile: { name: 'Ana' }, preferences: { workoutType: 'yoga' }, settingsUpdatedAt: '2026-11-01T00:00:00.000Z' };
  assertEqual(mergeSettings(local, remote).profile.name, 'Ana');
});
test('merge: el pacto local más reciente no se pisa', () => {
  const local = { profile: { name: 'Nuevo' }, preferences: {}, settingsUpdatedAt: '2026-11-05T00:00:00.000Z' };
  const remote = { profile: { name: 'Viejo' }, preferences: {}, settingsUpdatedAt: '2026-11-01T00:00:00.000Z' };
  assertEqual(mergeSettings(local, remote).profile.name, 'Nuevo');
});
test('sync: las filas ida y vuelta conservan los datos', () => {
  const session = { id: 'x', date: '2026-11-10', type: 'core', mode: 'minimo', minutes: 2, feeling: 'duro', completedAt: '2026-11-10T18:00:00.000Z', updatedAt: '2026-11-10T18:05:00.000Z' };
  const row = { ...toSessionRow('u1', session), completed_at: '2026-11-10T18:00:00+00:00', updated_at: '2026-11-10T18:05:00+00:00' };
  assertEqual(fromSessionRow(row), session);
});
test('store: la migración añade marcas de tiempo para sincronizar', () => {
  const v2 = { version: 2, profile: { name: 'Ana', signedAt: '2026-11-01T00:00:00.000Z' }, sessions: [{ id: 'a', date: '2026-11-02', type: 'core', completedAt: '2026-11-02T18:00:00.000Z' }] };
  const state = migrate(v2);
  assertEqual(state.settingsUpdatedAt, '2026-11-01T00:00:00.000Z');
  assertEqual(state.sessions[0].updatedAt, '2026-11-02T18:00:00.000Z');
});

/* ---------- Motor de sincronización ---------- */
test('sync: sin configuración queda desactivada y no carga nada', async () => {
  let loaded = false;
  const store = createStore({ storage: memoryStorage() });
  const sync = createSync({ store, configured: false, loadClient: async () => (loaded = true) });
  await sync.start();
  assertEqual(sync.getStatus().phase, 'disabled');
  assert(!loaded, 'no debe descargar el SDK');
});
test('sync: en un dispositivo nuevo, entrar recupera pacto e historial', async () => {
  const client = fakeSupabase({ profiles: [remoteProfile()], sessions: [remoteSession('r1'), remoteSession('r2', { date: '2026-11-11' })] });
  const { store, sync } = await setup(client);
  assertEqual(sync.getStatus().phase, 'signed-out');

  await sync.requestCode('ana@example.com');
  await sync.verifyCode('ana@example.com', '123456');

  const state = store.getState();
  assertEqual(state.profile.name, 'Ana (nube)');
  assertEqual(state.preferences.workoutType, 'yoga');
  assertEqual(state.sessions.map((s) => s.id), ['r1', 'r2']);
  assertEqual(sync.getStatus().phase, 'synced');
  assert(!client.calls.some((c) => c.startsWith('upsert')), 'no debe re-subir lo que ya está en la nube');
});
test('sync: al entrar sube el progreso local y luego solo lo nuevo', async () => {
  const client = fakeSupabase();
  const { store, sync } = await setup(client, (s) => {
    s.actions.signPact(PACT);
    s.actions.logSession({ date: '2026-11-15', type: 'core', mode: 'full', minutes: 10 });
  });
  await sync.verifyCode('ana@example.com', '123456');
  assertEqual(client.db.profiles.length, 1);
  assertEqual(client.db.sessions.length, 1);
  assertEqual(client.db.profiles[0].profile.name, 'Ana');

  client.calls.length = 0;
  const id = store.actions.logSession({ date: '2026-11-16', type: 'yoga', mode: 'minimo', minutes: 2 });
  store.actions.rateSession(id, 'bien');
  await tick();
  await sync.settled();
  assertEqual(client.calls, ['upsert:sessions:1'], 'solo la sesión nueva');
  assertEqual(client.db.sessions.find((r) => r.id === id).feeling, 'bien');
});
test('sync: cambiar el recordatorio no programa una subida a la nube', async () => {
  const client = fakeSupabase();
  const { store, sync } = await setup(client, (s) => s.actions.signPact(PACT));
  await sync.verifyCode('ana@example.com', '123456');
  client.calls.length = 0;
  const lastSyncedAt = sync.getStatus().lastSyncedAt;

  store.actions.setReminder({ enabled: true, time: '20:00' });
  await tick();
  await sync.settled();

  assertEqual(client.calls, []);
  assertEqual(sync.getStatus().lastSyncedAt, lastSyncedAt);
});
test('sync: un código incorrecto da un error legible', async () => {
  const { sync } = await setup(fakeSupabase());
  let message = '';
  try {
    await sync.verifyCode('ana@example.com', '000000');
  } catch (error) {
    message = error.message;
  }
  assertEqual(message, 'El código no es válido o ya expiró.');
  assert(!sync.isSignedIn());
});
test('sync: borrar la cuenta llama a delete_my_account y cierra sesión', async () => {
  const client = fakeSupabase({ profiles: [remoteProfile()], session: { user: { id: 'u1', email: 'ana@example.com' } } });
  const { sync } = await setup(client);
  assert(sync.isSignedIn(), 'la sesión guardada se restaura al iniciar');
  await sync.deleteAccount();
  assert(client.calls.includes('rpc:delete_my_account'));
  assert(!sync.isSignedIn());
  assertEqual(sync.getStatus().phase, 'signed-out');
});
