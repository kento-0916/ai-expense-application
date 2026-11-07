'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const categories = ['交通費', '宿泊費', '飲食費', '備品', '通信費', '印刷', '郵送', '会議室', 'その他'];
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']);

function withMessage(path: string, key: 'error' | 'message', message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (typeof id !== 'string') redirect('/login');
  return { supabase, id };
}

export async function createDraft(formData: FormData) {
  const { supabase, id } = await currentUser();
  const title = String(formData.get('title') ?? '').trim();
  const files = formData.getAll('receipt_files').filter((value): value is File => value instanceof File && value.size > 0);
  const dates = formData.getAll('expense_date').map(String);
  const amounts = formData.getAll('amount_yen').map((value) => Number(value));
  const selectedCategories = formData.getAll('category').map(String);
  const purposes = formData.getAll('purpose').map((value) => String(value).trim());
  if (!title || !files.length || files.length > 5 || files.length !== dates.length || files.length !== amounts.length || files.length !== selectedCategories.length || files.length !== purposes.length) {
    redirect(withMessage('/applications/new', 'error', '申請内容と、1〜5件の領収書を確認してください。'));
  }
  const entries = files.map((file, index) => ({ file, expenseDate: dates[index], amount: amounts[index], category: selectedCategories[index], purpose: purposes[index] }));
  if (entries.some(({ file, expenseDate, amount, category, purpose }) => !expenseDate || !Number.isInteger(amount) || amount <= 0 || !categories.includes(category) || !purpose || file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type))) {
    redirect(withMessage('/applications/new', 'error', '各領収書の入力内容と、10MB以下のJPEG・PNG・HEIC・PDFを確認してください。'));
  }
  if (entries.reduce((total, { file }) => total + file.size, 0) > 40 * 1024 * 1024) {
    redirect(withMessage('/applications/new', 'error', '一度に添付できる合計容量は40MBまでです。'));
  }
  const { data: application, error: appError } = await supabase.from('expense_applications').insert({ applicant_id: id, title }).select('id').single();
  if (appError || !application) redirect(withMessage('/applications/new', 'error', '下書きを作成できませんでした。'));
  for (const { file, expenseDate, amount, category, purpose } of entries) {
    const { data: receipt, error: receiptError } = await supabase.from('expense_receipts').insert({ application_id: application.id, expense_date: expenseDate, amount_yen: amount, category, purpose }).select('id').single();
    if (receiptError || !receipt) redirect(withMessage('/applications/new', 'error', '領収書を保存できませんでした。'));
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${id}/${receipt.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) redirect(withMessage('/applications/new', 'error', 'ファイルを保存できませんでした。形式と容量をご確認ください。'));
    const { error: attachmentError } = await supabase.from('receipt_attachments').insert({ receipt_id: receipt.id, storage_path: path, original_filename: file.name, mime_type: file.type, byte_size: file.size });
    if (attachmentError) redirect(withMessage('/applications/new', 'error', '添付情報を保存できませんでした。'));
  }
  revalidatePath('/dashboard');
  redirect(withMessage('/dashboard', 'message', `${entries.length}件の領収書を下書きとして保存しました。`));
}

export async function submitApplication(formData: FormData) {
  const { supabase } = await currentUser();
  const applicationId = String(formData.get('application_id') ?? '');
  const { data: receipts } = await supabase.from('expense_receipts').select('id, status, receipt_attachments(id)').eq('application_id', applicationId);
  if (!receipts?.length || receipts.some((receipt) => !receipt.receipt_attachments?.length)) redirect(withMessage('/dashboard', 'error', 'すべての領収書に添付が必要です。'));
  for (const receipt of receipts) {
    if (receipt.status === 'draft') {
      const { error } = await supabase.rpc('transition_receipt_status', { p_receipt_id: receipt.id, p_action: 'submit', p_reason: null });
      if (error) redirect(withMessage('/dashboard', 'error', '提出できませんでした。最新の状態をご確認ください。'));
    }
  }
  revalidatePath('/dashboard');
  redirect(withMessage('/dashboard', 'message', '経費申請を提出しました。'));
}

