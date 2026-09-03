import { useState, useMemo } from 'react';
import type { ApprovalRouteRule } from '@/domain/approvalRoute/schema';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { resolveRoute } from '@/domain/approvalRoute/engine';

export function RoutePreview({ rule }: { rule: ApprovalRouteRule }) {
  const org = useOrgTree();
  const [drafterId, setDrafterId] = useState('');
  const [amount, setAmount] = useState('500000');
  const did = drafterId || org.users[0]?.id || '';

  const result = useMemo(() => {
    const drafter = org.users.find((u) => u.id === did);
    if (!drafter) return null;
    const dt: string = rule.docType === '전체' ? '기안' : rule.docType;
    
    const docData: Record<string, any> = {};
    if (rule.conditionKey && rule.conditionValues && rule.conditionValues.length > 0) {
      docData[rule.conditionKey] = rule.conditionValues[0];
    }

    return resolveRoute({
      drafter,
      docType: dt,
      amount: amount === '' ? null : Number(amount),
      users: org.users,
      depts: org.depts,
      positions: org.positions,
      rules: [rule],
      docData,
    });
  }, [rule, did, amount, org.users, org.depts, org.positions]);

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/30 p-2.5">
      <div className="mb-2 text-[11px] font-bold text-teal">시뮬레이터 — 이 룰이 만드는 결재선</div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={did} onChange={(e) => setDrafterId(e.target.value)} className="rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none">
          {org.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept} · {u.position}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="금액" className="w-24 rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none" />
      </div>
      <div className="mt-2 text-[12px]">
        {result && result.steps.length > 0 ? (
          (() => {
            const approvers = result.steps.filter((s) => s.kind !== '참조');
            const refs = result.steps.filter((s) => s.kind === '참조');
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-ink3">{nameOf(did)}(기안)</span>
                {approvers.map((s) => (
                  <span key={s.seq} className="flex items-center gap-1.5">
                    <span className="text-ink3">→</span>
                    <span className="rounded-md bg-panel px-2 py-0.5 font-semibold text-ink shadow-2xs border border-border/60">
                      {nameOf(s.approverId)} <span className="text-[10px] text-teal font-bold">{s.kind}</span>
                    </span>
                  </span>
                ))}
                {refs.length > 0 && (
                  <div className="flex items-center gap-1 ml-1.5">
                    <span className="text-ink3 font-medium">|</span>
                    <span className="rounded-md border border-dashed border-border bg-panel px-2 py-0.5 text-[11px] font-semibold text-ink3">
                      참조: {refs.map((r) => nameOf(r.approverId)).join(', ')}
                    </span>
                  </div>
                )}
                <span className="ml-1 text-[10px] text-ink3">({result.rule ? `룰 적용` : '폴백'})</span>
              </div>
            );
          })()
        ) : (
          <span className="text-ink3">결재선이 생성되지 않았습니다(조건 미매칭 또는 해석 불가 → 상신 시 다른 룰/폴백 적용).</span>
        )}
      </div>
    </div>
  );
}
