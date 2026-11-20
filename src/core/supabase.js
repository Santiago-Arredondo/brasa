/**
 * Carga perezosa del cliente de Supabase desde CDN (sin build).
 * Solo se descarga si la nube está configurada; el service worker lo guarda en caché.
 */
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

export const isCloudConfigured = (config) => Boolean(config?.url && config?.key);

export async function createSupabaseClient(config) {
  if (!isCloudConfigured(config)) return null;
  const { createClient } = await import(SDK_URL);
  return createClient(config.url, config.key, {
    auth: {
      // PKCE: el enlace del correo vuelve con ?code=… (no con #token, que chocaría con el router por hash).
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'brasa:auth',
    },
  });
}
