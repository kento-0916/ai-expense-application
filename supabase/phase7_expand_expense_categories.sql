-- Phase 7: categories supported by AI receipt extraction.
-- Applied to the linked Supabase project as migration: expand_expense_categories.
set lock_timeout = '5s';

alter table public.expense_receipts
  drop constraint if exists expense_receipts_category_check;

alter table public.expense_receipts
  add constraint expense_receipts_category_check
  check (category in ('交通費', '宿泊費', '飲食費', '備品', '通信費', '印刷', '郵送', '会議室', 'その他'));
