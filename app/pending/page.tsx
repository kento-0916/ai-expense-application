import Link from 'next/link';

export default function PendingPage() {
  return <main className="status-page"><section><div className="status-icon">◷</div><p className="eyebrow">ACCOUNT PENDING</p><h1>承認をお待ちください</h1><p>利用登録を受け付けました。管理者の承認後に経費申請を利用できます。</p><Link className="secondary" href="/login">ログイン画面へ戻る</Link></section></main>;
}
