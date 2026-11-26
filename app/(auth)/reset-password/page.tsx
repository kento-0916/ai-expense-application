import { updatePassword } from './actions';

type Props = { searchParams: Promise<{ error?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return <main className="auth-page"><section className="auth-card"><div className="brand"><span>¥</span> 経費申請</div><p className="eyebrow">PASSWORD RESET</p><h1>新しいパスワードを設定</h1><p className="lead">8文字以上の新しいパスワードを入力してください。</p>
    {params.error && <p className="notice error">{params.error}</p>}
    <form action={updatePassword} className="auth-form"><label>新しいパスワード<input name="password" type="password" minLength={8} autoComplete="new-password" required /><small>8文字以上で入力してください。</small></label><label>新しいパスワード（確認）<input name="password_confirmation" type="password" minLength={8} autoComplete="new-password" required /></label><button className="primary" type="submit">パスワードを更新</button></form>
  </section></main>;
}
