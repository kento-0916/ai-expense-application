import Link from 'next/link';
import { createDraft } from './actions';
import { ReceiptAiForm } from '@/components/receipt-ai-form';

export default async function NewApplication({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="application-page">
      <header className="application-header">
        <Link className="back-link" href="/dashboard" aria-label="申請一覧へ戻る">‹</Link>
        <Link className="form-brand" href="/dashboard"><span>¥</span>経費申請</Link>
        <Link className="header-list-link" href="/dashboard">一覧へ戻る</Link>
      </header>
      <section className="new-application-layout">
        <div className="form-intro"><p className="eyebrow">NEW EXPENSE REQUEST</p><h1>新しい経費申請</h1><p>複数の領収書をまとめて添付すると、AIが画像ごとに内容を読み取ります。確認・修正したあとに下書きとして保存してください。</p></div>
        <div className="mobile-progress" aria-label="申請の手順"><span className="complete">1</span><i/><span className="current">2</span><i/><span>3</span><div><b>撮影・添付</b><b>内容入力</b><b>提出</b></div></div>
        <ReceiptAiForm action={createDraft} error={error} />
      </section>
    </main>
  );
}
