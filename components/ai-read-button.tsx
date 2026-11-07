'use client';
import { useState } from 'react';
export function AiReadButton({ receiptId }: { receiptId: string }) {
 const [text,setText]=useState(''); const [loading,setLoading]=useState(false);
 async function run(){setLoading(true);const r=await fetch('/api/ai/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptId})});const b=await r.json();setText(r.ok?`日付: ${b.result.date||'要確認'} / 金額: ¥${b.result.amountYen} / 分類: ${b.result.category} / 用途: ${b.result.purpose||'要確認'}${b.result.needsReview?'（要確認）':''}`:b.error);setLoading(false)}
 return <div><button className="secondary" type="button" onClick={run} disabled={loading}>{loading?'AI解析中…':'✦ AIで読み取る'}</button>{text&&<p className="notice">{text}</p>}</div>
}
