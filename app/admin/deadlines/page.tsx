import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DeadlinesComingSoon() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== 'string') redirect('/login');

  return <main className="application-page">
    <header className="application-header"><Link className="back-link" href="/dashboard" aria-label="一覧へ戻る">‹</Link><Link className="form-brand" href="/dashboard"><span>¥</span>経費申請</Link><Link className="header-list-link" href="/dashboard">一覧へ戻る</Link></header>
    <section className="detail-layout">
      <div className="detail-title"><p className="eyebrow">COMING SOON</p><h1>提出期限機能</h1><p>この機能は今後実装予定です。</p></div>
      <section className="empty-state"><span aria-hidden>◷</span><h3>提出期限の設定・通知は準備中です</h3><p>現在は経費申請、承認管理、集計機能をご利用いただけます。</p><Link className="primary" href="/dashboard">経費申請へ戻る</Link></section>
    </section>
  </main>;
}
