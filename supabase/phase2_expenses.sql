-- Phase 2: applications, receipts, private attachments and their RLS policies.

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_status = 'active'
  );
$$;

revoke all on function private.is_active_user() from public;
grant execute on function private.is_active_user() to authenticated;

create table if not exists public.expense_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  submitted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.expense_applications(id) on delete cascade,
  expense_date date not null,
  amount_yen integer not null check (amount_yen > 0),
  category text not null check (category in ('交通費', '備品', '印刷', '郵送', '会議室')),
  purpose text not null check (char_length(trim(purpose)) between 1 and 300),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipt_attachments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.expense_receipts(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists expense_applications_applicant_created_idx
  on public.expense_applications (applicant_id, created_at desc);
create index if not exists expense_receipts_application_idx
  on public.expense_receipts (application_id);
create index if not exists receipt_attachments_receipt_idx
  on public.receipt_attachments (receipt_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts', 'expense-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on public.expense_applications to authenticated;
grant select, insert, update, delete on public.expense_receipts to authenticated;
grant select, insert, update, delete on public.receipt_attachments to authenticated;

alter table public.expense_applications enable row level security;
alter table public.expense_receipts enable row level security;
alter table public.receipt_attachments enable row level security;

create policy "applications_select_owner_or_admin"
on public.expense_applications for select to authenticated
using (
  (((select auth.uid()) = applicant_id and (select private.is_active_user())) or (select private.is_admin()))
);
create policy "applications_insert_own_active"
on public.expense_applications for insert to authenticated
with check ((select auth.uid()) = applicant_id and (select private.is_active_user()));
create policy "applications_update_own_draft"
on public.expense_applications for update to authenticated
using ((select auth.uid()) = applicant_id and status = 'draft' and (select private.is_active_user()))
with check ((select auth.uid()) = applicant_id and (select private.is_active_user()));
create policy "applications_delete_own_draft"
on public.expense_applications for delete to authenticated
using ((select auth.uid()) = applicant_id and status = 'draft' and (select private.is_active_user()));

create policy "receipts_select_application_access"
on public.expense_receipts for select to authenticated
using (exists (
  select 1 from public.expense_applications a
  where a.id = application_id
    and (((select auth.uid()) = a.applicant_id and (select private.is_active_user())) or (select private.is_admin()))
));
create policy "receipts_mutate_own_draft_application"
on public.expense_receipts for all to authenticated
using (exists (
  select 1 from public.expense_applications a
  where a.id = application_id and a.applicant_id = (select auth.uid())
    and a.status = 'draft' and (select private.is_active_user())
))
with check (exists (
  select 1 from public.expense_applications a
  where a.id = application_id and a.applicant_id = (select auth.uid())
    and a.status = 'draft' and (select private.is_active_user())
));

create policy "attachments_select_application_access"
on public.receipt_attachments for select to authenticated
using (exists (
  select 1 from public.expense_receipts r
  join public.expense_applications a on a.id = r.application_id
  where r.id = receipt_id
    and (((select auth.uid()) = a.applicant_id and (select private.is_active_user())) or (select private.is_admin()))
));
create policy "attachments_mutate_own_draft_application"
on public.receipt_attachments for all to authenticated
using (exists (
  select 1 from public.expense_receipts r
  join public.expense_applications a on a.id = r.application_id
  where r.id = receipt_id and a.applicant_id = (select auth.uid())
    and a.status = 'draft' and (select private.is_active_user())
))
with check (exists (
  select 1 from public.expense_receipts r
  join public.expense_applications a on a.id = r.application_id
  where r.id = receipt_id and a.applicant_id = (select auth.uid())
    and a.status = 'draft' and (select private.is_active_user())
));

create policy "storage_read_own_or_admin_receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and (((storage.foldername(name))[1] = (select auth.uid()::text) and (select private.is_active_user())) or (select private.is_admin()))
);
create policy "storage_upload_own_receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select private.is_active_user())
);
create policy "storage_delete_own_receipts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select private.is_active_user())
);
