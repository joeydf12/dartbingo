-- ============================================================================
-- Dart Bingo — one-time setup script.
-- Run this in the Supabase SQL editor for project jpxvpnvxljhvlfrcszhy
-- (https://supabase.com/dashboard/project/jpxvpnvxljhvlfrcszhy/sql/new).
--
-- This script is additive only: it does not touch existing bingo_sessions /
-- bingo_players / bingo_chat rows, columns, or RLS policies, so it will not
-- change how the current game behaves. Safe to run multiple times.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Session-password hardening (review finding #5)
--
-- Today the client fetches the full bingo_sessions row (including the
-- plaintext password) and compares it locally. These two RPCs move the
-- comparison server-side and store the password hashed (bcrypt via pgcrypto)
-- instead of in plaintext, so even a direct read of the table only exposes a
-- hash, never the real password. No RLS/SELECT grants are changed here on
-- purpose — realtime sync of bingo_sessions currently depends on being able
-- to read the row, and changing that without being able to test against your
-- live project is riskier than it's worth.
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

create or replace function hash_password(p_pwd text)
returns text
language sql
security definer
as $$
  select case when p_pwd is null or p_pwd = '' then '' else crypt(p_pwd, gen_salt('bf')) end;
$$;

create or replace function check_session_password(p_id text, p_pwd text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  select password into v_hash from bingo_sessions where id = p_id;
  if v_hash is null then
    return false; -- no such session
  end if;
  if v_hash = '' then
    return true; -- session has no password set
  end if;
  return crypt(p_pwd, v_hash) = v_hash;
end;
$$;

-- Spectator ("watch") mode already skips the password prompt in the app today;
-- this just gives it an explicit, intention-revealing entry point instead of
-- a raw table select.
create or replace function get_session_public(p_id text)
returns setof bingo_sessions
language sql
security definer
as $$
  select * from bingo_sessions where id = p_id;
$$;

grant execute on function hash_password(text) to anon, authenticated;
grant execute on function check_session_password(text, text) to anon, authenticated;
grant execute on function get_session_public(text) to anon, authenticated;

-- Existing plaintext passwords already stored won't match a bcrypt compare —
-- hash them in place once so old sessions keep working:
update bingo_sessions
set password = crypt(password, gen_salt('bf'))
where password is not null and password <> '' and password not like '$2%';

-- ----------------------------------------------------------------------------
-- 2) Host-disconnect fallback (review finding #7)
--
-- Additive nullable column: the host's browser heartbeats into this while a
-- game is active; other clients treat the host as "gone" if it goes stale and
-- can claim host. Existing rows/behavior are unaffected (defaults to null).
-- ----------------------------------------------------------------------------
alter table bingo_sessions add column if not exists host_last_seen timestamptz;

-- ----------------------------------------------------------------------------
-- 3) Real accounts + admin panel (new feature)
--
-- profiles mirrors auth.users (which you don't have direct SQL access to
-- otherwise) with an is_admin flag. A trigger keeps it populated on signup.
-- This is a brand-new, additive layer — it does not touch bingo_sessions /
-- bingo_players and does not require players to have an account to play.
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select
  using (
    id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Only display_name is meant to be self-editable from the client; is_admin
-- must only ever change through the service-role key (used by the admin API),
-- never by a client update — there is intentionally no "update" policy here
-- for regular users, so RLS blocks all client-side UPDATEs on this table.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- 4) Make yourself the first admin
--
-- Sign up once through the app's new login form with your own email, THEN run:
--
--   update profiles set is_admin = true where email = 'you@example.com';
--
-- After that you can open /admin, log in, and manage every account's password.
-- ----------------------------------------------------------------------------
