import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';
import { BizHead, BizListCard } from '../_biz';
import { PurchaseOrderPeek } from './PurchaseOrderPeek';
import { DONE_BG, PurchaseTable } from './PurchaseTable';
import { NO_FILTERS, activeFilters, clearFilter, matchFilters, type ColumnFilters } from './purchaseFilter';
import { MOCK_PURCHASE_PAYMENTS, MOCK_VENDOR_ACCOUNTS } from './purchaseMock';
import {
  GROUP_MODES,
  GROUP_MODE_LABEL,
  payMonthOf,
  summarize,
  vendorKey,
  type GroupMode,
  type LedgerPatch,
  type PurchasePayment,
} from '@/domain/purchasePayment/ledger';
import { useAuthz } from '@/features/authz/useAuthz';
import { usePatchPurchasePayment, usePurchaseLedger, usePurchaseOrderSync, useVendorAccounts } from '@/features/purchasePayment/usePurchasePayments';
import { PURCHASE_LEDGER_SYNC_ENABLED } from '@/domain/purchasePayment/fromDoc';

const won = (n: number) => n.toLocaleString('ko-KR');
const ALL = 'all';
const EMPTY = { month: ALL, q: '' };
/** 예시 데이터의 발주처 계좌 — 실제 데이터와 같은 키(vendorKey)로 */
const DEMO_ACCOUNTS = Object.fromEntries(Object.entries(MOCK_VENDOR_ACCOUNTS).map(([name, a]) => [vendorKey(name), a]));

/**
 * 사업관리 › 매입 결제 관리 — 한 줄 = 발주서 지급 조건의 한 번(선금·중도금·잔금).
 * 결재가 끝난 발주서(시트 서식·연동 기능 '발주')가 대장에 올라오고, 세금계산서 발행·결제·구축일을 여기서 적는다.
 * [예시 데이터]를 켜면 지어낸 데이터로 화면을 둘러볼 수 있다(저장되지 않음) — 실제 발주서가 쌓이기 전 보여주기용.
 */
