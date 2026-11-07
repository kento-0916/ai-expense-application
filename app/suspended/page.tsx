import Link from 'next/link';

export default function SuspendedPage() {
  return <main className="status-page"><section><div className="status-icon suspended">!</div><p className="eyebrow">ACCOUNT SUSPENDED</p><h1>アカウントは停止中です</h1><p>現在、業務機能は利用できません。お手数ですが管理者へお問い合わせください。</p><Link className="secondary" href="/login">ログイン画面へ戻る</Link></section></main>;
}
