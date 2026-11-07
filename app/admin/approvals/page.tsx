import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/profile';
import { WorkflowActionForm } from '@/components/workflow-action-form';

type Receipt = { id: string; expense_date: string; amount_yen: number; category: string; purpose: string; status: string; receipt_attachments: { original_filename: string }[] };
type ApprovalApplication = { id: string; title: string; created_at: string; profiles: { full_name: string; job_type: string } | null; expense_receipts: Receipt[] };
type ReceiptWithApplication = { application: ApprovalApplication; receipt: Receipt };

const statusText: Record<string, string> = {
  draft: '下書き', submitted: '経理確認待ち', accounting_approved: '最終承認待ち', final_approved: '振込待ち', settled: '精算済み', returned: '差戻し', rejected: '却下', correction_in_progress: '訂正中',
};

function actionsFor(role: Profile['app_role'], status: string) {
  if (role === 'accounting' && status === 'submitted') return ['accounting_approve', 'return', 'reject'] as const;
  if (role === 'president' && status === 'accounting_approved') return ['final_approve', 'return', 'reject'] as const;
  if (role === 'accounting' && status === 'final_approved') return ['settle'] as const;
  return [] as const;
}

function ReceiptCard({ item, role, showActions = false }: { item: ReceiptWithApplication; role: Profile['app_role']; showActions?: boolean }) {
  const { application, receipt } = item;
  const actions = showActions ? actionsFor(role, receipt.status) : [];
  return <article className="approval-card">
    <div className="approval-card-head"><div><span className={`status-pill ${receipt.status}`}>{statusText[receipt.status]}</span><h3>{application.title}</h3><p>{application.profiles?.full_name ?? '申請者未設定'} ／ {application.profiles?.job_type ?? '職種未設定'} ・ {receipt.expense_date}</p></div><strong>¥{receipt.amount_yen.toLocaleString('ja-JP')}</strong></div>
    <div className="approval-card-body"><span className="receipt-icon" aria-hidden>▧</span><div><b>{receipt.category}</b><p>{receipt.purpose}</p><small>{receipt.receipt_attachments[0]?.original_filename ?? '添付情報なし'}</small></div><Link href={`/applications/${application.id}`}>詳細を見る ›</Link></div>
    {actions.length > 0 ? <div className="workflow-actions">{actions.map((action) => <WorkflowActionForm key={action} receiptId={receipt.id} action={action} />)}</div> : null}
  </article>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span aria-hidden>✓</span><h3>{title}</h3><p>{detail}</p></div>;
}

export default async function ApprovalManagementPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const notices = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== 'string') redirect('/login');
  const { data: profileData } = await supabase.from('profiles').select('id, full_name, job_type, app_role, account_status').eq('id', userId).maybeSingle();
  const profile = profileData as Profile | null;
  if (!profile || profile.account_status !== 'active') redirect('/dashboard');
  if (profile.app_role === 'employee') redirect('/dashboard');

  const { data: applicationData } = await supabase
    .from('expense_applications')
    .select('id,title,created_at,profiles!expense_applications_applicant_id_fkey(full_name,job_type),expense_receipts(id,expense_date,amount_yen,category,purpose,status,receipt_attachments(original_filename))')
    .order('created_at', { ascending: false });
  const applications = (applicationData ?? []) as unknown as ApprovalApplication[];
  const receipts = applications.flatMap((application) => application.expense_receipts.map((receipt) => ({ application, receipt })));
  const actionable = receipts.filter((item) => actionsFor(profile.app_role, item.receipt.status).length > 0);
  const settlementStatus = receipts.filter((item) => ['final_approved', 'settled'].includes(item.receipt.status));
  const roleName = profile.app_role === 'accounting' ? '経理担当' : '社長';
  const description = profile.app_role === 'accounting' ? '経理確認のあと、振込待ちの領収書を精算済みに更新できます。' : '経理承認済みの領収書を最終承認し、振込待ちへ進めます。';

  return <main className="app-shell admin-shell">
    <aside className="side-nav"><Link className="app-brand" href="/dashboard"><span>¥</span><b>経費申請</b></Link><nav aria-label="管理メニュー"><Link className="nav-link" href="/dashboard"><span aria-hidden>▤</span>経費申請</Link><Link className="nav-link" href="/admin/applications"><span aria-hidden>☷</span>申請一覧</Link><Link className="nav-link active" href="/admin/approvals"><span aria-hidden>✓</span>承認管理</Link><Link className="nav-link" href="/admin/account-requests"><span aria-hidden>◷</span>ログイン申請</Link><Link className="nav-link" href="/admin/reports"><span aria-hidden>▥</span>集計・CSV出力</Link></nav><div className="profile-chip"><span className="avatar">{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>{roleName} ／ {profile.job_type}</small></div></div></aside>
    <section className="app-content"><header className="content-header"><div className="mobile-brand"><span>¥</span> 経費申請</div><Link className="secondary" href="/dashboard">管理画面へ</Link></header><div className="admin-content">
      <div className="page-title"><div><p className="eyebrow">APPROVAL MANAGEMENT</p><h1>承認管理</h1><p>{description}</p></div><div className="pending-count"><b>{actionable.length}</b><span>処理待ち</span></div></div>
      {notices.error ? <p className="notice error">{notices.error}</p> : null}{notices.message ? <p className="notice">{notices.message}</p> : null}
      <section className="approval-list"><div className="section-heading"><div><h2>処理待ちの領収書</h2><p>承認・差戻し・却下・精算は領収書ごとに実行します。</p></div></div>{actionable.length ? actionable.map((item) => <ReceiptCard key={item.receipt.id} item={item} role={profile.app_role} showActions />) : <Empty title="処理待ちの領収書はありません" detail="新しく提出・承認された領収書があると、ここに表示されます。" />}</section>
      <section className="approval-list settlement-list"><div className="section-heading"><div><h2>振込・精算の状況</h2><p>振込待ちは最終承認済みです。経理担当が精算済みに変更すると履歴に残ります。</p></div></div>{settlementStatus.length ? settlementStatus.map((item) => <ReceiptCard key={`settlement-${item.receipt.id}`} item={item} role={profile.app_role} showActions={item.receipt.status === 'final_approved'} />) : <Empty title="振込待ち・精算済みはありません" detail="社長の最終承認後、ここで振込待ちから精算済みまで確認できます。" />}</section>
    </div></section>
  </main>;
}
