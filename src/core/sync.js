/**
 * Sincronización con la nube (local-first).
 *
 * - localStorage sigue siendo la fuente inmediata: la app nunca espera a la red.
 * - Al iniciar sesión (y al volver a la app o recuperar conexión) se descarga lo de la
 *   nube, se fusiona con lo local (domain/merge.js) y se sube lo que falte.
 * - Cada cambio del store se sube con un pequeño retraso (debounce), solo lo modificado.
 * - El cliente de Supabase se inyecta (`loadClient`) para poder testear sin red.
 *
 * Nota: al cerrar sesión los datos siguen en este dispositivo; si luego se inicia sesión
 * con otra cuenta, se fusionan con ella.
 */
import { mergeState } from '../domain/merge.js';

const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 500;
const PULL_THROTTLE_MS = 60_000;
const SESSION_COLUMNS = 'id,date,type,mode,minutes,feeling,completed_at,updated_at';

const iso = (value) => (value ? new Date(value).toISOString() : null);

/* ---------- Mapeo estado ↔ filas ---------- */

export const toSessionRow = (userId, s) => ({
  user_id: userId,
  id: s.id,
  date: s.date,
  type: s.type ?? null,
  mode: s.mode ?? null,
  minutes: s.minutes ?? null,
  feeling: s.feeling ?? null,
  completed_at: s.completedAt ?? null,
  updated_at: s.updatedAt,
});

export function fromSessionRow(row) {
  const session = {
    id: row.id,
    date: row.date,
    type: row.type,
    mode: row.mode,
    minutes: row.minutes === null ? null : Number(row.minutes),
    completedAt: iso(row.completed_at),
    updatedAt: iso(row.updated_at),
  };
  if (row.feeling) session.feeling = row.feeling;
  return session;
}

export const toProfileRow = (userId, state) => ({
  user_id: userId,
  profile: state.profile,
  preferences: state.preferences,
  updated_at: state.settingsUpdatedAt ?? new Date().toISOString(),
});

export const fromProfileRow = (row) =>
  row ? { profile: row.profile, preferences: row.preferences ?? {}, settingsUpdatedAt: iso(row.updated_at) } : null;

/* ---------- Errores legibles ---------- */

function friendlyError(error, fallback = 'Algo salió mal. Inténtalo de nuevo.') {
  const message = String(error?.message ?? '');
  if (error?.status === 429 || /rate limit|security purposes/i.test(message)) {
    return 'Espera un minuto antes de pedir otro código.';
  }
  if (/expired|invalid/i.test(message) && /token|otp|code/i.test(message)) return 'El código no es válido o ya expiró.';
  if (/fetch|network|load failed/i.test(message)) return 'No pudimos conectar. Revisa tu conexión.';
  return fallback;
}

const throwFriendly = (error, fallback) => {
  const friendly = new Error(friendlyError(error, fallback));
  friendly.cause = error;
  throw friendly;
};

/* ---------- Motor ---------- */

/**
 * @param {object} options
 * @param {ReturnType<import('./store.js').createStore>} options.store
 * @param {boolean} options.configured  si hay credenciales de Supabase
 * @param {() => Promise<any>} options.loadClient  devuelve el cliente de Supabase
 */
