import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import type { Profile } from '@/types/profile';
import { deleteDraft, submitApplication } from '@/app/applications/new/actions';
import { EmployeeDashboard } from '@/components/employee-dashboard';
import { ManagerDashboard } from '@/components/manager-dashboard';

export const dynamic = 'force-dynamic';

const statusLabel = (status: string) => status === 'draft' ? '下書き' : '提出済み';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (typeof userId !== 'string') redirect('/login');

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, job_type, app_role, account_status')
    .eq('id', userId)
    .maybeSingle();
  const profile = data as Profile | null;
  if (!profile || profile.account_status === 'pending') redirect('/pending');
  if (profile.account_status === 'suspended') redirect('/suspended');

  const [{ data: applicationsData }, { data: applicantsData }] = await Promise.all([
    supabase.from('expense_applications').select('id,applicant_id,title,status,created_at,expense_receipts(id,amount_yen,expense_date,category,purpose,status,receipt_attachments(original_filename,storage_path,mime_type))').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,full_name'),
  ]);
  const applications = applicationsData ?? [];
  const applicants = applicantsData ?? [];

  const drafts = applications.filter((application) => application.status === 'draft').length;
  const submitted = applications.filter((application) => application.status === 'submitted').length;
  const total = applications.reduce(
    (applicationTotal, application) => applicationTotal + application.expense_receipts.reduce((receiptTotal, receipt) => receiptTotal + receipt.amount_yen, 0),
    0,
  );
  const roleName = profile.app_role === 'accounting' ? '経理担当' : profile.app_role === 'president' ? '社長' : '社員';

  if (profile.app_role === 'employee') return <EmployeeDashboard profile={profile} applications={applications} />;
  if (profile.app_role === 'accounting' || profile.app_role === 'president') {
    const applicationsWithAttachmentUrls = await Promise.all(applications.map(async (application) => ({
      ...application,
      expense_receipts: await Promise.all(application.expense_receipts.map(async (receipt) => ({
        ...receipt,
        receipt_attachments: await Promise.all((receipt.receipt_attachments ?? []).map(async (attachment) => {
          const { data: signed } = await supabase.storage.from('expense-receipts').createSignedUrl(attachment.storage_path, 60 * 15);
          return { ...attachment, signed_url: signed?.signedUrl ?? null };
        })),
      }))),
    })));
    return <ManagerDashboard profile={profile} applications={applicationsWithAttachmentUrls} applicants={applicants} />;
  }

  return (
    <main className="app-shell">
      <aside className="side-nav">
        <Link className="app-brand" href="/dashboard"><span>¥</span><b>経費申請</b></Link>
        <nav aria-label="主なメニュー">
          <Link className="nav-link active" href="/dashboard"><span aria-hidden>▤</span>自分の申請</Link>
          <Link className="nav-link" href="/admin/approvals"><span aria-hidden>✓</span>承認管理</Link>
          <Link className="nav-link" href="/admin/reports"><span aria-hidden>▥</span>集計・CSV出力</Link>
          <Link className="nav-link" href="/notifications"><span aria-hidden>●</span>通知</Link>
          <Link className="nav-link" href="/applications/new"><span aria-hidden>＋</span>新しい申請</Link>
        </nav>
        <div className="profile-chip"><span className="avatar">{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>{roleName} ／ {profile.job_type}</small></div></div>
      </aside>

      <section className="app-content">
        <header className="content-header">
          <div className="mobile-brand"><span>¥</span> 経費申請</div>
          <form action={signOut}><button className="logout-button">ログアウト</button></form>
          <Link className="primary new-application-button" href="/applications/new"><span aria-hidden>＋</span> 新しい申請</Link>
        </header>

        <div className="dashboard-content">
          <div className="page-title"><div><p className="eyebrow">MY EXPENSES</p><h1>自分の申請</h1><p>申請の作成、下書きの提出、進捗の確認ができます。</p></div></div>
          <section className="summary-grid" aria-label="申請の集計">
            <article className="summary-card draft"><p>下書き</p><strong>{drafts}<small>件</small></strong><span>作成途中の申請</span></article>
            <article className="summary-card submitted"><p>提出済み</p><strong>{submitted}<small>件</small></strong><span>確認待ちの申請</span></article>
            <article className="summary-card total"><p>申請総額</p><strong>¥{total.toLocaleString('ja-JP')}</strong><span>{applications.length}件の申請</span></article>
          </section>

          <section className="application-list-card">
            <div className="section-heading"><div><h2>申請一覧</h2><p>最新の申請から表示しています</p></div><Link href="/applications/new">＋ 新しい申請</Link></div>
            {applications.length ? <div className="application-table" role="list">
              {applications.map((application) => {
                const amount = application.expense_receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0);
                const date = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(application.created_at));
                return <article className="application-row" key={application.id} role="listitem">
                  <Link className="application-main" href={`/applications/${application.id}`}><span className="receipt-icon" aria-hidden>▧</span><div><b>{application.title}</b><small>{date} ・ 領収書 {application.expense_receipts.length}件</small></div></Link>
                  <strong className="application-amount">¥{amount.toLocaleString('ja-JP')}</strong>
                  <span className={`status-pill ${application.status}`}>{statusLabel(application.status)}</span>
                  {application.status === 'draft' ? <div className="row-actions"><form action={submitApplication}><input type="hidden" name="application_id" value={application.id}/><button className="submit-button">提出</button></form><form action={deleteDraft}><input type="hidden" name="application_id" value={application.id}/><button className="delete-button" aria-label={`${application.title}を削除`}>削除</button></form></div> : <Link className="detail-link" href={`/applications/${application.id}`} aria-label={`${application.title}の詳細`}>›</Link>}
                </article>;
              })}
            </div> : <div className="empty-state"><span aria-hidden>▧</span><h3>まだ申請はありません</h3><p>領収書を登録して、最初の経費申請を作成しましょう。</p><Link className="primary" href="/applications/new">＋ 新しい申請</Link></div>}
          </section>
        </div>
      </section>
    </main>
  );
}
