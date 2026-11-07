'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function withMessage(key: 'error' | 'message', message: string) {
  return `/admin/account-requests?${key}=${encodeURIComponent(message)}`;
}

async function processRequest(formData: FormData, nextStatus: 'active' | 'suspended') {
  const profileId = String(formData.get('profile_id') ?? '');
  if (!profileId) redirect(withMessage('error', '対象のログイン申請を確認できませんでした。'));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const actorId = claims?.claims?.sub;
  if (typeof actorId !== 'string') redirect('/login');

  const { data: actor } = await supabase.from('profiles').select('app_role,account_status').eq('id', actorId).maybeSingle();
  if (!actor || actor.account_status !== 'active' || !['accounting', 'president'].includes(actor.app_role)) redirect(withMessage('error', 'ログイン申請を処理する権限がありません。'));

  const { data: updated, error } = await supabase.from('profiles').update({ account_status: nextStatus, updated_at: new Date().toISOString() }).eq('id', profileId).eq('account_status', 'pending').select('id').maybeSingle();
  if (error || !updated) redirect(withMessage('error', 'この申請はすでに処理済みか、更新できませんでした。'));

  revalidatePath('/admin/account-requests');
  revalidatePath('/dashboard');
  redirect(withMessage('message', nextStatus === 'active' ? 'ログイン申請を承認しました。' : 'ログイン申請を拒否しました。'));
}

export async function approveLoginRequest(formData: FormData) { await processRequest(formData, 'active'); }
export async function rejectLoginRequest(formData: FormData) { await processRequest(formData, 'suspended'); }
