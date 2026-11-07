import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { addReceipt, resubmitReceipt, updateReturnedReceipt } from '../new/actions';
import { AiReadButton } from '@/components/ai-read-button';

const receiptStatusText: Record<string, string> = { draft: '下書き', submitted: '経理確認待ち', accounting_approved: '最終承認待ち', final_approved: '振込待ち', settled: '精算済み', returned: '差戻し', rejected: '却下', correction_in_progress: '訂正中' };

export default async function ApplicationDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; message?: string }> }) {
  const { id } = await params;
  const notices = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== 'string') redirect('/login');

  const { data: application } = await supabase
    .from('expense_applications')
    .select('id,title,status,expense_receipts(id,expense_date,amount_yen,category,purpose,status,receipt_attachments(original_filename,storage_path,mime_type))')
    .eq('id', id)
    .maybeSingle();
  if (!application) notFound();
  const receipts = await Promise.all(application.expense_receipts.map(async (receipt) => ({
    ...receipt,
    receipt_attachments: await Promise.all((receipt.receipt_attachments ?? []).map(async (attachment) => {
      const { data: signed } = await supabase.storage.from('expense-receipts').createSignedUrl(attachment.storage_path, 60 * 15);
      return { ...attachment, signed_url: signed?.signedUrl ?? null };
    })),
  })));
  const total = receipts.reduce((sum, receipt) => sum + receipt.amount_yen, 0);
  const isDraft = application.status === 'draft';

  return (
    <main className="application-page detail-page">
      <header className="application-header"><Link className="back-link" href="/dashboard" aria-label="申請一覧へ戻る">‹</Link><Link className="form-brand" href="/dashboard"><span>¥</span>経費申請</Link><Link className="header-list-link" href="/dashboard">一覧へ戻る</Link></header>
      <section className="detail-layout">
        <div className="detail-title"><p className="eyebrow">APPLICATION DETAIL</p><h1>{application.title}</h1><p>申請内容と領収書を確認できます。</p></div>
        {notices.error && <p className="notice error">{notices.error}</p>}{notices.message && <p className="notice">{notices.message}</p>}
        <section className="detail-summary"><div><span>合計金額</span><strong>¥{total.toLocaleString('ja-JP')}</strong></div><span className={`status-pill ${application.status}`}>{isDraft ? '下書き' : '提出済み'}</span></section>
        <section className="receipt-list"><div className="section-heading"><div><h2>領収書 <span>({receipts.length}件)</span></h2><p>添付画像と入力内容を確認し、必要に応じてAI読取を実行できます。</p></div></div>
          {receipts.map((receipt, index) => { const attachment = receipt.receipt_attachments[0]; const isImage = attachment?.mime_type.startsWith('image/'); return <article className="receipt-card with-preview" key={receipt.id}><div className="receipt-number">{String(index + 1).padStart(2, '0')}</div><div className="detail-receipt-preview">{isImage && attachment?.signed_url ? <a href={attachment.signed_url} target="_blank" rel="noreferrer"><img src={attachment.signed_url} alt={`領収書${index + 1}の添付画像`} /></a> : attachment?.signed_url ? <a href={attachment.signed_url} target="_blank" rel="noreferrer">PDFを開く</a> : <span>添付なし</span>}</div><div className="receipt-information"><div><b>{receipt.category}</b><span>{receipt.expense_date}</span></div><strong>¥{receipt.amount_yen.toLocaleString('ja-JP')}</strong><small>{receipt.purpose} ・ {attachment?.original_filename ?? '添付なし'}</small></div><div className="receipt-status-area"><span className={`status-pill ${receipt.status}`}>{receiptStatusText[receipt.status] ?? receipt.status}</span><AiReadButton receiptId={receipt.id}/>{receipt.status === 'returned' && <form action={resubmitReceipt}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="receipt_id" value={receipt.id}/><button className="resubmit-button">修正後に再提出</button></form>}</div>{receipt.status === 'returned' && <form className="returned-edit-form" action={updateReturnedReceipt}><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="receipt_id" value={receipt.id}/><label>日付<input name="expense_date" type="date" defaultValue={receipt.expense_date} required/></label><label>金額<input name="amount_yen" type="number" min="1" defaultValue={receipt.amount_yen} required/></label><label>分類<select name="category" defaultValue={receipt.category} required>{['交通費','備品','印刷','郵送','会議室'].map((category) => <option key={category}>{category}</option>)}</select></label><label>用途<textarea name="purpose" defaultValue={receipt.purpose} required/></label><button type="submit">修正を保存</button></form>}</article>; })}
        </section>
        {isDraft && <form className="add-receipt-form" action={addReceipt}><input type="hidden" name="application_id" value={application.id}/><h2>領収書を追加</h2><p>領収書を追加してから、一覧画面で提出できます。</p><fieldset><label className="file-dropzone compact"><input name="receipt_file" type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf" required /><span aria-hidden>▧</span><b>領収書を添付</b></label><div className="two"><label className="field-label">日付<input name="expense_date" type="date" required/></label><label className="field-label">金額<input name="amount_yen" type="number" min="1" required/></label></div><label className="field-label">分類<select name="category" defaultValue="" required><option value="" disabled>選択してください</option>{['交通費','備品','印刷','郵送','会議室'].map((category) => <option key={category}>{category}</option>)}</select></label><label className="field-label">用途<textarea name="purpose" required/></label><button className="primary" type="submit">領収書を追加</button></fieldset></form>}
      </section>
    </main>
  );
}
