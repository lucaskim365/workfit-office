import { useMemo, useState } from 'react';
import { FlaskConical, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';
import { BizHead, BizListCard } from '../_biz';
import { PurchaseOrderPeek } from './PurchaseOrderPeek';
import { DONE_BG, PurchaseTable } from './PurchaseTable';
import {
  EXPENSE_LABEL,
  EXPENSE_STATUSES,
  GROUP_MODES,
  GROUP_MODE_LABEL,
  MOCK_PURCHASE_PAYMENTS,
  payMonthOf,
  summarize,
  type GroupMode,
  type PurchasePayment,
} from './purchaseMock';

const won = (n: number) => n.toLocaleString('ko-KR');
const ALL = 'all';
const EMPTY = { month: ALL, bizType: ALL, expense: ALL, q: '' };

/** 사업관리 › 매입 결제 관리 — 보여주기용(목업 데이터, 저장되지 않음). 한 줄 = 발주서 지급 조건의 한 번 */
export default function BizPurchaseScreen() {
  const [rows, setRows] = useState<PurchasePayment[]>(MOCK_PURCHASE_PAYMENTS);
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showAccount, setShowAccount] = useState(false);
  const [peek, setPeek] = useState<PurchasePayment | null>(null);

  const months = useMemo(() => [...new Set(rows.map(payMonthOf))].sort(), [rows]);
  const bizTypes = useMemo(() => [...new Set(rows.map((r) => r.bizType))].sort(), [rows]);

  const shown = useMemo(() => {
    const q = applied.q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (applied.month === ALL || payMonthOf(r) === applied.month) &&
        (applied.bizType === ALL || r.bizType === applied.bizType) &&
        (applied.expense === ALL || r.expense === applied.expense) &&
        (!q || [r.client, r.vendor, r.poDocNo, ...r.items].some((t) => t.toLowerCase().includes(q)))
    );
  }, [rows, applied]);
  const summary = useMemo(() => summarize(shown), [shown]);

  const patch = (id: string, change: Partial<PurchasePayment>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const search = () => setApplied(draft);
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
  };

  return (
    <div className="flex flex-col gap-4">
      <BizHead group="사업 관리" title="매입 결제 관리" desc="결재가 끝난 발주서의 지급 조건(선금·중도금·잔금)을 한 줄씩 모아, 세금계산서 발행과 결제를 관리합니다." />

      <p className="flex items-center gap-2 rounded-[10px] border border-amber/30 bg-amber/10 px-4 py-2.5 text-[12px] font-semibold text-amber">
        <FlaskConical size={14} className="shrink-0" />
        보여주기용 화면입니다. 지어낸 데이터이고, 여기서 바꾼 값은 저장되지 않습니다(새로 고치면 처음으로 돌아갑니다).
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="매입 합계 · VAT 포함" value={`${won(summary.total)}원`} sub={`공급가액 ${won(summary.supply)} · 부가세 ${won(summary.vat)}`} />
        <SummaryCard label="세금계산서 발행 완료" value={`${won(summary.issuedTotal)}원`} sub={`${summary.issuedCount}건 / 총 ${summary.count}건`} />
        <SummaryCard label="진행률 (발행 완료 ÷ 매입 합계)" value={`${Math.round(summary.progress * 100)}%`} bar={summary.progress} />
        <SummaryCard label="결제 완료" value={`${won(summary.paidTotal)}원`} sub={`${summary.paidCount}건 · 남은 금액 ${won(summary.total - summary.paidTotal)}원`} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border bg-panel p-4">
        <div className="w-36">
          <Field label="결제 예정월">
            <SelectField
              value={draft.month}
              onChange={(e) => setDraft({ ...draft, month: e.target.value })}
              options={[{ value: ALL, label: '전체' }, ...months.map((m) => ({ value: m, label: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` }))]}
            />
          </Field>
        </div>
        <div className="w-36">
          <Field label="사업구분">
            <SelectField
              value={draft.bizType}
              onChange={(e) => setDraft({ ...draft, bizType: e.target.value })}
              options={[{ value: ALL, label: '전체' }, ...bizTypes.map((b) => ({ value: b, label: b }))]}
            />
          </Field>
        </div>
        <div className="w-32">
          <Field label="지출결의서">
            <SelectField
              value={draft.expense}
              onChange={(e) => setDraft({ ...draft, expense: e.target.value })}
              options={[{ value: ALL, label: '전체' }, ...EXPENSE_STATUSES.map((s) => ({ value: s, label: EXPENSE_LABEL[s] }))]}
            />
          </Field>
        </div>
        <div className="min-w-[220px] flex-1">
          <Field label="도입기업·발주처·발주 내역·문서번호 검색">
            <TextField
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="도입기업, 발주처, 품목 또는 결재 문서번호"
              className="w-full"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={search}><Search size={13} /> 검색</Button>
          <Button onClick={reset}><RotateCcw size={13} /> 초기화</Button>
        </div>
      </div>

      {/* contain:inline-size — 칸이 많은 표가 페이지 전체를 넓히지 않고 상자 안에서만 옆으로 밀리게(발주 현황과 같은 처리) */}
      <div className="[contain:inline-size]">
        <BizListCard
          title="매입 결제 목록"
          count={
            <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 font-semibold text-ink2">
              <span className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-sm border border-ok/30 ${DONE_BG}`} />
                끝난 칸
              </span>
              <label className="flex items-center gap-1.5">
                묶어 보기
                <select
                  value={groupMode}
                  onChange={(e) => setGroupMode(e.target.value as GroupMode)}
                  className="h-7 rounded-md border border-border-hi bg-panel px-2 text-[11px] text-ink2 outline-none focus:border-teal"
                >
                  {GROUP_MODES.map((m) => <option key={m} value={m}>{GROUP_MODE_LABEL[m]}</option>)}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showAccount} onChange={(e) => setShowAccount(e.target.checked)} className="accent-teal" />
                거래처 계좌 정보 보기
              </label>
              <span className="text-teal">{shown.length}건</span>
            </span>
          }
        >
          <PurchaseTable rows={shown} groupMode={groupMode} showAccount={showAccount} onPatch={patch} onPeek={setPeek} />
        </BizListCard>
      </div>

      {peek && <PurchaseOrderPeek row={peek} siblings={rows.filter((r) => r.no === peek.no)} onClose={() => setPeek(null)} />}
    </div>
  );
}

function SummaryCard({ label, value, sub, bar }: { label: string; value: string; sub?: string; bar?: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-border bg-panel px-4 py-3 shadow-[0_1px_2px_rgba(23,34,65,0.04)]">
      <span className="text-[11px] font-bold text-ink3">{label}</span>
      <span className="text-lg font-extrabold tracking-tight text-ink tabular-nums">{value}</span>
      {sub && <span className="text-[11px] text-ink3 tabular-nums">{sub}</span>}
      {bar !== undefined && (
        <span className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-alt">
          <span className="block h-full rounded-full bg-teal" style={{ width: `${Math.min(100, Math.round(bar * 100))}%` }} />
        </span>
      )}
    </div>
  );
}
