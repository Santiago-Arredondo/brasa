/**
 * Fusión de datos locales y de la nube (lógica pura, sin red).
 *
 * - Sesiones: unión por id; si ambas copias existen gana la de `updatedAt` más reciente
 *   (p. ej. la que tiene la valoración "¿cómo te sentiste?").
 * - Ajustes (pacto + preferencias): gana el bloque editado más recientemente.
 * - El recordatorio NO se sincroniza: depende del permiso de notificaciones de cada dispositivo.
 */

const isNewer = (a, b) => (a ?? '') > (b ?? '');

const sessionOrder = (a, b) =>
  (a.date ?? '').localeCompare(b.date ?? '') || (a.completedAt ?? '').localeCompare(b.completedAt ?? '');

export function mergeSessions(local = [], remote = []) {
  const byId = new Map(remote.map((s) => [s.id, s]));
  for (const session of local) {
    const other = byId.get(session.id);
    // En empate se conserva la copia local (mismo objeto → el store no cambia sin necesidad).
    if (!other || !isNewer(other.updatedAt, session.updatedAt)) byId.set(session.id, session);
  }
  return [...byId.values()].sort(sessionOrder);
}

/** @param {{profile, preferences, settingsUpdatedAt}} local  @param {typeof local | null} remote */
export function mergeSettings(local, remote) {
  if (!remote?.profile) return local;
  if (!local.profile || isNewer(remote.settingsUpdatedAt, local.settingsUpdatedAt)) {
    return {
      profile: remote.profile,
      preferences: { ...local.preferences, ...remote.preferences },
      settingsUpdatedAt: remote.settingsUpdatedAt,
    };
  }
  return local;
}

/** Devuelve solo las partes sincronizables del estado ya fusionadas. */
export function mergeState(local, remote) {
  const settings = mergeSettings(
    { profile: local.profile, preferences: local.preferences, settingsUpdatedAt: local.settingsUpdatedAt },
    remote.settings,
  );
  return { ...settings, sessions: mergeSessions(local.sessions, remote.sessions) };
}
