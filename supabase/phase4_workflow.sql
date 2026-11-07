-- Phase 4: receipt-level review, approval, settlement and immutable history.

alter table public.expense_receipts
  drop constraint if exists expense_receipts_status_check;

alter table public.expense_receipts
  add constraint expense_receipts_status_check
  check (status in ('draft', 'submitted', 'accounting_approved', 'final_approved', 'settled', 'returned', 'rejected', 'correction_in_progress'));

alter table public.expense_receipts
  add column if not exists submitted_at timestamptz,
  add column if not exists accounting_approved_at timestamptz,
  add column if not exists final_approved_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists rejected_at timestamptz;

create table if not exists public.receipt_workflow_events (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.expense_receipts(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('submitted', 'accounting_approved', 'final_approved', 'returned', 'rejected', 'settled')),
  from_status text not null,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now(),
  check ((action in ('returned', 'rejected') and char_length(trim(coalesce(reason, ''))) between 1 and 500) or action not in ('returned', 'rejected'))
);

create index if not exists receipt_workflow_events_receipt_created_idx
  on public.receipt_workflow_events (receipt_id, created_at desc);
create index if not exists receipt_workflow_events_actor_id_idx
  on public.receipt_workflow_events (actor_id);

grant select on public.receipt_workflow_events to authenticated;
alter table public.receipt_workflow_events enable row level security;

create policy "workflow_events_select_application_access"
on public.receipt_workflow_events for select to authenticated
using (exists (
  select 1
  from public.expense_receipts r
  join public.expense_applications a on a.id = r.application_id
  where r.id = receipt_id
    and (((select auth.uid()) = a.applicant_id and (select private.is_active_user())) or (select private.is_admin()))
));

create policy "receipts_update_own_returned"
on public.expense_receipts for update to authenticated
using (exists (
  select 1 from public.expense_applications a
  where a.id = application_id
    and a.applicant_id = (select auth.uid())
    and status = 'submitted'
    and (select private.is_active_user())
) and status = 'returned')
with check (status = 'returned' and exists (
  select 1 from public.expense_applications a
  where a.id = application_id
    and a.applicant_id = (select auth.uid())
    and status = 'submitted'
    and (select private.is_active_user())
));

create policy "attachments_insert_own_returned_receipt"
on public.receipt_attachments for insert to authenticated
with check (exists (
  select 1
  from public.expense_receipts r
  join public.expense_applications a on a.id = r.application_id
  where r.id = receipt_id
    and r.status = 'returned'
    and a.applicant_id = (select auth.uid())
    and (select private.is_active_user())
));

create or replace function public.transition_receipt_status(
  p_receipt_id uuid,
  p_action text,
  p_reason text default null
)
returns public.expense_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_receipt public.expense_receipts;
  v_applicant_id uuid;
  v_from_status text;
  v_next_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_actor_id is null then
    raise exception '認証が必要です';
  end if;

  select app_role into v_actor_role
  from public.profiles
  where id = v_actor_id and account_status = 'active';

  if v_actor_role is null then
    raise exception 'このアカウントは業務操作できません';
  end if;

  select * into v_receipt
  from public.expense_receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception '領収書が見つかりません';
  end if;
  select applicant_id into v_applicant_id
  from public.expense_applications
  where id = v_receipt.application_id;
  v_from_status := v_receipt.status;

  if p_action in ('return', 'reject') and v_reason is null then
    raise exception '差戻し・却下には理由が必要です';
  end if;

  case p_action
    when 'submit' then
      if v_actor_id <> v_applicant_id or v_receipt.status not in ('draft', 'returned') then
        raise exception 'この領収書は提出できません';
      end if;
      v_next_status := 'submitted';
    when 'accounting_approve' then
      if v_actor_role <> 'accounting' or v_receipt.status <> 'submitted' then
        raise exception '経理一次承認の対象ではありません';
      end if;
      v_next_status := 'accounting_approved';
    when 'final_approve' then
      if v_actor_role <> 'president' or v_receipt.status <> 'accounting_approved' then
        raise exception '最終承認の対象ではありません';
      end if;
      v_next_status := 'final_approved';
    when 'settle' then
      if v_actor_role <> 'accounting' or v_receipt.status <> 'final_approved' then
        raise exception '精算の対象ではありません';
      end if;
      v_next_status := 'settled';
    when 'return' then
      if not ((v_actor_role = 'accounting' and v_receipt.status = 'submitted') or (v_actor_role = 'president' and v_receipt.status = 'accounting_approved')) then
        raise exception '差戻しの対象ではありません';
      end if;
      v_next_status := 'returned';
    when 'reject' then
      if not ((v_actor_role = 'accounting' and v_receipt.status = 'submitted') or (v_actor_role = 'president' and v_receipt.status = 'accounting_approved')) then
        raise exception '却下の対象ではありません';
      end if;
      v_next_status := 'rejected';
    else
      raise exception '不正な処理です';
  end case;

  update public.expense_receipts
  set status = v_next_status,
      submitted_at = case when v_next_status = 'submitted' then now() else submitted_at end,
      accounting_approved_at = case when v_next_status = 'accounting_approved' then now() else accounting_approved_at end,
      final_approved_at = case when v_next_status = 'final_approved' then now() else final_approved_at end,
      settled_at = case when v_next_status = 'settled' then now() else settled_at end,
      returned_at = case when v_next_status = 'returned' then now() else returned_at end,
      rejected_at = case when v_next_status = 'rejected' then now() else rejected_at end,
      updated_at = now()
  where id = v_receipt.id
  returning * into v_receipt;

  if v_next_status = 'submitted' then
    update public.expense_applications
    set status = 'submitted', submitted_at = coalesce(submitted_at, now()), updated_at = now()
    where id = v_receipt.application_id;
  end if;

  insert into public.receipt_workflow_events (receipt_id, actor_id, action, from_status, to_status, reason)
  values (
    v_receipt.id,
    v_actor_id,
    case v_next_status
      when 'submitted' then 'submitted'
      when 'accounting_approved' then 'accounting_approved'
      when 'final_approved' then 'final_approved'
      when 'returned' then 'returned'
      when 'rejected' then 'rejected'
      when 'settled' then 'settled'
    end,
    v_from_status,
    v_next_status,
    v_reason
  );

  return v_receipt;
end;
$$;

-- Keep the function callable only by signed-in users. It performs the role and state checks itself.
revoke all on function public.transition_receipt_status(uuid, text, text) from public;
revoke execute on function public.transition_receipt_status(uuid, text, text) from anon;
grant execute on function public.transition_receipt_status(uuid, text, text) to authenticated;
