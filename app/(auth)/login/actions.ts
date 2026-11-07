'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect(`/login?error=${encodeURIComponent('メールアドレスとパスワードを入力してください。')}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent('ログインに失敗しました。入力内容を確認してください。')}`);
  redirect('/dashboard');
}
