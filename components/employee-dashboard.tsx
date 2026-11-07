import Link from 'next/link';
import type { Profile } from '@/types/profile';
import { signOut } from '@/app/dashboard/actions';
import { deleteDraft, submitApplication } from '@/app/applications/new/actions';

type Receipt = { id: string; amount_yen: number; expense_date: string; category: string; purpose: string; status: string };
type Application = { id: string; title: string; status: string; created_at: string; expense_receipts: Receipt[] };

const receiptStatus = (receipts: Receipt[]) => {
  const statuses = receipts.map((receipt) => receipt.status);
  if (statuses.includes('returned')) return { label: '差戻し', tone: 'returned' };
  if (statuses.includes('rejected')) return { label: '却下', tone: 'rejected' };
  if (statuses.includes('settled')) return { label: '精算済み', tone: 'settled' };
  if (statuses.includes('final_approved') || statuses.includes('accounting_approved')) return { label: '承認済み', tone: 'final_approved' };
  if (statuses.includes('submitted')) return { label: '確認中', tone: 'submitted' };
  return { label: '下書き', tone: 'draft' };
};

const formatDate = (value: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export function EmployeeDashboard({ profile, applications }: { profile: Profile; applications: Application[] }) {
  const allReceipts = applications.flatMap((application) => application.expense_receipts);
  const approved = allReceipts.filter((receipt) => ['accounting_approved', 'final_approved'].includes(receipt.status)).length;
  const returned = allReceipts.filter((receipt) => receipt.status === 'returned').length;
  const settled = allReceipts.filter((receipt) => receipt.status === 'settled').length;
  const selected = applications[0];
  const selectedTotal = selected?.expense_receipts.reduce((total, receipt) => total + receipt.amount_yen, 0) ?? 0;

  return <main className="employee-shell">
    <aside className="employee-nav">
      <Link className="employee-brand" href="/dashboard">経費申請</Link>
      <nav aria-label="社員用メニュー"><Link className="employee-nav-link active" href="/dashboard"><span aria-hidden>▧</span>経費申請</Link><Link className="employee-nav-link" href="/dashboard"><span aria-hidden>☷</span>自分の申請</Link></nav>
      <div className="employee-user"><span>{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>社員</small></div><form action={signOut}><button aria-label="ログアウト" title="ログアウト">↪</button></form></div>
    </aside>
    <section className="employee-content">
      <header className="employee-header"><h1>経費申請</h1><Link className="primary employee-new-button" href="/applications/new"><span aria-hidden>＋</span> 新しい申請</Link></header>
      <div className="employee-layout">
        <section className="employee-list-panel">
          <h2>自分の申請</h2>
          <div className="employee-status-grid">
            <article className="employee-status approved"><p>承認済み</p><strong>✓ {approved}<small>件</small></strong></article>
            <article className="employee-status returned"><p>差戻し</p><strong>↶ {returned}<small>件</small></strong></article>
            <article className="employee-status settled"><p>精算済み</p><strong>▤ {settled}<small>件</small></strong></article>
          </div>
          {applications.length ? <div className="employee-table" role="list">
            <div className="employee-table-head"><span>申請番号</span><span>申請日</span><span>内容</span><span>金額</span><span>ステータス</span></div>
            {applications.map((application, index) => {
              const total = application.expense_receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0);
              const status = receiptStatus(application.expense_receipts);
              return <article className={`employee-table-row ${application.status === 'draft' ? 'has-actions' : ''}`} key={application.id} role="listitem"><Link href={`/applications/${application.id}`}><b>申請-{String(index + 1).padStart(3, '0')}</b><span>{formatDate(application.created_at)}</span><span>{application.title}</span><strong>¥{total.toLocaleString('ja-JP')}</strong><i className={`status-pill ${status.tone}`}>{status.label}</i></Link>{application.status === 'draft' ? <div className="employee-row-actions"><span>下書きは提出前に削除できます</span><form action={submitApplication}><input type="hidden" name="application_id" value={application.id} /><button type="submit">提出</button></form><form action={deleteDraft}><input type="hidden" name="application_id" value={application.id} /><button className="remove" type="submit" aria-label={`${application.title}を削除`}>削除</button></form></div> : null}</article>;
            })}
          </div> : <div className="employee-empty"><b>まだ申請はありません</b><p>領収書を登録して、最初の経費申請を作成しましょう。</p><Link className="primary" href="/applications/new">＋ 新しい申請</Link></div>}
        </section>
        <section className="employee-detail-panel">
          {selected ? <><h2>申請-001</h2><div className="employee-detail-summary"><div><p>申請日　 {formatDate(selected.created_at)}</p><p>内容　　{selected.title}</p></div><strong><small>合計金額</small>¥{selectedTotal.toLocaleString('ja-JP')}</strong></div><div className="employee-progress"><span className="done">✓<small>申請</small></span><i className="done" /><span className={selected.expense_receipts.some((receipt) => ['accounting_approved', 'final_approved', 'settled'].includes(receipt.status)) ? 'done' : ''}>✓<small>承認済み</small></span><i className={selected.expense_receipts.every((receipt) => receipt.status === 'settled') ? 'done' : ''} /><span className={selected.expense_receipts.every((receipt) => receipt.status === 'settled') ? 'done' : ''}>✓<small>精算済み</small></span></div><h3>領収書（{selected.expense_receipts.length}件）</h3><div className="employee-receipts">{selected.expense_receipts.map((receipt, index) => { const status = receiptStatus([receipt]); return <Link href={`/applications/${selected.id}`} key={receipt.id}><span>領収書<br />{String(index + 1).padStart(2, '0')}</span><div><b>{receipt.category}</b><p>{formatDate(receipt.expense_date)}　¥{receipt.amount_yen.toLocaleString('ja-JP')}</p></div><i className={`status-pill ${status.tone}`}>{status.label}</i></Link>; })}</div></> : <div className="employee-detail-empty"><h2>申請の詳細</h2><p>一覧から申請を作成すると、ここで進捗と領収書を確認できます。</p><Link className="primary" href="/applications/new">＋ 新しい申請</Link></div>}
        </section>
      </div>
    </section>
  </main>;
}
