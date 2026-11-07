'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { jobTypes } from '@/types/profile';

export async function register(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const jobType = String(formData.get('job_type') ?? '');
  if (!fullName || !email || password.length < 8 || !jobTypes.includes(jobType as (typeof jobTypes)[number])) {
    redirect(`/register?error=${encodeURIComponent('すべての項目を正しく入力してください。パスワードは8文字以上です。')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, job_type: jobType } },
  });
  if (error) redirect(`/register?error=${encodeURIComponent('登録に失敗しました。メールアドレスをご確認ください。')}`);
  redirect(`/login?message=${encodeURIComponent('登録を受け付けました。承認されるまで業務機能は利用できません。')}`);
}
