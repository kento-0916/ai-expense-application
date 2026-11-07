'use client';

import { useState } from 'react';
import { transitionReceipt } from '@/app/admin/approvals/actions';

type WorkflowAction = 'accounting_approve' | 'final_approve' | 'return' | 'reject' | 'settle';

const actionText: Record<WorkflowAction, string> = {
  accounting_approve: '一次承認',
  final_approve: '最終承認',
  return: '差戻し',
  reject: '却下',
  settle: '精算済みにする',
};

export function WorkflowActionForm({ receiptId, action }: { receiptId: string; action: WorkflowAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const needsReason = action === 'return' || action === 'reject';
  const label = actionText[action];

  return <>
    <button className={`workflow-button ${action}`} type="button" onClick={() => setIsOpen(true)}>{label}</button>
    {isOpen && <div className="workflow-dialog-backdrop" role="presentation"><section className="workflow-dialog" role="dialog" aria-modal="true" aria-labelledby={`workflow-title-${receiptId}-${action}`}><p className="eyebrow">CONFIRM ACTION</p><h2 id={`workflow-title-${receiptId}-${action}`}>「{label}」を確定しますか？</h2><p>この操作は領収書単位で記録され、履歴に残ります。</p><form action={transitionReceipt}><input type="hidden" name="receipt_id" value={receiptId}/><input type="hidden" name="workflow_action" value={action}/>{needsReason && <label>理由<textarea name="reason" required maxLength={500} placeholder={action === 'return' ? '修正が必要な点を入力してください' : '却下する理由を入力してください'}/></label>}<div className="dialog-actions"><button type="button" className="dialog-cancel" onClick={() => setIsOpen(false)}>キャンセル</button><button type="submit" className={`workflow-button ${action}`}>{label}を確定</button></div></form></section></div>}
  </>;
}
