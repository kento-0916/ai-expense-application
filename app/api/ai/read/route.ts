import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGeminiConfig } from '@/lib/gemini';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']);
const maxFileSize = 10 * 1024 * 1024;

const schema = {
  type: 'OBJECT', properties: {
    date: { type: 'STRING', description: 'YYYY-MM-DD。読めない場合は空文字' },
    amountYen: { type: 'INTEGER', description: '合計金額。読めない場合は0' },
    category: { type: 'STRING', enum: ['交通費', '宿泊費', '飲食費', '備品', '通信費', '印刷', '郵送', '会議室', 'その他'] },
    purpose: { type: 'STRING', description: '領収書から推測できる用途。確信がなければ空文字' },
    needsReview: { type: 'BOOLEAN' },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  }, required: ['date', 'amountYen', 'category', 'purpose', 'needsReview', 'warnings'],
};

type AiResult = {
  date: string;
  amountYen: number;
  category: string;
  purpose: string;
  needsReview: boolean;
  warnings: string[];
};

async function readWithAi(file: Blob, mimeType: string): Promise<AiResult> {
  const { apiKey, model } = getGeminiConfig();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: '領収書を解析してください。AIの結果は確定値ではありません。金額・日付・分類・用途に少しでも不確かさがあればneedsReviewをtrueにし、warningsへ理由を書いてください。' },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
    }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('AIの無料利用枠に達しています。少し時間を置いて再試行するか、手入力してください。');
    if (response.status === 503) throw new Error('AIが混み合っています。少し時間を置いて再試行してください。');
    if (response.status === 403) throw new Error('AI APIキーに画像解析の利用権限がありません。APIキーの設定をご確認ください。');
    if (response.status === 404) throw new Error('AIモデルが利用できません。管理者にモデル設定の確認を依頼してください。');
    throw new Error('AI解析に失敗しました。再試行または手入力してください。');
  }
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AI解析結果を取得できませんでした。');
  try {
    return JSON.parse(text) as AiResult;
  } catch {
    throw new Error('AI解析結果を読み取れませんでした。手入力してください。');
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== 'string') return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });

  try {
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const files = formData.getAll('receipt_files').filter((value): value is File => value instanceof File && value.size > 0);
      const singleFile = formData.get('receipt_file');
      if (!files.length && singleFile instanceof File && singleFile.size > 0) files.push(singleFile);
      if (!files.length || files.length > 5) return NextResponse.json({ error: '解析する領収書を1〜5件選択してください。' }, { status: 400 });
      if (files.some((file) => file.size > maxFileSize || !allowedTypes.has(file.type))) return NextResponse.json({ error: '添付は10MB以下のJPEG・PNG・HEIC・PDFだけを解析できます。' }, { status: 400 });
      const results = await Promise.all(files.map(async (file) => {
        try { return { result: await readWithAi(file, file.type) }; }
        catch (error) { return { error: error instanceof Error ? error.message : 'AI解析に失敗しました。' }; }
      }));
      return NextResponse.json({ results, result: results[0]?.result });
    }

    const { receiptId } = await request.json() as { receiptId?: string };
    if (!receiptId) return NextResponse.json({ error: '領収書が指定されていません。' }, { status: 400 });
    const { data: receipt } = await supabase.from('expense_receipts').select('id, receipt_attachments(storage_path,mime_type)').eq('id', receiptId).maybeSingle();
    const attachment = receipt?.receipt_attachments[0];
    if (!attachment) return NextResponse.json({ error: '添付ファイルがありません。' }, { status: 422 });
    const { data: file, error: downloadError } = await supabase.storage.from('expense-receipts').download(attachment.storage_path);
    if (downloadError || !file) return NextResponse.json({ error: '添付ファイルを読み込めません。' }, { status: 422 });
    return NextResponse.json({ result: await readWithAi(file, attachment.mime_type) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI解析に失敗しました。再試行または手入力してください。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
