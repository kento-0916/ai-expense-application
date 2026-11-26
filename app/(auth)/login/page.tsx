import Link from 'next/link';
import { login } from './actions';

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-card"><div className="brand"><span>¥</span> 経費申請</div><p className="eyebrow">EXPENSE FLOW</p><h1>ログイン</h1><p className="lead">経費の申請・確認を、ひとつの場所で。</p>
    {params.error && <p className="notice error">{params.error}</p>}{params.message && <p className="notice">{params.message}</p>}
    <form action={login} className="auth-form"><label>メールアドレス<input name="email" type="email" autoComplete="email" required /></label><label>パスワード<input name="password" type="password" autoComplete="current-password" required /></label><button className="primary" type="submit">ログイン</button></form>
    <p className="auth-footer"><Link href="/forgot-password">パスワードを忘れた場合</Link></p>
    <p className="auth-footer">初めて利用する方は <Link href="/register">新規登録</Link></p>
  </section></main>;
}
