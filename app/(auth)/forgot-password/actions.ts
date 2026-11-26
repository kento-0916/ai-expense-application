'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const sentMessage = 'メールアドレスが登録されている場合は、再設定用のメールを送信しました。受信箱をご確認ください。';

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    redirect(`/forgot-password?error=${encodeURIComponent('メールアドレスを入力してください。')}`);
  }

  const origin = (await headers()).get('origin');
  if (origin) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/auth/confirm', origin).toString(),
    });
  }

  // 登録済みかどうかを表示上で区別せず、メールアドレスの推測を防ぎます。
  redirect(`/forgot-password?message=${encodeURIComponent(sentMessage)}`);
}
