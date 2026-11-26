import Link from 'next/link';
import { requestPasswordReset } from './actions';

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return <main className="auth-page"><section className="auth-card"><div className="brand"><span>¥</span> 経費申請</div><p className="eyebrow">PASSWORD RESET</p><h1>パスワードを再設定</h1><p className="lead">登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。</p>
    {params.error && <p className="notice error">{params.error}</p>}{params.message && <p className="notice">{params.message}</p>}
    <form action={requestPasswordReset} className="auth-form"><label>メールアドレス<input name="email" type="email" autoComplete="email" required /></label><button className="primary" type="submit">再設定メールを送信</button></form>
    <p className="auth-footer"><Link href="/login">ログインへ戻る</Link></p>
  </section></main>;
}
