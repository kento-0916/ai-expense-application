import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ManagerApplicationsPage } from '@/components/manager-applications-page';
import type { Profile } from '@/types/profile';

export const dynamic = 'force-dynamic';

export default async function ManagerApplications() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== 'string') redirect('/login');

  const [{ data: profileData }, { data: applicationsData }, { data: applicantsData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, job_type, app_role, account_status').eq('id', userId).maybeSingle(),
    supabase.from('expense_applications').select('id,applicant_id,title,status,created_at,expense_receipts(id,amount_yen,expense_date,category,purpose,status,receipt_attachments(original_filename,storage_path,mime_type))').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,full_name'),
  ]);
  const profile = profileData as Profile | null;
  if (!profile || profile.account_status !== 'active') redirect('/dashboard');
  if (profile.app_role !== 'accounting' && profile.app_role !== 'president') redirect('/dashboard');

  const applications = await Promise.all((applicationsData ?? []).map(async (application) => ({
    ...application,
    expense_receipts: await Promise.all(application.expense_receipts.map(async (receipt) => ({
      ...receipt,
      receipt_attachments: await Promise.all((receipt.receipt_attachments ?? []).map(async (attachment) => {
        const { data: signed } = await supabase.storage.from('expense-receipts').createSignedUrl(attachment.storage_path, 60 * 15);
        return { ...attachment, signed_url: signed?.signedUrl ?? null };
      })),
    }))),
  })));

  return <ManagerApplicationsPage profile={profile} applications={applications} applicants={applicantsData ?? []} />;
}
