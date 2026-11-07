import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/profile';
import { approveLoginRequest, rejectLoginRequest } from './actions';

type PendingProfile = Pick<Profile, 'id' | 'full_name' | 'job_type'> & { created_at: string };
const formatDateTime = (value: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export default async function AccountRequestsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const notices = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== 'string') redirect('/login');
  const [{ data: profileData }, { data: requestData }] = await Promise.all([
    supabase.from('profiles').select('id,full_name,job_type,app_role,account_status').eq('id', userId).maybeSingle(),
    supabase.from('profiles').select('id,full_name,job_type,created_at').eq('account_status', 'pending').order('created_at', { ascending: false }),
  ]);
  const profile = profileData as Profile | null;
  if (!profile || profile.account_status !== 'active' || profile.app_role === 'employee') redirect('/dashboard');
  const requests = (requestData ?? []) as PendingProfile[];
  const roleName = profile.app_role === 'president' ? '社長' : '経理担当';

  return <main className="app-shell admin-shell">
    <aside className="side-nav"><Link className="app-brand" href="/dashboard"><span>¥</span><b>経費申請</b></Link><nav aria-label="管理メニュー"><Link className="nav-link" href="/dashboard"><span aria-hidden>▤</span>経費申請</Link><Link className="nav-link" href="/admin/applications"><span aria-hidden>☷</span>申請一覧</Link><Link className="nav-link" href="/admin/approvals"><span aria-hidden>✓</span>承認管理</Link><Link className="nav-link active" href="/admin/account-requests"><span aria-hidden>◷</span>ログイン申請 <em>{requests.length}</em></Link><Link className="nav-link" href="/admin/reports"><span aria-hidden>▥</span>集計・CSV出力</Link></nav><div className="profile-chip"><span className="avatar">{profile.full_name.slice(0, 1)}</span><div><b>{profile.full_name}</b><small>{roleName} ／ {profile.job_type}</small></div></div></aside>
    <section className="app-content"><header className="content-header"><div className="mobile-brand"><span>¥</span> 経費申請</div><Link className="secondary" href="/dashboard">管理画面へ</Link></header><div className="admin-content">
      <div className="page-title"><div><p className="eyebrow">ACCOUNT REQUESTS</p><h1>ログイン申請</h1><p>新規登録を承認すると、経費申請の利用を開始できます。</p></div><div className="pending-count"><b>{requests.length}</b><span>承認待ち</span></div></div>
      {notices.error ? <p className="notice error">{notices.error}</p> : null}{notices.message ? <p className="notice">{notices.message}</p> : null}
      <section className="approval-list account-request-list"><div className="section-heading"><div><h2>承認待ちのログイン申請</h2><p>拒否したアカウントは利用停止状態になります。</p></div></div>{requests.length ? requests.map((request) => <article className="account-request-card" key={request.id}><div className="account-request-avatar">{request.full_name.slice(0, 1)}</div><div><h3>{request.full_name}</h3><p>{request.job_type}　／　申請日時：{formatDateTime(request.created_at)}</p></div><div className="account-request-actions"><form action={approveLoginRequest}><input type="hidden" name="profile_id" value={request.id}/><button className="workflow-button accounting_approve">✓ 承認</button></form><form action={rejectLoginRequest}><input type="hidden" name="profile_id" value={request.id}/><button className="workflow-button reject">× 拒否</button></form></div></article>) : <div className="empty-state"><span aria-hidden>✓</span><h3>承認待ちのログイン申請はありません</h3><p>新しいユーザーが登録すると、ここで承認または拒否できます。</p></div>}</section>
    </div></section>
  </main>;
}
