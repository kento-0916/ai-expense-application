-- Phase 5: monthly submission deadlines and in-app notifications.

create table if not exists public.submission_deadlines (
  id uuid primary key default gen_random_uuid(),
  target_month date not null unique check (target_month = date_trunc('month', target_month)::date),
  due_date date not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= target_month - 31 and due_date < target_month + interval '2 months')
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('review_requested', 'final_approval_requested', 'returned', 'rejected', 'final_approved', 'settled', 'deadline_overdue')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 500),
  application_id uuid references public.expense_applications(id) on delete cascade,
  receipt_id uuid references public.expense_receipts(id) on delete cascade,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_recipient_created_idx on public.app_notifications (recipient_id, created_at desc);

grant select, insert, update on public.submission_deadlines to authenticated;
grant select, update on public.app_notifications to authenticated;
alter table public.submission_deadlines enable row level security;
alter table public.app_notifications enable row level security;

create policy "deadlines_select_active_users" on public.submission_deadlines for select to authenticated using ((select private.is_active_user()));
create policy "deadlines_manage_admins" on public.submission_deadlines for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "notifications_select_own" on public.app_notifications for select to authenticated using (recipient_id = (select auth.uid()) and (select private.is_active_user()));
create policy "notifications_mark_own_read" on public.app_notifications for update to authenticated using (recipient_id = (select auth.uid()) and (select private.is_active_user())) with check (recipient_id = (select auth.uid()) and (select private.is_active_user()));

create or replace function private.notify_workflow_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_application_id uuid;
  v_applicant_id uuid;
  v_title text;
  v_body text;
  v_type text;
  v_role text;
begin
  select a.id, a.applicant_id into v_application_id, v_applicant_id
  from public.expense_receipts r join public.expense_applications a on a.id = r.application_id
  where r.id = new.receipt_id;
  if new.to_status = 'submitted' then v_role := 'accounting'; v_type := 'review_requested'; v_title := '経理確認が必要な領収書があります'; v_body := '提出された領収書を確認してください。';
  elsif new.to_status = 'accounting_approved' then v_role := 'president'; v_type := 'final_approval_requested'; v_title := '最終承認が必要な領収書があります'; v_body := '経理承認済みの領収書を確認してください。';
  elsif new.to_status = 'returned' then v_type := 'returned'; v_title := '領収書が差戻しされました'; v_body := coalesce(new.reason, '修正内容を確認して再提出してください。');
  elsif new.to_status = 'rejected' then v_type := 'rejected'; v_title := '領収書が却下されました'; v_body := coalesce(new.reason, '却下理由を確認してください。');
  elsif new.to_status = 'final_approved' then v_type := 'final_approved'; v_title := '領収書が最終承認されました'; v_body := '振込待ちになりました。';
  elsif new.to_status = 'settled' then v_type := 'settled'; v_title := '経費を精算しました'; v_body := '精算が完了しました。';
  else return new;
  end if;
  if v_role is not null then
    insert into public.app_notifications (recipient_id, type, title, body, application_id, receipt_id, dedupe_key)
    select id, v_type, v_title, v_body, v_application_id, new.receipt_id, 'workflow:' || new.id::text || ':' || id::text
    from public.profiles where app_role = v_role and account_status = 'active';
  else
    insert into public.app_notifications (recipient_id, type, title, body, application_id, receipt_id, dedupe_key)
    values (v_applicant_id, v_type, v_title, v_body, v_application_id, new.receipt_id, 'workflow:' || new.id::text || ':' || v_applicant_id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists on_receipt_workflow_event_notify on public.receipt_workflow_events;
create trigger on_receipt_workflow_event_notify after insert on public.receipt_workflow_events for each row execute procedure private.notify_workflow_event();

create or replace function public.refresh_own_overdue_notifications()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_count integer;
begin
  if v_user_id is null or not (select private.is_active_user()) then raise exception '業務操作できません'; end if;
  insert into public.app_notifications (recipient_id, type, title, body, application_id, receipt_id, dedupe_key)
  select v_user_id, 'deadline_overdue', '提出期限を過ぎています', to_char(d.due_date, 'YYYY/MM/DD') || ' が提出期限でした。提出は可能です。', a.id, r.id, 'deadline:' || d.id::text || ':' || r.id::text
  from public.expense_receipts r join public.expense_applications a on a.id = r.application_id join public.submission_deadlines d on d.target_month = date_trunc('month', r.expense_date)::date
  where a.applicant_id = v_user_id and r.status in ('draft', 'returned') and d.due_date < current_date
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.notify_workflow_event() from public;
revoke all on function public.refresh_own_overdue_notifications() from public;
revoke execute on function public.refresh_own_overdue_notifications() from anon;
grant execute on function public.refresh_own_overdue_notifications() to authenticated;