export async function resubmitReceipt(formData: FormData) {
  const { supabase } = await currentUser();
  const applicationId = String(formData.get('application_id') ?? '');
  const receiptId = String(formData.get('receipt_id') ?? '');
  if (!applicationId || !receiptId) redirect(withMessage('/dashboard', 'error', '再提出する領収書を確認できませんでした。'));
  const { error } = await supabase.rpc('transition_receipt_status', { p_receipt_id: receiptId, p_action: 'submit', p_reason: null });
  if (error) redirect(withMessage(`/applications/${applicationId}`, 'error', '再提出できませんでした。最新の状態をご確認ください。'));
  revalidatePath('/dashboard');
  revalidatePath(`/applications/${applicationId}`);
  redirect(withMessage(`/applications/${applicationId}`, 'message', '領収書を再提出しました。'));
}

export async function updateReturnedReceipt(formData: FormData) {
  const { supabase } = await currentUser();
  const applicationId = String(formData.get('application_id') ?? '');
  const receiptId = String(formData.get('receipt_id') ?? '');
  const expenseDate = String(formData.get('expense_date') ?? '');
  const amount = Number(formData.get('amount_yen'));
  const category = String(formData.get('category') ?? '');
  const purpose = String(formData.get('purpose') ?? '').trim();
  if (!applicationId || !receiptId || !expenseDate || !Number.isInteger(amount) || amount <= 0 || !categories.includes(category) || !purpose) redirect(withMessage(`/applications/${applicationId}`, 'error', '修正内容を正しく入力してください。'));
  const { data, error } = await supabase.from('expense_receipts').update({ expense_date: expenseDate, amount_yen: amount, category, purpose, updated_at: new Date().toISOString() }).eq('id', receiptId).select('id').maybeSingle();
  if (error || !data) redirect(withMessage(`/applications/${applicationId}`, 'error', '修正できませんでした。最新の状態を確認してください。'));
  revalidatePath('/dashboard');
  revalidatePath(`/applications/${applicationId}`);
  redirect(withMessage(`/applications/${applicationId}`, 'message', '差戻しされた領収書を修正しました。再提出してください。'));
}

export async function deleteDraft(formData: FormData) {
  const { supabase, id } = await currentUser();
  const applicationId = String(formData.get('application_id') ?? '');
  const { error } = await supabase.from('expense_applications').delete().eq('id', applicationId).eq('applicant_id', id).eq('status', 'draft');
  if (error) redirect(withMessage('/dashboard', 'error', '下書きを削除できませんでした。'));
  revalidatePath('/dashboard');
}

export async function addReceipt(formData: FormData) {
  const { supabase, id } = await currentUser();
  const applicationId = String(formData.get('application_id') ?? '');
  const expenseDate = String(formData.get('expense_date') ?? '');
  const amount = Number(formData.get('amount_yen'));
  const category = String(formData.get('category') ?? '');
  const purpose = String(formData.get('purpose') ?? '').trim();
  const file = formData.get('receipt_file');
  if (!applicationId || !expenseDate || !Number.isInteger(amount) || amount <= 0 || !categories.includes(category) || !purpose || !(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024 || !allowedTypes.has(file.type)) redirect(withMessage(`/applications/${applicationId}`, 'error', '入力内容または添付ファイルを確認してください。'));
  const { data: receipt, error: receiptError } = await supabase.from('expense_receipts').insert({ application_id: applicationId, expense_date: expenseDate, amount_yen: amount, category, purpose }).select('id').single();
  if (receiptError || !receipt) redirect(withMessage(`/applications/${applicationId}`, 'error', '領収書を追加できませんでした。'));
  const path = `${id}/${receipt.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type });
  if (uploadError) redirect(withMessage(`/applications/${applicationId}`, 'error', '添付ファイルを保存できませんでした。'));
  const { error: attachmentError } = await supabase.from('receipt_attachments').insert({ receipt_id: receipt.id, storage_path: path, original_filename: file.name, mime_type: file.type, byte_size: file.size });
  if (attachmentError) redirect(withMessage(`/applications/${applicationId}`, 'error', '添付情報を保存できませんでした。'));
  revalidatePath('/dashboard'); revalidatePath(`/applications/${applicationId}`); redirect(withMessage(`/applications/${applicationId}`, 'message', '領収書を追加しました。'));
}
