'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function saveDeadline(formData: FormData) {
  const targetMonth = String(formData.get('target_month') ?? '');
  const dueDate = String(formData.get('due_date') ?? '');
  const month = /^\d{4}-\d{2}$/.test(targetMonth) ? `${targetMonth}-01` : '';
  if (!month || !dueDate) redirect('/admin/deadlines?error=対象月と提出期限を入力してください。');
  const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims(); const id = claims?.claims?.sub;
  if (typeof id !== 'string') redirect('/login');
  const { error } = await supabase.from('submission_deadlines').upsert({ target_month: month, due_date: dueDate, created_by: id, updated_at: new Date().toISOString() }, { onConflict: 'target_month' });
  if (error) redirect('/admin/deadlines?error=期限を保存できませんでした。');
  revalidatePath('/admin/deadlines'); revalidatePath('/notifications'); redirect('/admin/deadlines?message=提出期限を保存しました。');
}
