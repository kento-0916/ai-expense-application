'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Profile } from '@/types/profile';
import { signOut } from '@/app/dashboard/actions';

type Attachment = { original_filename: string; storage_path: string; mime_type: string; signed_url: string | null };
type Receipt = { id: string; amount_yen: number; expense_date: string; category: string; purpose: string; status: string; receipt_attachments: Attachment[] };
type Application = { id: string; applicant_id: string; title: string; status: string; created_at: string; expense_receipts: Receipt[] };
type Applicant = { id: string; full_name: string };
type StatusFilter = 'all' | 'processing' | 'approved' | 'returned' | 'settled';

const formatDate = (value: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

function receiptStatus(receipts: Receipt[]) {
  const statuses = receipts.map((receipt) => receipt.status);
  if (statuses.includes('returned')) return { label: '差戻し', tone: 'returned' };
  if (statuses.includes('rejected')) return { label: '却下', tone: 'rejected' };
  if (statuses.includes('settled')) return { label: '精算済み', tone: 'settled' };
  if (statuses.includes('final_approved')) return { label: '承認済み', tone: 'final_approved' };
  if (statuses.includes('accounting_approved')) return { label: '経理承認済み', tone: 'accounting_approved' };
  if (statuses.includes('submitted')) return { label: '処理中', tone: 'submitted' };
  return { label: '下書き', tone: 'draft' };
}

export function ManagerDashboard({ profile, applications, applicants }: { profile: Profile; applications: Application[]; applicants: Applicant[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'receipts' | 'application'>('receipts');
  const applicantsById = new Map(applicants.map((applicant) => [applicant.id, applicant.full_name]));
  const receipts = applications.flatMap((application) => application.expense_receipts);
  const approved = receipts.filter((receipt) => ['accounting_approved', 'final_approved'].includes(receipt.status));
  const returned = receipts.filter((receipt) => receipt.status === 'returned');
  const settled = receipts.filter((receipt) => receipt.status === 'settled');
  const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP');
  const matchesStatus = (application: Application) => {
    const statuses = application.expense_receipts.map((receipt) => receipt.status);
    if (statusFilter === 'processing') return statuses.some((status) => ['submitted', 'accounting_approved'].includes(status));
    if (statusFilter === 'approved') return statuses.some((status) => ['accounting_approved', 'final_approved'].includes(status));
    if (statusFilter === 'returned') return statuses.includes('returned');
    if (statusFilter === 'settled') return statuses.includes('settled');
    return true;
  };
  const visibleApplications = applications.filter((application, index) => matchesStatus(application) && (!normalizedQuery || [`申請-${String(index + 1).padStart(3, '0')}`, application.title, applicantsById.get(application.applicant_id) ?? ''].some((value) => value.toLocaleLowerCase('ja-JP').includes(normalizedQuery))));
  const selected = visibleApplications.find((application) => application.id === selectedId) ?? visibleApplications[0];

  return <main className="manager-shell">
    <aside className="manager-nav">
      <Link className="manager-brand" href="/dashboard"><span aria-hidden>▣</span> 管理者</Link>
      <nav aria-label="管理者メニュー">
        <Link className="manager-nav-link active" href="/dashboard"><span aria-hidden>▧</span>経費申請</Link>
        <Link className="manager-nav-link" href="/admin/applications"><span aria-hidden>☷</span>申請一覧</Link>
        <Link className="manager-nav-link" href="/admin/approvals"><span aria-hidden>☑</span>承認管理</Link>
        <Link className="manager-nav-link" href="/admin/account-requests"><span aria-hidden>◷</span>ログイン申請</Link>
        <Link className="manager-nav-link" href="/admin/reports"><span aria-hidden>▥</span>集計</Link>
      </nav>
      <div className="manager-user"><span>{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>{profile.app_role === 'president' ? '社長' : '経理担当'}</small></div><form action={signOut}><button title="ログアウト" aria-label="ログアウト">↪</button></form></div>
    </aside>
    <section className="manager-content">
      <header className="manager-header"><h1>経費申請</h1><div><Link className="manager-new-button" href="/applications/new">＋ 新しい申請</Link><Link href="/notifications">通知</Link><form action={signOut}><button>ログアウト</button></form></div></header>
      <div className="manager-layout">
        <section className="manager-main-panel">
          <section className="manager-summary-grid" aria-label="経費申請の集計">
            <button className={`manager-summary approved ${statusFilter === 'approved' ? 'is-selected' : ''}`} type="button" onClick={() => setStatusFilter('approved')}><p>●　承認済み</p><strong>{approved.length}<small>件</small></strong><b>{money(approved.reduce((total, receipt) => total + receipt.amount_yen, 0))}</b></button>
            <button className={`manager-summary returned ${statusFilter === 'returned' ? 'is-selected' : ''}`} type="button" onClick={() => setStatusFilter('returned')}><p>↶　差戻し</p><strong>{returned.length}<small>件</small></strong><b>{money(returned.reduce((total, receipt) => total + receipt.amount_yen, 0))}</b></button>
            <button className={`manager-summary settled ${statusFilter === 'settled' ? 'is-selected' : ''}`} type="button" onClick={() => setStatusFilter('settled')}><p>▤　精算済み</p><strong>{settled.length}<small>件</small></strong><b>{money(settled.reduce((total, receipt) => total + receipt.amount_yen, 0))}</b></button>
          </section>
          <div className="manager-tools"><label><span aria-hidden>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="申請番号・申請者で検索" aria-label="申請番号・申請者で検索" /></label><label className="manager-status-filter"><span>申請状況</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="申請状況で絞り込む"><option value="all">すべて</option><option value="processing">処理中</option><option value="approved">承認済み</option><option value="returned">差戻し</option><option value="settled">精算済み</option></select></label><Link href="/admin/reports">集計を見る</Link></div>
          <section className="manager-table" id="applications" role="list" aria-label="経費申請一覧"><div className="manager-table-head"><span>申請番号</span><span>申請者</span><span>申請日</span><span>金額</span><span>申請状況</span><span>領収書の状況</span></div>
            {visibleApplications.length ? visibleApplications.map((application, index) => { const total = application.expense_receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0); const status = receiptStatus(application.expense_receipts); return <button className={`manager-table-row ${selected?.id === application.id ? 'is-selected' : ''}`} type="button" onClick={() => { setSelectedId(application.id); setDetailTab('receipts'); }} key={application.id} role="listitem"><b>申請-{String(index + 1).padStart(3, '0')}</b><span>{applicantsById.get(application.applicant_id) ?? '申請者'}</span><span>{formatDate(application.created_at)}</span><strong>{money(total)}</strong><i className={`status-pill ${status.tone}`}>{status.label}</i><span className="manager-receipt-count">領収書 {application.expense_receipts.length}件　›</span></button>; }) : <div className="manager-empty">{applications.length ? '条件に一致する申請はありません。' : '申請はまだありません。社員が提出すると、ここで確認・承認できます。'}</div>}
          </section>
        </section>
        <aside className="manager-detail-panel">
          {selected ? <><div className="manager-detail-head"><div><h2>申請-{String(applications.findIndex((application) => application.id === selected.id) + 1).padStart(3, '0')}</h2><p>{applicantsById.get(selected.applicant_id) ?? '申請者'} ／ {selected.title}</p></div><Link href={`/applications/${selected.id}`} aria-label="申請詳細を開く">›</Link></div><div className="manager-tabs"><button className={detailTab === 'receipts' ? 'active' : ''} type="button" onClick={() => setDetailTab('receipts')}>領収書の状況</button><button className={detailTab === 'application' ? 'active' : ''} type="button" onClick={() => setDetailTab('application')}>申請内容</button></div>{detailTab === 'receipts' ? <><h3>領収書の状況（{selected.expense_receipts.length}件）</h3><div className="manager-receipt-list">{selected.expense_receipts.map((receipt, index) => { const status = receiptStatus([receipt]); return <button type="button" onClick={() => setDetailTab('application')} key={receipt.id}><span>領収書<br />{String(index + 1).padStart(2, '0')}</span><div><b>{receipt.category}</b><small>{formatDate(receipt.expense_date)}　{money(receipt.amount_yen)}</small></div><i className={`status-pill ${status.tone}`}>{status.label}</i></button>; })}</div></> : <section className="manager-application-detail"><h3>申請内容</h3><dl><div><dt>申請者</dt><dd>{applicantsById.get(selected.applicant_id) ?? '申請者未設定'}</dd></div><div><dt>申請日</dt><dd>{formatDate(selected.created_at)}</dd></div><div><dt>申請タイトル</dt><dd>{selected.title}</dd></div></dl><h3>領収書と明細（{selected.expense_receipts.length}件）</h3>{selected.expense_receipts.map((receipt, index) => { const attachment = receipt.receipt_attachments[0]; const isImage = attachment?.mime_type.startsWith('image/'); return <article className="manager-application-receipt" key={receipt.id}>{isImage && attachment?.signed_url ? <a className="receipt-preview" href={attachment.signed_url} target="_blank" rel="noreferrer"><img src={attachment.signed_url} alt={`領収書${index + 1}の画像`} /></a> : attachment?.signed_url ? <a className="receipt-preview pdf-preview" href={attachment.signed_url} target="_blank" rel="noreferrer">PDFを開く</a> : <span className="receipt-preview unavailable">画像なし</span>}<div><b>領収書{index + 1}　{receipt.category}</b><dl><div><dt>日付</dt><dd>{formatDate(receipt.expense_date)}</dd></div><div><dt>金額</dt><dd>{money(receipt.amount_yen)}</dd></div><div><dt>用途</dt><dd>{receipt.purpose}</dd></div><div><dt>状態</dt><dd><span className={`status-pill ${receipt.status}`}>{receiptStatus([receipt]).label}</span></dd></div></dl></div></article>; })}</section>}<Link className="manager-action-link" href="/admin/approvals">承認管理で操作する</Link></> : <div className="manager-detail-empty"><h2>申請の詳細</h2><p>提出された経費申請の領収書と承認状況をここで確認できます。</p><Link className="primary" href="/admin/approvals">承認管理へ</Link></div>}
        </aside>
      </div>
    </section>
  </main>;
}
