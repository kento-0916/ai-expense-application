import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const redirectUrl = new URL('/reset-password', url.origin);
  const failureUrl = new URL('/forgot-password', url.origin);

  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error('Missing confirmation token') };

  if (!result.error) {
    return NextResponse.redirect(redirectUrl);
  }

  failureUrl.searchParams.set('error', '再設定リンクが無効か、有効期限が切れています。もう一度メールを送信してください。');
  return NextResponse.redirect(failureUrl);
}
