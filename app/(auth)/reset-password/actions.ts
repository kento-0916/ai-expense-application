'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const passwordConfirmation = String(formData.get('password_confirmation') ?? '');

  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent('パスワードは8文字以上で入力してください。')}`);
  }
  if (password !== passwordConfirmation) {
    redirect(`/reset-password?error=${encodeURIComponent('確認用パスワードが一致しません。')}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/forgot-password?error=${encodeURIComponent('再設定リンクの有効期限が切れています。もう一度メールを送信してください。')}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent('パスワードを更新できませんでした。もう一度お試しください。')}`);
  }

  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent('パスワードを再設定しました。新しいパスワードでログインしてください。')}`);
}
