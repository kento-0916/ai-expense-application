'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedActions = new Set(['accounting_approve', 'final_approve', 'return', 'reject', 'settle']);

function withMessage(path: string, key: 'error' | 'message', message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

export async function transitionReceipt(formData: FormData) {
  const receiptId = String(formData.get('receipt_id') ?? '');
  const action = String(formData.get('workflow_action') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  if (!receiptId || !allowedActions.has(action)) redirect(withMessage('/admin/approvals', 'error', '処理内容を確認できませんでした。'));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== 'string') redirect('/login');

  const { error } = await supabase.rpc('transition_receipt_status', {
    p_receipt_id: receiptId,
    p_action: action,
    p_reason: reason || null,
  });
  if (error) redirect(withMessage('/admin/approvals', 'error', '処理できませんでした。最新の状態を確認してからもう一度お試しください。'));

  revalidatePath('/admin/approvals');
  revalidatePath('/dashboard');
  redirect(withMessage('/admin/approvals', 'message', '領収書の状態を更新しました。'));
}