export default function BizPurchaseScreen() {
  const navigate = useNavigate();
  const { canManage } = useAuthz();
  const canEdit = canManage('biz.purchase.manage');
  const ledger = usePurchaseLedger();
  // 결재가 끝난 발주서를 대장에 올리는 일 — 관리 권한이 있는 사람이 이 화면을 열 때
  const sync = usePurchaseOrderSync(canEdit);
  const patchPayment = usePatchPurchasePayment();
  const realAccounts = useVendorAccounts();

  const [demo, setDemo] = useState(false);
  const [demoRows, setDemoRows] = useState<PurchasePayment[]>(MOCK_PURCHASE_PAYMENTS);
  const rows = demo ? demoRows : ledger.rows;
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [filters, setFilters] = useState<ColumnFilters>(NO_FILTERS);
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [showAccount, setShowAccount] = useState(false);
  const [peek, setPeek] = useState<PurchasePayment | null>(null);

  // 예정 결제일을 안 적은 줄은 월이 없다 — 월 고르기에는 넣지 않고 '전체'에서만 보인다
  const months = useMemo(() => [...new Set(rows.map(payMonthOf).filter(Boolean))].sort(), [rows]);

  /** 위쪽 검색 줄(결제 예정월·검색어)을 거친 줄 — 열 필터 창의 고를 값도 여기서 뽑는다 */
  const searched = useMemo(() => {
    const q = applied.q.trim().toLowerCase();
    return rows.filter(
      (r) => (applied.month === ALL || payMonthOf(r) === applied.month) && (!q || [r.client, r.vendor, r.poDocNo, ...r.items].some((t) => t.toLowerCase().includes(q)))
    );
  }, [rows, applied]);
  const shown = useMemo(() => searched.filter((r) => matchFilters(r, filters)), [searched, filters]);
  const summary = useMemo(() => summarize(shown), [shown]);
  const chips = activeFilters(filters);

  const patchDemo = (id: string, change: Partial<PurchasePayment>) => setDemoRows((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const patch = (id: string, change: LedgerPatch) => (demo ? patchDemo(id, change) : patchPayment.mutate({ id, change }));
  const search = () => setApplied(draft);
  const reset = () => {
    setDraft(EMPTY);
    setApplied(EMPTY);
    setFilters(NO_FILTERS);
  };

  return (
    <div className="flex flex-col gap-4">
      <BizHead group="사업 관리" title="매입 결제 관리" desc="결재가 끝난 발주서의 지급 조건(선금·중도금·잔금)을 한 줄씩 모아, 세금계산서 발행과 결제를 관리합니다." />

      {demo ? (
        <p className="flex items-center gap-2 rounded-[10px] border border-amber/30 bg-amber/10 px-4 py-2.5 text-[12px] font-semibold text-amber">
          <FlaskConical size={14} className="shrink-0" />
          예시 데이터입니다. 지어낸 값이고, 여기서 바꾼 값은 저장되지 않습니다(새로 고치면 처음으로 돌아갑니다).
        </p>
      ) : (
        <>
          {patchPayment.isError && (
            <p className="rounded-[10px] border border-danger/30 bg-danger/10 px-4 py-2.5 text-[12px] font-semibold text-danger">저장하지 못했습니다. 잠시 뒤 다시 해 주세요.</p>
          )}
          {ledger.error ? (
            <p className="rounded-[10px] border border-danger/30 bg-danger/10 px-4 py-2.5 text-[12px] font-semibold text-danger">매입 결제 대장을 불러오지 못했습니다. 잠시 뒤 새로 고쳐 주세요.</p>
          ) : (
            !ledger.isLoading &&
            ledger.rows.length === 0 && (
              <p className="rounded-[10px] border border-border bg-panel px-4 py-2.5 text-[12px] text-ink2">
                {PURCHASE_LEDGER_SYNC_ENABLED
                  ? '대장에 올라온 발주서가 아직 없습니다. 발주 연동을 켠 시트 서식 발주서의 결재가 끝난 뒤, 매입 결제 관리 권한이 있는 사람이 이 화면을 열면 올라옵니다. 화면은 목록 위의 [예시 데이터]로 둘러볼 수 있습니다.'
                  : '매입 결제 대장은 준비 중입니다. 발주서와는 아직 이어져 있지 않아 결재가 끝난 발주서가 올라오지 않습니다. 화면은 목록 위의 [예시 데이터]로 둘러볼 수 있습니다.'}
              </p>
            )
          )}
          {sync.failed > 0 && (
            <p className="flex flex-wrap items-center gap-3 rounded-[10px] border border-danger/30 bg-danger/10 px-4 py-2.5 text-[12px] font-semibold text-danger">
              발주서 지급 줄 {sync.failed}개를 대장에 올리지 못했습니다. 합계가 실제보다 적을 수 있습니다.
              <Button size="sm" onClick={sync.retry}>다시 시도</Button>
            </p>
          )}
        </>
      )}

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
              <label className="flex cursor-pointer items-center gap-1.5" title="지어낸 데이터로 화면을 둘러봅니다(저장되지 않음)">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => {
                    setDemo(e.target.checked);
                    // 실제 데이터와 예시 데이터는 값이 달라 걸어 둔 필터가 맞지 않는다
                    reset();
                  }}
                  className="accent-teal"
                />
                예시 데이터
              </label>
              <span className="text-teal">{shown.length}건</span>
            </span>
          }
        >
          {/* sticky — 표를 옆으로 밀어도 꼬리표는 제자리에 */}
          {chips.length > 0 && (
            <div className="sticky left-0 flex flex-wrap items-center gap-1.5 px-4 pb-3">
              <span className="text-[11px] font-bold text-ink3">열 필터</span>
              {chips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setFilters(clearFilter(filters, c.key))}
                  title="누르면 이 필터를 풉니다"
                  className="flex items-center gap-1 rounded-full bg-teal/10 py-0.5 pr-1.5 pl-2.5 text-[11px] font-bold text-teal hover:bg-teal/20"
                >
                  {c.text}
                  <X size={11} />
                </button>
              ))}
              <button onClick={() => setFilters(NO_FILTERS)} className="rounded px-1.5 py-0.5 text-[11px] font-bold text-ink3 hover:bg-panel-alt hover:text-ink2">모두 지우기</button>
            </div>
          )}
          <PurchaseTable
            rows={shown}
            optionRows={searched}
            filters={filters}
            onFilters={setFilters}
            groupMode={groupMode}
            showAccount={showAccount}
            accounts={demo ? DEMO_ACCOUNTS : realAccounts}
            readOnly={!demo && !canEdit}
            onPatch={patch}
            // 지출결의서 기안은 아직 예시 데이터에서만(누르면 '작성중'으로) — 실제 연결은 다음 단계
            onDraftExpense={demo ? (r) => patchDemo(r.id, { expense: 'drafting' }) : undefined}
            onPeek={setPeek}
          />
        </BizListCard>
      </div>

      {peek && (
        <PurchaseOrderPeek
          row={peek}
          siblings={rows.filter((r) => r.no === peek.no)}
          onOpenDoc={demo ? undefined : () => navigate(`/gw/approval?doc=${encodeURIComponent(peek.poDocNo)}`)}
          onClose={() => setPeek(null)}
        />
      )}
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
