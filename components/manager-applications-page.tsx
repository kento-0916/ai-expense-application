'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Profile } from '@/types/profile';
import { signOut } from '@/app/dashboard/actions';

type Attachment = { original_filename: string; mime_type: string; signed_url: string | null };
type Receipt = { id: string; amount_yen: number; expense_date: string; category: string; purpose: string; status: string; receipt_attachments: Attachment[] };
type Application = { id: string; applicant_id: string; title: string; status: string; created_at: string; expense_receipts: Receipt[] };
type Applicant = { id: string; full_name: string };

const formatDate = (value: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const money = (value: number) => `¥${value.toLocaleString('ja-JP')}`;

function applicationStatus(receipts: Receipt[]) {
  const statuses = receipts.map((receipt) => receipt.status);
  if (statuses.includes('returned')) return { label: '差戻し', tone: 'returned' };
  if (statuses.includes('rejected')) return { label: '却下', tone: 'rejected' };
  if (statuses.includes('settled')) return { label: '精算済み', tone: 'settled' };
  if (statuses.includes('final_approved')) return { label: '振込待ち', tone: 'final_approved' };
  if (statuses.includes('accounting_approved')) return { label: '経理承認済み', tone: 'accounting_approved' };
  if (statuses.includes('submitted')) return { label: '処理中', tone: 'submitted' };
  return { label: '下書き', tone: 'draft' };
}

export function ManagerApplicationsPage({ profile, applications, applicants }: { profile: Profile; applications: Application[]; applicants: Applicant[] }) {
  const [query, setQuery] = useState('');
  const [applicantId, setApplicantId] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const applicantById = useMemo(() => new Map(applicants.map((applicant) => [applicant.id, applicant.full_name])), [applicants]);
  const numberById = useMemo(() => new Map(applications.map((application, index) => [application.id, index + 1])), [applications]);
  const normalizedQuery = query.trim().toLocaleLowerCase('ja-JP');
  const visibleApplications = useMemo(() => applications.filter((application) => {
    const summary = applicationStatus(application.expense_receipts);
    const applicant = applicantById.get(application.applicant_id) ?? '';
    return (applicantId === 'all' || application.applicant_id === applicantId)
      && (status === 'all' || summary.tone === status)
      && (!normalizedQuery || [application.title, applicant, String(numberById.get(application.id) ?? '')].some((value) => value.toLocaleLowerCase('ja-JP').includes(normalizedQuery)));
  }), [applicantById, applicantId, applications, normalizedQuery, numberById, status]);
  const selected = visibleApplications.find((application) => application.id === selectedId) ?? visibleApplications[0];

  return <main className="manager-shell">
    <aside className="manager-nav">
      <Link className="manager-brand" href="/dashboard"><span aria-hidden>▣</span> 管理者</Link>
      <nav aria-label="管理者メニュー">
        <Link className="manager-nav-link" href="/dashboard"><span aria-hidden>▧</span>経費申請</Link>
        <Link className="manager-nav-link active" href="/admin/applications"><span aria-hidden>☷</span>申請一覧</Link>
        <Link className="manager-nav-link" href="/admin/approvals"><span aria-hidden>☑</span>承認管理</Link>
        <Link className="manager-nav-link" href="/admin/account-requests"><span aria-hidden>◷</span>ログイン申請</Link>
        <Link className="manager-nav-link" href="/admin/reports"><span aria-hidden>▥</span>集計</Link>
      </nav>
      <div className="manager-user"><span>{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>{profile.app_role === 'president' ? '社長' : '経理担当'}</small></div><form action={signOut}><button title="ログアウト" aria-label="ログアウト">↪</button></form></div>
    </aside>
    <section className="manager-content manager-applications-content">
      <header className="manager-header"><div><p className="eyebrow">APPLICATION REVIEW</p><h1>申請一覧・内容確認</h1></div><div><Link className="manager-new-button" href="/applications/new">＋ 新しい申請</Link><Link href="/dashboard">経費申請へ</Link><form action={signOut}><button>ログアウト</button></form></div></header>
      <p className="manager-page-lead">社員ごとの申請内容と添付領収書を、その場で照合できます。</p>
      <div className="manager-application-tools" aria-label="申請一覧の絞り込み">
        <label><span>検索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="申請名・社員名・申請番号" aria-label="申請名・社員名・申請番号で検索" /></label>
        <label><span>社員</span><select value={applicantId} onChange={(event) => setApplicantId(event.target.value)} aria-label="社員で絞り込む"><option value="all">すべての社員</option>{applicants.map((applicant) => <option key={applicant.id} value={applicant.id}>{applicant.full_name}</option>)}</select></label>
        <label><span>状況</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="申請状況で絞り込む"><option value="all">すべて</option><option value="submitted">処理中</option><option value="accounting_approved">経理承認済み</option><option value="final_approved">振込待ち</option><option value="returned">差戻し</option><option value="settled">精算済み</option></select></label>
      </div>
      <div className="manager-application-review-layout">
        <section className="manager-application-list" aria-label="社員別の申請一覧">
          <div className="manager-list-heading"><div><h2>申請一覧</h2><p>{visibleApplications.length}件を表示</p></div><span>社員・申請内容・金額</span></div>
          <div className="manager-application-cards">
            {visibleApplications.map((application) => { const total = application.expense_receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0); const summary = applicationStatus(application.expense_receipts); const number = numberById.get(application.id) ?? 0; return <button type="button" key={application.id} className={selected?.id === application.id ? 'selected' : ''} aria-pressed={selected?.id === application.id} onClick={() => setSelectedId(application.id)}><span className="application-card-number">申請-{String(number).padStart(3, '0')}</span><div><b>{application.title}</b><p>{applicantById.get(application.applicant_id) ?? '申請者未設定'}　／　{formatDate(application.created_at)}</p></div><strong>{money(total)}</strong><i className={`status-pill ${summary.tone}`}>{summary.label}</i></button>; })}
            {!visibleApplications.length && <p className="manager-empty">条件に一致する申請はありません。</p>}
          </div>
        </section>
        <aside className="manager-application-review-detail">
          {selected ? <><header><div><p className="eyebrow">APPLICATION DETAIL</p><h2>申請-{String(numberById.get(selected.id) ?? 0).padStart(3, '0')}</h2><p>{applicantById.get(selected.applicant_id) ?? '申請者未設定'} が申請</p></div><Link href={`/applications/${selected.id}`}>詳細画面を開く　›</Link></header>
            <section className="manager-application-summary"><div><span>申請名</span><b>{selected.title}</b></div><div><span>申請日</span><b>{formatDate(selected.created_at)}</b></div><div><span>合計金額</span><strong>{money(selected.expense_receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0))}</strong></div></section>
            <section className="manager-review-receipts"><h3>領収書と入力内容を確認</h3><p>添付画像とAI読取後の入力値を照合してください。</p>{selected.expense_receipts.map((receipt, index) => { const attachment = receipt.receipt_attachments[0]; const image = attachment?.mime_type.startsWith('image/'); return <article key={receipt.id}><div className="manager-large-receipt">{image && attachment?.signed_url ? <a href={attachment.signed_url} target="_blank" rel="noreferrer"><img src={attachment.signed_url} alt={`領収書${index + 1}の添付画像`} /></a> : attachment?.signed_url ? <a className="manager-pdf-link" href={attachment.signed_url} target="_blank" rel="noreferrer">PDF領収書を開く</a> : <span>添付画像なし</span>}</div><div className="manager-receipt-check"><div className="receipt-check-heading"><b>領収書 {index + 1}</b><i className={`status-pill ${receipt.status}`}>{applicationStatus([receipt]).label}</i></div><dl><div><dt>添付ファイル</dt><dd>{attachment?.original_filename ?? 'なし'}</dd></div><div><dt>日付</dt><dd>{formatDate(receipt.expense_date)}</dd></div><div><dt>金額</dt><dd>{money(receipt.amount_yen)}</dd></div><div><dt>経費分類</dt><dd>{receipt.category}</dd></div><div><dt>用途</dt><dd>{receipt.purpose}</dd></div></dl></div></article>; })}</section>
          </> : <div className="manager-detail-empty"><h2>申請を選択してください</h2><p>社員別の申請一覧から選ぶと、添付領収書と入力項目を確認できます。</p></div>}
        </aside>
      </div>
    </section>
  </main>;
}
