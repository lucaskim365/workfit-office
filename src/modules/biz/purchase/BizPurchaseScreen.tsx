import { useMemo, useState, type ReactNode } from 'react';
import { FileText, FlaskConical, PenLine, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { Field } from '@/shared/ui/form/Field';
import { SelectField } from '@/shared/ui/form/SelectField';
import { TextField } from '@/shared/ui/form/TextField';
import { BizEmptyRow, BizHead, BizListCard, bizTd, bizTh } from '../_biz';
import {
  EXPENSE_LABEL,
  EXPENSE_STATUSES,
  MOCK_PURCHASE_PAYMENTS,
  MOCK_VENDOR_ACCOUNTS,
  payMonthOf,
  shortItems,
  summarize,
  totalOf,
  vatOf,
  type ExpenseStatus,
  type PurchasePayment,
} from './purchaseMock';

const won = (n: number) => n.toLocaleString('ko-KR');
const ALL = 'all';
const EMPTY = { month: ALL, bizType: ALL, expense: ALL, q: '' };

const EXPENSE_TONE: Record<ExpenseStatus, Tone> = { none: 'mute', drafting: 'info', inProgress: 'warn', rejected: 'err', approved: 'ok' };

/** 표 머리 묶음 — 값이 어디서 오는지(누가 넣는지)를 열 위에 보인다 */
const GROUPS = [
  { label: '발주서 (결재 끝난 발주서에서 자동)', span: 6, tone: 'bg-teal/10 text-teal' },
  { label: '경영기획팀', span: 1, tone: 'bg-blue/10 text-blue' },
  { label: '인프라팀', span: 1, tone: 'bg-amber/10 text-amber' },
  { label: '지출결의서', span: 1, tone: 'bg-ok/10 text-ok' },
  { label: '경영기획팀', span: 1, tone: 'bg-blue/10 text-blue' },
] as const;
const ACCOUNT_GROUP = { label: '거래처 정보 (자동)', span: 3, tone: 'bg-ink3/10 text-ink2' };
/** 발주서 묶음의 칸 수 — 합계 줄이 금액 칸 앞뒤를 비울 때 쓴다 */
const PO_COLS = GROUPS[0].span;

const num = `${bizTd} text-right tabular-nums`;
/** 두 줄 칸의 아랫줄(덜 중요한 값) */
const sub = 'text-[11px] text-ink3';

/** 사업관리 › 매입 결제 관리 — 보여주기용(목업 데이터, 저장되지 않음). 한 줄 = 발주서 지급 조건의 한 번 */
export default function BizPurchaseScreen() {
  const [rows, setRows] = useState<PurchasePayment[]>(MOCK_PURCHASE_PAYMENTS);
  const [draft, setDraft] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
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

  const groups = showAccount ? [...GROUPS, ACCOUNT_GROUP] : GROUPS;
  const colCount = groups.reduce((a, g) => a + g.span, 0);

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
          <label className="flex cursor-pointer items-center gap-3 text-ink2">
            <span className="text-teal">{shown.length}건</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={showAccount} onChange={(e) => setShowAccount(e.target.checked)} className="accent-teal" />
              거래처 계좌 정보 보기
            </span>
          </label>
        }
      >
        {/* 한눈에 들어오게 짝이 되는 값을 한 칸에 두 줄로 묶는다(도입기업·사업구분, 발행일·결제일 등) — 칸마다 따로 두면 옆으로 밀어야 보인다 */}
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className={`border-l border-panel px-3 py-1.5 text-center text-[10.5px] font-bold whitespace-nowrap first:border-l-0 ${g.tone}`}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className={`${bizTh} text-center`}>번호</th>
              <Th2 top="도입기업" bottom="사업구분" />
              <Th2 top="발주처" bottom="발주 내역" />
              <th className={bizTh}>지급 조건</th>
              <Th2 top="(예정) 계산서 발행일" bottom="(예정) 결제일" />
              <Th2 top="매입 합계" bottom="공급가액 + 부가세" right />
              <th className={`${bizTh} text-center`}>매출 부가세 수금</th>
              <th className={bizTh}>구축일</th>
              <th className={`${bizTh} text-center`}>진행</th>
              <Th2 top="(확정) 계산서 발행일" bottom="(확정) 결제일" />
              {showAccount && (
                <>
                  <Th2 top="은행" bottom="계좌번호" />
                  <Th2 top="예금주" bottom="대표자" />
                  <th className={bizTh}>사업자번호</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <BizEmptyRow colSpan={colCount}>조건에 맞는 매입 결제 건이 없습니다.</BizEmptyRow>}
            {shown.map((r) => {
              const account = MOCK_VENDOR_ACCOUNTS[r.vendor];
              return (
                <tr key={r.id} className="hover:bg-panel-alt/40">
                  <td className={`${bizTd} text-center text-ink3`}>{r.no}</td>
                  <td className={bizTd}>
                    <Two top={<span className="font-semibold text-ink">{r.client}</span>} bottom={<span className={sub}>{r.bizType}</span>} />
                  </td>
                  <td className={bizTd}>
                    <Two
                      top={r.vendor}
                      bottom={
                        <button onClick={() => setPeek(r)} title={r.items.join(', ')} className="flex items-center gap-1 text-[11px] font-semibold text-ink2 hover:text-teal">
                          <FileText size={11} className="shrink-0 text-ink3" />
                          <span className="underline decoration-border-hi underline-offset-2">{shortItems(r.items)}</span>
                        </button>
                      }
                    />
                  </td>
                  <td className={bizTd}>
                    <span className="font-semibold text-ink">{r.term}</span> <span className="tabular-nums text-ink3">{r.rate}%</span>
                  </td>
                  <td className={bizTd}>
                    <Two top={<DateLine label="발행" value={r.planTaxDate} />} bottom={<DateLine label="결제" value={r.planPayDate} />} />
                  </td>
                  <td className={num}>
                    <Two
                      top={<span className="font-bold text-ink">{won(totalOf(r.supply))}</span>}
                      bottom={<span className={sub}>{won(r.supply)} + {won(vatOf(r.supply))}</span>}
                    />
                  </td>
                  <td className={`${bizTd} text-center`}>
                    <button
                      onClick={() => patch(r.id, { salesVatCollected: !r.salesVatCollected })}
                      title="누르면 바뀝니다"
                      className={`h-6 w-8 rounded-md text-[11px] font-extrabold ${r.salesVatCollected ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'}`}
                    >
                      {r.salesVatCollected ? 'O' : 'X'}
                    </button>
                  </td>
                  <td className={bizTd}>
                    <Two
                      top={<DateEdit label="시작" value={r.buildFrom} onChange={(v) => patch(r.id, { buildFrom: v })} />}
                      bottom={<DateEdit label="종료" value={r.buildTo} min={r.buildFrom} onChange={(v) => patch(r.id, { buildTo: v })} />}
                    />
                  </td>
                  <td className={`${bizTd} text-center`}>
                    {r.expense === 'none' ? (
                      <Button size="sm" onClick={() => patch(r.id, { expense: 'drafting' })}><PenLine size={11} /> 기안 작성</Button>
                    ) : (
                      <Pill tone={EXPENSE_TONE[r.expense]}>{EXPENSE_LABEL[r.expense]}</Pill>
                    )}
                  </td>
                  <td className={bizTd}>
                    <Two
                      top={
                        <span className="flex items-center gap-1.5">
                          <DateEdit label="발행" value={r.taxDate} onChange={(v) => patch(r.id, { taxDate: v })} />
                          {!r.taxDate && (
                            <button
                              onClick={() => patch(r.id, { taxRequested: !r.taxRequested })}
                              title="누르면 바뀝니다"
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${r.taxRequested ? 'bg-amber/10 text-amber' : 'bg-ink3/10 text-ink3'}`}
                            >
                              {r.taxRequested ? '발행 요청함' : '발행 요청'}
                            </button>
                          )}
                        </span>
                      }
                      bottom={<DateEdit label="결제" value={r.payDate} onChange={(v) => patch(r.id, { payDate: v })} />}
                    />
                  </td>
                  {showAccount && (
                    <>
                      <td className={bizTd}>
                        <Two top={account?.bank ?? '-'} bottom={<span className={`${sub} tabular-nums`}>{account?.account ?? '-'}</span>} />
                      </td>
                      <td className={bizTd}>
                        <Two top={account?.holder ?? '-'} bottom={<span className={sub}>{account?.ceo ?? '-'}</span>} />
                      </td>
                      <td className={`${bizTd} tabular-nums`}>{account?.bizNo ?? '-'}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr className="bg-panel-alt font-extrabold text-ink">
                <td colSpan={PO_COLS - 1} className={`${bizTd} border-b-0 text-right`}>합계</td>
                <td className={`${num} border-b-0`}>
                  <Two top={won(summary.total)} bottom={<span className={`${sub} font-semibold`}>{won(summary.supply)} + {won(summary.vat)}</span>} />
                </td>
                <td colSpan={colCount - PO_COLS} className={`${bizTd} border-b-0`} />
              </tr>
            </tfoot>
          )}
        </table>
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

/** 발주 내역을 누르면 뜨는 창 — 실제 화면에서는 발주서 문서를 읽기 전용으로 연다 */
function PurchaseOrderPeek({ row, siblings, onClose }: { row: PurchasePayment; siblings: PurchasePayment[]; onClose: () => void }) {
  const supply = siblings.reduce((a, r) => a + r.supply, 0);
  return (
    <Modal open onClose={onClose} title={`발주서 · ${row.poDocNo}`} width={640}>
      <div className="flex flex-col gap-4 text-[12px] text-ink2">
        <p className="rounded-lg bg-panel-alt px-3 py-2 text-[11px] text-ink3">실제 화면에서는 이 자리에 결재가 끝난 발주서 문서가 읽기 전용으로 열립니다.</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Info label="사업구분">{row.bizType}</Info>
          <Info label="도입기업">{row.client}</Info>
          <Info label="발주처">{row.vendor}</Info>
          <Info label="공급가액 / 부가세">{won(supply)} / {won(vatOf(supply))}원</Info>
        </dl>
        <div>
          <h3 className="mb-1.5 text-[11px] font-bold text-ink3">발주 품목</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-ink">
            {row.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-[11px] font-bold text-ink3">지급 조건</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={bizTh}>구분</th>
                <th className={`${bizTh} text-right`}>비율</th>
                <th className={bizTh}>(예정) 계산서 발행일</th>
                <th className={bizTh}>(예정) 결제일</th>
                <th className={`${bizTh} text-right`}>공급가액</th>
              </tr>
            </thead>
            <tbody>
              {siblings.map((r) => (
                <tr key={r.id} className={r.id === row.id ? 'bg-teal/5' : undefined}>
                  <td className={`${bizTd} font-semibold text-ink`}>{r.term}</td>
                  <td className={num}>{r.rate}%</td>
                  <td className={bizTd}>{r.planTaxDate}</td>
                  <td className={bizTd}>{r.planPayDate}</td>
                  <td className={num}>{won(r.supply)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold text-ink3">{label}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}


/** 두 줄 칸 — 짝이 되는 값 둘을 위아래로 */
function Two({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 leading-tight">
      <div>{top}</div>
      <div>{bottom}</div>
    </div>
  );
}

/** 두 줄 칸의 머리 — 윗줄 이름, 아랫줄 이름(흐리게) */
function Th2({ top, bottom, right = false }: { top: string; bottom: string; right?: boolean }) {
  return (
    <th className={`${bizTh} leading-tight ${right ? 'text-right' : ''}`}>
      {top}
      <span className="block font-semibold text-ink3">{bottom}</span>
    </th>
  );
}

const dateLabel = 'w-6 shrink-0 text-[10px] text-ink3';

/** 날짜 한 줄(읽기 전용) — 앞에 무슨 날짜인지 작은 이름표 */
function DateLine({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={dateLabel}>{label}</span>
      <span className="tabular-nums">{value || '-'}</span>
    </span>
  );
}

/** 고칠 수 있는 날짜 한 줄 — 평소엔 글자, 누르면 날짜 입력 상자(칸 폭을 줄이려고 상자를 늘 띄워 두지 않는다) */
function DateEdit({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <span className="flex items-center gap-1.5">
      <span className={dateLabel}>{label}</span>
      {editing ? (
        <input
          type="date"
          autoFocus
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
          aria-label={label}
          className="h-6 w-[7.2rem] rounded-md border border-teal bg-panel px-1 text-[11px] text-ink outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="누르면 날짜를 고칩니다"
          className={`-mx-1 rounded px-1 tabular-nums underline decoration-dotted decoration-border-hi underline-offset-2 hover:bg-panel-alt ${value ? 'text-ink' : 'text-ink3'}`}
        >
          {value || '날짜 입력'}
        </button>
      )}
    </span>
  );
}
