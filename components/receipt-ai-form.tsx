'use client';

import { useState, type ChangeEvent } from 'react';

const categories = ['交通費', '宿泊費', '飲食費', '備品', '通信費', '印刷', '郵送', '会議室', 'その他'];
const maxFiles = 5;
const maxTotalSize = 40 * 1024 * 1024;

type AiResult = { date?: string; amountYen?: number; category?: string; purpose?: string; needsReview?: boolean; warnings?: string[] };
type ReceiptFields = { expenseDate: string; amount: string; category: string; purpose: string };
type ReceiptItem = { id: string; file: File; fields: ReceiptFields; reading: boolean; message: string; warnings: string[] };
type AiBatchResult = { result?: AiResult; error?: string };

const emptyFields = (): ReceiptFields => ({ expenseDate: '', amount: '', category: '', purpose: '' });

export function ReceiptAiForm({ action, error }: { action: (formData: FormData) => void | Promise<void>; error?: string }) {
  const [title, setTitle] = useState('');
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [selectionError, setSelectionError] = useState('');

  function updateReceipt(id: string, name: keyof ReceiptFields, value: string) {
    setReceipts((current) => current.map((receipt) => receipt.id === id ? { ...receipt, fields: { ...receipt.fields, [name]: value } } : receipt));
  }

  async function readReceipts(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (files.length > maxFiles) { setSelectionError(`一度に選択できる領収書は${maxFiles}件までです。`); return; }
    if (files.reduce((total, file) => total + file.size, 0) > maxTotalSize) { setSelectionError('一度に添付できる合計容量は40MBまでです。'); return; }
    setSelectionError('');
    const selected = files.map((file) => ({ id: crypto.randomUUID(), file, fields: emptyFields(), reading: true, message: 'AIが読み取り中です…', warnings: [] }));
    setReceipts(selected);
    try {
      const body = new FormData();
      files.forEach((file) => body.append('receipt_files', file));
      const response = await fetch('/api/ai/read', { method: 'POST', body });
      const payload = await response.json() as { results?: AiBatchResult[]; error?: string };
      if (!response.ok || !payload.results) throw new Error(payload.error ?? 'AI解析に失敗しました。');
      setReceipts(selected.map((receipt, index) => {
        const result = payload.results?.[index];
        if (!result?.result) return { ...receipt, reading: false, message: result?.error ?? 'AI解析に失敗しました。入力して続行できます。' };
        const ai = result.result;
        return { ...receipt, reading: false, fields: { expenseDate: ai.date ?? '', amount: ai.amountYen ? String(ai.amountYen) : '', category: categories.includes(ai.category ?? '') ? ai.category ?? '' : '', purpose: ai.purpose ?? '' }, warnings: ai.warnings ?? [], message: ai.needsReview ? 'AI読取が完了しました。注意点と入力値を確認してください。' : 'AI読取が完了しました。内容を確認してください。' };
      }));
    } catch (readError) {
      const message = readError instanceof Error ? readError.message : 'AI解析に失敗しました。入力して続行できます。';
      setReceipts(selected.map((receipt) => ({ ...receipt, reading: false, message })));
    }
  }

  const isReading = receipts.some((receipt) => receipt.reading);
  return <form className="expense-form ai-first-form multi-receipt-form" action={action}>
    {error && <p className="notice error">{error}</p>}
    {selectionError && <p className="notice error">{selectionError}</p>}
    <fieldset className="receipt-fieldset ai-receipt-fieldset"><legend>1. 領収書をまとめて添付</legend>
      <label className={`file-dropzone ${isReading ? 'is-reading' : ''}`}>
        <input name="receipt_files" type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,application/pdf" required onChange={readReceipts} />
        <span aria-hidden>{isReading ? '◌' : '▧'}</span><b>{isReading ? `${receipts.length}件をAIが読み取り中です…` : receipts.length ? `${receipts.length}件の領収書を選択中（選び直す）` : '領収書を複数選択・撮影'}</b><small>一度に最大5件 ／ JPEG・PNG・HEIC・PDF ／ 1件10MB・合計40MBまで</small>
      </label>
    </fieldset>
    <section className="ai-result-panel" aria-live="polite"><div><span aria-hidden>✦</span><b>AI読み取り結果</b></div><p>{receipts.length ? `${receipts.length}件の領収書を画像ごとに読み取り、下の明細へ自動入力します。` : '領収書を添付すると、AIが日付・金額・経費分類・用途を画像ごとに読み取ります。'}</p></section>
    <fieldset className="receipt-fieldset confirmation-fieldset"><legend>2. 内容を確認・修正</legend>
      <p className="field-help">AIの読み取り結果は確定ではありません。画像ごとの入力値を確認してから保存してください。</p>
      <label className="field-label">申請の内容<input name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：1月 東京出張" required /></label>
      {receipts.map((receipt, index) => <section className="batch-receipt-fields" key={receipt.id} aria-label={`領収書${index + 1}の入力内容`}><header><div><b>領収書 {index + 1}</b><small>{receipt.file.name}</small></div><span className={receipt.reading ? 'reading' : ''}>{receipt.reading ? '読取中' : '確認待ち'}</span></header><p className="batch-ai-message">{receipt.message}</p>{receipt.warnings.length > 0 && <ul className="batch-ai-warnings">{receipt.warnings.map((warning, warningIndex) => <li key={`${receipt.id}-${warningIndex}`}>{warning}</li>)}</ul>}<div className="two"><label className="field-label">日付<input name="expense_date" type="date" value={receipt.fields.expenseDate} onChange={(event) => updateReceipt(receipt.id, 'expenseDate', event.target.value)} required /></label><label className="field-label">金額<input name="amount_yen" type="number" min="1" step="1" value={receipt.fields.amount} onChange={(event) => updateReceipt(receipt.id, 'amount', event.target.value)} placeholder="1280" required /></label></div><label className="field-label">経費分類<select name="category" value={receipt.fields.category} onChange={(event) => updateReceipt(receipt.id, 'category', event.target.value)} required><option value="" disabled>選択してください</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="field-label">用途<textarea name="purpose" value={receipt.fields.purpose} onChange={(event) => updateReceipt(receipt.id, 'purpose', event.target.value)} maxLength={300} placeholder="例：取引先訪問のための交通費" required /></label></section>)}
    </fieldset>
    <button className="primary submit-draft-button" type="submit" disabled={!receipts.length || isReading}>複数の内容を確認して下書きを保存</button>
  </form>;
}
