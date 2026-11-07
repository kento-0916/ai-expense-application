import Link from 'next/link';
import { register } from './actions';
import { jobTypes } from '@/types/profile';

type Props = { searchParams: Promise<{ error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-card"><div className="brand"><span>¥</span> 経費申請</div><p className="eyebrow">CREATE ACCOUNT</p><h1>利用登録</h1><p className="lead">登録後、管理者の承認で利用を開始できます。</p>{params.error && <p className="notice error">{params.error}</p>}
  <form action={register} className="auth-form"><label>氏名<input name="full_name" autoComplete="name" required /></label><label>メールアドレス<input name="email" type="email" autoComplete="email" required /></label><label>パスワード<input name="password" type="password" minLength={8} autoComplete="new-password" required /><small>8文字以上で入力してください。</small></label><label>職種<select name="job_type" defaultValue="" required><option value="" disabled>選択してください</option>{jobTypes.map((job) => <option key={job}>{job}</option>)}</select></label><button className="primary" type="submit">登録を申請</button></form>
  <p className="auth-footer">すでに登録済みの方は <Link href="/login">ログイン</Link></p></section></main>;
}
