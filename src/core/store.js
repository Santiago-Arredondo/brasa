/**
 * Store centralizado con persistencia.
 * - Estado inmutable: cada acción produce un objeto nuevo.
 * - El almacenamiento se inyecta (localStorage por defecto) para poder testear
 *   y, más adelante, cambiarlo por una API sin tocar las vistas.
 * - Esquema versionado: `migrate` adapta datos guardados por versiones anteriores.
 */

export const STORAGE_KEY = 'brasa:v1';
export const SCHEMA_VERSION = 3;

export const initialState = () => ({
  version: SCHEMA_VERSION,
  profile: null,
  sessions: [],
  preferences: { workoutType: null },
  reminder: { enabled: false, time: '19:00' },
  /** Última edición del pacto o las preferencias (para fusionar con la nube). */
  settingsUpdatedAt: null,
});

const sessionTimestamp = (s) => s.updatedAt ?? s.completedAt ?? `${s.date}T00:00:00.000Z`;

export function migrate(data) {
  const base = initialState();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    version: SCHEMA_VERSION,
    sessions: Array.isArray(data.sessions)
      ? data.sessions.map((s) => ({ type: 'funcional', ...s, updatedAt: sessionTimestamp(s) })) // v1 no guardaba el tipo
      : [],
    settingsUpdatedAt: data.settingsUpdatedAt ?? data.profile?.signedAt ?? null,
    preferences: { ...base.preferences, ...data.preferences },
    reminder: { ...base.reminder, ...data.reminder },
  };
}

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createStore({ storage = globalThis.localStorage, key = STORAGE_KEY } = {}) {
  const listeners = new Set();
  let state = load();

  function load() {
    try {
      const raw = storage?.getItem(key);
      return raw ? migrate(JSON.parse(raw)) : initialState();
    } catch (error) {
      console.warn('[brasa] No se pudo leer el estado guardado; se inicia limpio.', error);
      return initialState();
    }
  }

  function persist() {
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn('[brasa] No se pudo guardar el estado.', error);
    }
  }

  function setState(updater) {
    state = updater(state);
    persist();
    listeners.forEach((listener) => listener(state));
  }

  const actions = {
    signPact(profile) {
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        profile: { ...profile, signedAt: now },
        settingsUpdatedAt: now,
      }));
    },

    /** @returns {string} id de la sesión creada */
    logSession({ date, type, mode, minutes }) {
      const id = createId();
      const now = new Date().toISOString();
      setState((s) => ({
        ...s,
        sessions: [...s.sessions, { id, date, type, mode, minutes, completedAt: now, updatedAt: now }],
      }));
      return id;
    },

    rateSession(id, feeling) {
      setState((s) => ({
        ...s,
        sessions: s.sessions.map((session) =>
          session.id === id ? { ...session, feeling, updatedAt: new Date().toISOString() } : session,
        ),
      }));
    },

    setWorkoutType(workoutType) {
      setState((s) => ({
        ...s,
        preferences: { ...s.preferences, workoutType },
        settingsUpdatedAt: new Date().toISOString(),
      }));
    },

    setReminder(patch) {
      setState((s) => ({ ...s, reminder: { ...s.reminder, ...patch } }));
    },

    /** Aplica datos ya fusionados con la nube (ver domain/merge.js). */
    applyRemote({ profile, preferences, settingsUpdatedAt, sessions }) {
      setState((s) => ({ ...s, profile, preferences, settingsUpdatedAt, sessions }));
    },

    reset() {
      setState(() => initialState());
    },
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    actions,
  };
}
