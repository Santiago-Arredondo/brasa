-- Brasa · esquema de Supabase
-- Ejecútalo una vez en: Dashboard → SQL Editor → New query → Run.
-- Cada persona solo puede leer y escribir sus propias filas (Row Level Security).

-- ---------- Pacto + preferencias (una fila por usuario) ----------
create table if not exists public.profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  profile     jsonb not null,                 -- { name, goal, level, minutes, why, signedAt }
  preferences jsonb not null default '{}',    -- { workoutType }
  updated_at  timestamptz not null default now()
);

-- ---------- Historial de entrenamientos ----------
create table if not exists public.sessions (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id           text not null,                 -- id generado en el dispositivo
  date         date not null,                 -- día local del entrenamiento (YYYY-MM-DD)
  type         text,
  mode         text,                          -- 'full' | 'minimo'
  minutes      numeric,
  feeling      text,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- Seguridad: cada quien solo ve lo suyo ----------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "profiles: dueño" on public.profiles;
create policy "profiles: dueño" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sessions: dueño" on public.sessions;
create policy "sessions: dueño" on public.sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;

-- ---------- "Borrar todos mis datos": elimina la cuenta (y en cascada sus filas) ----------
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