export function createSync({ store, configured, loadClient, debounceMs = 1500, redirectTo }) {
  const win = globalThis.window;
  const listeners = new Set();
  let status = { phase: configured ? 'loading' : 'disabled', email: null, lastSyncedAt: null, error: null };

  let client = null;
  let user = null;
  /** id de sesión → updatedAt ya presente en la nube. */
  let pushedSessions = new Map();
  let pushedSettingsAt;
  let pushTimer = null;
  let lastPullAt = 0;
  let chain = Promise.resolve();
  let observedState = store.getState();

  const isOffline = () => globalThis.navigator?.onLine === false;

  function update(patch) {
    status = { ...status, ...patch };
    listeners.forEach((listener) => listener(status));
  }

  /** Ejecuta las tareas de red de una en una (evita subidas cruzadas). */
  function enqueue(task) {
    chain = chain.catch(() => {}).then(task);
    return chain;
  }

  function fail(error) {
    console.warn('[brasa] Error de sincronización.', error);
    update({ phase: isOffline() ? 'offline' : 'error', error: friendlyError(error, 'No se pudo sincronizar.') });
  }

  async function fetchAllSessions() {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from('sessions')
        .select(SESSION_COLUMNS)
        .eq('user_id', user.id)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  async function push() {
    if (!user) return;
    const state = store.getState();
    const userId = user.id;

    if (state.profile && state.settingsUpdatedAt !== pushedSettingsAt) {
      const { error } = await client.from('profiles').upsert(toProfileRow(userId, state), { onConflict: 'user_id' });
      if (error) throw error;
      pushedSettingsAt = state.settingsUpdatedAt;
    }

    const dirty = state.sessions.filter((s) => pushedSessions.get(s.id) !== s.updatedAt);
    for (let i = 0; i < dirty.length; i += UPSERT_CHUNK) {
      const chunk = dirty.slice(i, i + UPSERT_CHUNK);
      const { error } = await client
        .from('sessions')
        .upsert(chunk.map((s) => toSessionRow(userId, s)), { onConflict: 'user_id,id' });
      if (error) throw error;
      chunk.forEach((s) => pushedSessions.set(s.id, s.updatedAt));
    }
  }

  async function pushTask() {
    if (!user) return;
    if (isOffline()) return update({ phase: 'offline' });
    try {
      update({ phase: 'syncing', error: null });
      await push();
      update({ phase: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (error) {
      fail(error);
    }
  }

  async function fullSyncTask() {
    if (!user) return;
    if (isOffline()) return update({ phase: 'offline' });
    try {
      update({ phase: 'syncing', error: null });
      const [profileResult, sessionRows] = await Promise.all([
        client.from('profiles').select('profile,preferences,updated_at').eq('user_id', user.id).maybeSingle(),
        fetchAllSessions(),
      ]);
      if (profileResult.error) throw profileResult.error;

      const remote = { settings: fromProfileRow(profileResult.data), sessions: sessionRows.map(fromSessionRow) };
      pushedSessions = new Map(remote.sessions.map((s) => [s.id, s.updatedAt]));
      pushedSettingsAt = remote.settings?.settingsUpdatedAt;

      const local = store.getState();
      const merged = mergeState(local, remote);
      const changed =
        merged.profile !== local.profile ||
        merged.sessions.length !== local.sessions.length ||
        merged.sessions.some((s, i) => s !== local.sessions[i]);
      if (changed) store.actions.applyRemote(merged);

      await push();
      lastPullAt = Date.now();
      update({ phase: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (error) {
      fail(error);
    }
  }

  function schedulePush() {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      enqueue(pushTask);
    }, debounceMs);
  }

  function flushPush() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    enqueue(pushTask);
  }

  function onAuthChange(_event, session) {
    const next = session?.user ?? null;
    if (next?.id === user?.id) {
      if (next) {
        user = next;
        update({ email: next.email ?? null });
      }
      return;
    }
    user = next;
    pushedSessions = new Map();
    pushedSettingsAt = undefined;
    clearTimeout(pushTimer);
    pushTimer = null;
    if (user) {
      update({ phase: 'syncing', email: user.email ?? null, error: null });
      // Se encola ya (para que verifyCode pueda esperarla), pero corre fuera del callback:
      // supabase-js recomienda no llamar a su API dentro de onAuthStateChange.
      enqueue(() => new Promise((resolve) => setTimeout(resolve, 0)).then(fullSyncTask));
    } else {
      update({ phase: 'signed-out', email: null, lastSyncedAt: null, error: null });
    }
  }

  function requireClient() {
    if (!client) throw new Error('La nube no está disponible ahora. Revisa tu conexión.');
    return client;
  }

  let started = false;

  return {
    getStatus: () => status,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start() {
      if (!configured || client) return;
      try {
        update({ phase: 'loading', error: null });
        client = await loadClient();
      } catch (error) {
        fail(error);
        win?.addEventListener('online', () => this.start(), { once: true });
        return;
      }
      if (!client) return update({ phase: 'disabled' });
      if (started) return;
      started = true;

      update({ phase: 'signed-out' });
      client.auth.onAuthStateChange(onAuthChange);
      store.subscribe((nextState) => {
        const syncableChanged =
          nextState.profile !== observedState.profile ||
          nextState.preferences !== observedState.preferences ||
          nextState.settingsUpdatedAt !== observedState.settingsUpdatedAt ||
          nextState.sessions !== observedState.sessions;
        observedState = nextState;
        if (syncableChanged) schedulePush();
      });

      win?.addEventListener('online', () => enqueue(fullSyncTask));
      win?.document?.addEventListener('visibilitychange', () => {
        if (win.document.visibilityState === 'hidden') flushPush();
        else if (Date.now() - lastPullAt > PULL_THROTTLE_MS) enqueue(fullSyncTask);
      });
    },

    syncNow: () => enqueue(fullSyncTask),

    /** Envía un correo con un código de 6 dígitos (y un enlace) para entrar. */
    async requestCode(email) {
      const { error } = await requireClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
      });
      if (error) throwFriendly(error, 'No pudimos enviar el correo.');
    },

    async verifyCode(email, token) {
      const { error } = await requireClient().auth.verifyOtp({ email, token, type: 'email' });
      if (error) throwFriendly(error, 'No pudimos verificar el código.');
      await chain.catch(() => {});
    },

    /** Espera a que termine la sincronización en curso. */
    settled: () => chain.catch(() => {}),

    async signOut() {
      flushPush();
      await chain.catch(() => {});
      await requireClient().auth.signOut({ scope: 'local' });
    },

    /** Borra la cuenta y todos sus datos en la nube (los datos locales los borra quien llama). */
    async deleteAccount() {
      const c = requireClient();
      if (!user) return;
      clearTimeout(pushTimer);
      pushTimer = null;
      await chain.catch(() => {});
      const { error } = await c.rpc('delete_my_account');
      if (error) throwFriendly(error, 'No se pudo borrar tu cuenta en la nube.');
      await c.auth.signOut({ scope: 'local' });
    },

    isSignedIn: () => Boolean(user),
  };
}
