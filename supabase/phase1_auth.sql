-- Phase 1: accounts, roles and audit foundation.
-- Run against project siitppfzodjdvjuiycdf only.

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 1 and 100),
  job_type text not null check (job_type in ('営業', '企画', '制作', '管理', '経営')),
  app_role text not null default 'employee' check (app_role in ('employee', 'accounting', 'president')),
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('approved', 'suspended', 'reactivated', 'role_changed', 'job_type_changed')),
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_admin_audit_logs_actor_id_idx
  on public.account_admin_audit_logs (actor_id);
create index if not exists account_admin_audit_logs_target_profile_id_idx
  on public.account_admin_audit_logs (target_profile_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, job_type)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '未設定'),
    case
      when new.raw_user_meta_data ->> 'job_type' in ('営業', '企画', '制作', '管理', '経営')
        then new.raw_user_meta_data ->> 'job_type'
      else '管理'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and app_role in ('accounting', 'president')
      and account_status = 'active'
  );
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.account_admin_audit_logs to authenticated;

alter table public.profiles enable row level security;
alter table public.account_admin_audit_logs enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));

create policy "admins_update_profiles"
on public.profiles for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "admins_read_account_audit_logs"
on public.account_admin_audit_logs for select to authenticated
using ((select private.is_admin()));
