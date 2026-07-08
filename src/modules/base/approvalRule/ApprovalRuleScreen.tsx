import { useMemo, useState } from 'react';
import { useRouteRules, useRemoveRouteRule, useUpsertRouteRule } from '@/features/gw/useRouteRules';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { resolveRoute } from '@/domain/approvalRoute/engine';
import {
  RESOLVERS,
  ROUTE_STEP_KINDS,
  type ApprovalRouteRule,
  type Resolver,
  type RouteStep,
} from '@/domain/approvalRoute/schema';
import { useApprovalForms } from '@/features/gw/useApprovalForms';
import { DEPT_TYPES } from '@/domain/department/schema';

/**
 * 결재선 규칙관리 (기준정보) — 동적 결재선 룰 CRUD + 단계 빌더 + 시뮬레이터.
 * 기안자 부서·직급·금액별 결재선을 코드 수정 없이 관리. ([[dynamic-route-engine]] §7.4)
 */
const RESOLVER_LABEL: Record<Resolver, string> = {
  MANAGER: '직속 상급자(n차)',
  DEPT_HEAD: '소속 부서장',
  PARENT_DEPT_HEAD: '상위 부서장(level)',
  ROLE_FACTORY_HEAD: '공장장',
  ROLE_DIVISION_HEAD: '본부장',
  ROLE_CEO: '대표',
  POSITION_AT_LEAST: '직급 이상(rank)',
  SPECIFIC_USER: '특정 사용자(id)',
  SPECIFIC_DEPT_HEAD: '특정 부서장(deptId)',
};
const ARG_HINT: Partial<Record<Resolver, string>> = {
  MANAGER: 'n(예: 1)', PARENT_DEPT_HEAD: 'level(예: 1)', POSITION_AT_LEAST: 'rank(예: 3)',
  SPECIFIC_USER: 'userId', SPECIFIC_DEPT_HEAD: 'deptId',
};

const blankRule = (): ApprovalRouteRule => ({
  id: '', name: '', priority: 50, active: true, docType: '전체',
  deptScope: { kind: '전체', deptId: null, deptType: null },
  positionFromRank: null, positionToRank: null, amountFrom: null, amountTo: null,
  steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
});

