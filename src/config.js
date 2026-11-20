/**
 * Configuración de la nube (Supabase). Opcional: si se deja vacía, Brasa funciona
 * solo en este dispositivo, igual que antes.
 *
 * - url: Project Settings → API → Project URL
 * - key: la clave pública "anon" o "publishable". Es pública por diseño: lo que protege
 *   los datos son las políticas RLS de `supabase/schema.sql`. NUNCA pongas aquí la
 *   clave `service_role` ni la `secret`.
 */
export const SUPABASE = {
  url: 'https://zswfgjqvejegzonlkdep.supabase.co',
  key: 'sb_publishable_VBjSVlWbbjNvVuD8RQMpeA_6WOdABEp',
};