export default function ApprovalRuleScreen() {
  const { data: rules = [], isLoading } = useRouteRules();
  const { data: forms = [] } = useApprovalForms();
  const upsert = useUpsertRouteRule();
  const remove = useRemoveRouteRule();
  const [sel, setSel] = useState<ApprovalRouteRule | null>(null);
  const [msg, setMsg] = useState('');

  const formNameOf = (code: string) => forms.find((f) => f.code === code)?.name ?? code;

  const nextId = () => `RR-${rules.length + 1}-${Math.max(0, ...rules.map((r) => Number(r.id.split('-')[1]) || 0)) + 1}`;
  const save = async () => {
    if (!sel) return;
    if (!sel.name.trim()) return setMsg('룰 이름을 입력하세요.');
    await upsert.mutateAsync({ ...sel, id: sel.id || nextId() });
    setMsg('저장되었습니다 — 상신 시 즉시 반영됩니다.');
    setSel(null);
  };
  const del = async (id: string) => { await remove.mutateAsync(id); if (sel?.id === id) setSel(null); };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">결재선 규칙관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 결재선 규칙관리 · 기안자 부서·직급·금액별 동적 결재선</p>
        </div>
        <button onClick={() => { setSel(blankRule()); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 룰 추가</button>
      </div>

      <div className="grid grid-cols-[300px_1fr] items-start gap-3.5">
        {/* 룰 목록(우선순위 순) */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-3.5 py-2.5 text-[11.5px] font-bold text-ink2">룰 목록 <span className="text-ink3">· 우선순위 순 {rules.length}</span></div>
          {isLoading && <div className="py-8 text-center text-[12px] text-ink3">불러오는 중…</div>}
          {rules.map((r) => (
            <button key={r.id} onClick={() => { setSel(r); setMsg(''); }} className={`flex w-full flex-col gap-0.5 border-b border-border px-3.5 py-2.5 text-left ${sel?.id === r.id ? 'bg-teal-soft/60' : 'hover:bg-panel-alt'}`}>
              <div className="flex items-center gap-1.5">
                <span className="grid h-5 min-w-5 place-items-center rounded bg-ink3/15 px-1 text-[10px] font-bold text-ink2">{r.priority}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{r.name}</span>
                {!r.active && <span className="text-[9.5px] text-ink3">중지</span>}
              </div>
              <div className="text-[10.5px] text-ink3">{formNameOf(r.docType)} · {scopeLabel(r)} · {r.steps.length}단계</div>
            </button>
          ))}
        </div>

        {/* 편집 + 시뮬레이터 */}
        <div className="rounded-xl border border-border bg-panel p-4">
          {sel ? (
            <RuleEditor rule={sel} onChange={setSel} onSave={save} onCancel={() => setSel(null)} onDelete={sel.id ? () => del(sel.id) : undefined} saving={upsert.isPending} msg={msg} forms={forms} />
          ) : (
            <div className="py-20 text-center text-[12px] text-ink3">좌측에서 룰을 선택하거나 추가하세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const scopeLabel = (r: ApprovalRouteRule) =>
  r.deptScope.kind === '전체' ? '전체부서'
    : r.deptScope.kind === '부서유형' ? `유형=${r.deptScope.deptType}`
      : `${r.deptScope.kind}=${r.deptScope.deptId}`;

function RuleEditor({ rule, onChange, onSave, onCancel, onDelete, saving, msg, forms }: {
  rule: ApprovalRouteRule; onChange: (r: ApprovalRouteRule) => void;
  onSave: () => void; onCancel: () => void; onDelete?: () => void; saving: boolean; msg: string;
  forms: Array<{ code: string; name: string }>;
}) {
  const set = (patch: Partial<ApprovalRouteRule>) => onChange({ ...rule, ...patch });
  const setStep = (i: number, patch: Partial<RouteStep>) => set({ steps: rule.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStep = () => set({ steps: [...rule.steps, { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: false }] });
  const delStep = (i: number) => set({ steps: rule.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= rule.steps.length) return;
    const next = [...rule.steps];[next[i], next[j]] = [next[j], next[i]]; set({ steps: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{rule.id ? `룰 편집 · ${rule.id}` : '새 룰'}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2"><input type="checkbox" checked={rule.active} onChange={(e) => set({ active: e.target.checked })} /> 사용</label>
      </div>

      {/* 기본 */}
      <div className="grid grid-cols-2 gap-2">
        <F label="룰 이름"><input value={rule.name} onChange={(e) => set({ name: e.target.value })} className={inp} /></F>
        <F label="우선순위(작을수록 먼저)"><input type="number" value={rule.priority} onChange={(e) => set({ priority: Number(e.target.value) })} className={inp} /></F>
      </div>

      {/* 적용 조건 */}
      <div className="rounded-lg border border-border bg-panel-alt p-2.5">
        <div className="mb-2 text-[11px] font-bold text-ink2">적용 조건</div>
        <div className="grid grid-cols-2 gap-2">
          <F label="문서유형">
            <select value={rule.docType} onChange={(e) => set({ docType: e.target.value })} className={inp}>
              <option value="전체">전체</option>
              {forms.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
            </select>
          </F>
          <F label="부서 범위">
            <select value={rule.deptScope.kind} onChange={(e) => set({ deptScope: { ...rule.deptScope, kind: e.target.value as never } })} className={inp}>
              {['전체', '부서', '서브트리', '부서유형'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </F>
          {rule.deptScope.kind === '부서유형' && (
            <F label="부서 유형">
              <select value={rule.deptScope.deptType ?? '본사'} onChange={(e) => set({ deptScope: { ...rule.deptScope, deptType: e.target.value as never } })} className={inp}>
                {DEPT_TYPES.filter((t) => t !== '공장').map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </F>
          )}
          {(rule.deptScope.kind === '부서' || rule.deptScope.kind === '서브트리') && (
            <F label="부서 ID"><input value={rule.deptScope.deptId ?? ''} onChange={(e) => set({ deptScope: { ...rule.deptScope, deptId: e.target.value || null } })} placeholder="예: D200" className={inp} /></F>
          )}
          <F label="직급 rank ≥(상위)"><input type="number" value={rule.positionFromRank ?? ''} onChange={(e) => set({ positionFromRank: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
          <F label="직급 rank ≤(하위)"><input type="number" value={rule.positionToRank ?? ''} onChange={(e) => set({ positionToRank: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
          <F label="금액 이상"><input type="number" value={rule.amountFrom ?? ''} onChange={(e) => set({ amountFrom: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
          <F label="금액 미만"><input type="number" value={rule.amountTo ?? ''} onChange={(e) => set({ amountTo: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
        </div>
      </div>

      {/* 결재 단계 빌더 */}
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-ink2">결재 단계(관계형)</div>
        <div className="space-y-1.5">
          {rule.steps.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-2 py-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">{i + 1}</span>
              <select value={s.resolver} onChange={(e) => setStep(i, { resolver: e.target.value as Resolver })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none">
                {RESOLVERS.filter((r) => r !== 'ROLE_FACTORY_HEAD').map((r) => <option key={r} value={r}>{RESOLVER_LABEL[r]}</option>)}
              </select>
              {ARG_HINT[s.resolver] && (
                <input value={s.arg ?? ''} onChange={(e) => setStep(i, { arg: e.target.value })} placeholder={ARG_HINT[s.resolver]} className="w-20 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none" />
              )}
              <select value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as RouteStep['kind'] })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-semibold text-ink outline-none">
                {ROUTE_STEP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={s.dedupeSelf} onChange={(e) => setStep(i, { dedupeSelf: e.target.checked })} className="h-3 w-3" />셀프제외</label>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={s.optional} onChange={(e) => setStep(i, { optional: e.target.checked })} className="h-3 w-3" />선택</label>
              <div className="ml-auto flex items-center gap-1">
                <button onClick={() => moveStep(i, -1)} className="text-[9px] text-ink3 hover:text-ink">▲</button>
                <button onClick={() => moveStep(i, 1)} className="text-[9px] text-ink3 hover:text-ink">▼</button>
                <button onClick={() => delStep(i)} className="text-[12px] text-ink3 hover:text-red-500">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addStep} className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal">+ 단계 추가</button>
      </div>

      <RoutePreview rule={rule} />

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        {onDelete ? <button onClick={onDelete} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5">룰 삭제</button> : <span />}
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}

/** 시뮬레이터 — 편집 중인 룰로 특정 기안자·금액의 결재선을 실시간 미리보기(엔진 호출). */
function RoutePreview({ rule }: { rule: ApprovalRouteRule }) {
  const org = useOrgTree();
  const [drafterId, setDrafterId] = useState('');
  const [amount, setAmount] = useState('500000');
  const did = drafterId || org.users[0]?.id || '';

  const result = useMemo(() => {
    const drafter = org.users.find((u) => u.id === did);
    if (!drafter) return null;
    const dt: string = rule.docType === '전체' ? '기안' : rule.docType;
    return resolveRoute({ drafter, docType: dt, amount: amount === '' ? null : Number(amount), users: org.users, depts: org.depts, positions: org.positions, rules: [rule] });
  }, [rule, did, amount, org.users, org.depts, org.positions]);

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/30 p-2.5">
      <div className="mb-2 text-[11px] font-bold text-teal">🧪 시뮬레이터 — 이 룰이 만드는 결재선</div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={did} onChange={(e) => setDrafterId(e.target.value)} className="rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none">
          {org.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept} · {u.position}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="금액" className="w-24 rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none" />
      </div>
      <div className="mt-2 text-[12px]">
        {result && result.steps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink3">{nameOf(did)}(기안)</span>
            {result.steps.map((s) => (
              <span key={s.seq} className="flex items-center gap-1.5">
                <span className="text-ink3">→</span>
                <span className="rounded-md bg-panel px-2 py-0.5 font-semibold text-ink">{nameOf(s.approverId)} <span className="text-[10px] text-teal">{s.kind}</span></span>
              </span>
            ))}
            <span className="ml-1 text-[10px] text-ink3">({result.rule ? `룰 적용` : '폴백'})</span>
          </div>
        ) : (
          <span className="text-ink3">결재선이 생성되지 않았습니다(조건 미매칭 또는 해석 불가 → 상신 시 다른 룰/폴백 적용).</span>
        )}
      </div>
    </div>
  );
}

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[10.5px] font-semibold text-ink3">{label}</span>{children}</label>;
}
