import { useRef, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, FileText, PenLine } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { BizEmptyRow, bizTd, bizTh } from '../_biz';
import { ColumnFilterButton, DateFilterPanel, SetFilterPanel } from './ColumnFilter';
import {
  DATE_FILTERS,
  SET_FILTERS,
  isFilterOn,
  setFilterOptions,
  withDateFilter,
  withSetFilter,
  type ColumnFilters,
  type DateFilterKey,
  type SetFilterKey,
} from './purchaseFilter';
import {
  EXPENSE_LABEL,
  MOCK_VENDOR_ACCOUNTS,
  groupPayments,
  isBuildDone,
  shortItems,
  summarize,
  totalOf,
  vatOf,
  type ExpenseStatus,
  type GroupMode,
  type PaymentGroup,
  type PurchasePayment,
} from './purchaseMock';

const won = (n: number) => n.toLocaleString('ko-KR');

const EXPENSE_TONE: Record<ExpenseStatus, Tone> = { none: 'mute', drafting: 'info', inProgress: 'warn', rejected: 'err', approved: 'ok' };

const num = `${bizTd} text-right tabular-nums`;
/** 두 줄 칸의 아랫줄(덜 중요한 값) */
const sub = 'text-[11px] text-ink3';
/** 끝난 칸의 배경 — 끝난 것과 남은 것을 한눈에 가른다(화면 위 '완료' 범례와 같은 색) */
export const DONE_BG = 'bg-ok/10';
const done = (yes: boolean) => (yes ? DONE_BG : '');

interface Props {
  /** 보일 줄(필터를 거친 것) */
  rows: PurchasePayment[];
  /** 필터 창에서 고를 값을 뽑을 줄(열 필터를 걸기 전) */
  optionRows: PurchasePayment[];
  filters: ColumnFilters;
  onFilters: (next: ColumnFilters) => void;
  groupMode: GroupMode;
  showAccount: boolean;
  onPatch: (id: string, change: Partial<PurchasePayment>) => void;
  onPeek: (row: PurchasePayment) => void;
}

/**
 * 매입 결제 목록 표 — 한 줄 = 지급 조건의 한 번.
 * 짝이 되는 값은 한 칸에 두 줄로 묶어(도입기업·사업구분, 예정 발행일·결제일 등) 옆으로 밀지 않고 한 화면에 들어오게 한다.
 * 묶어 보기를 켜면 묶음 머리 줄에 도입기업·사업구분(·발주처)이 나오므로 그 칸은 표에서 뺀다.
 */
export function PurchaseTable({ rows, optionRows, filters, onFilters, groupMode, showAccount, onPatch, onPeek }: Props) {
  /** 값 필터 단추(열 제목 옆 깔때기) */
  const setFilter = (key: SetFilterKey) => (
    <ColumnFilterButton label={SET_FILTERS[key].label} active={isFilterOn(filters, key)}>
      <SetFilterPanel options={setFilterOptions(optionRows, key)} value={filters.sets[key]} onChange={(v) => onFilters(withSetFilter(filters, key, v))} />
    </ColumnFilterButton>
  );
  /** 날짜 필터 단추 */
  const dateFilter = (key: DateFilterKey) => (
    <ColumnFilterButton label={DATE_FILTERS[key].label} active={isFilterOn(filters, key)}>
      <DateFilterPanel value={filters.dates[key]} canBeEmpty={DATE_FILTERS[key].canBeEmpty} onChange={(v) => onFilters(withDateFilter(filters, key, v))} />
    </ColumnFilterButton>
  );

  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const grouped = groupMode !== 'none';
  /** 발주처까지 묶으면 발주처 칸에는 발주 내역만 남는다 */
  const vendorInHead = groupMode === 'clientVendor';
  /** 발주서 묶음의 칸 수 — 번호·(도입기업)·발주처·지급 조건·예정일·금액 */
  const poCols = grouped ? 5 : 6;
  const colCount = poCols + 5 + (showAccount ? 3 : 0);
  const summary = summarize(rows);

  const headGroups = [
    { label: '발주서 (결재 끝난 발주서에서 자동)', span: poCols, tone: 'bg-teal/10 text-teal' },
    { label: '경영기획팀', span: 1, tone: 'bg-blue/10 text-blue' },
    { label: '인프라팀', span: 1, tone: 'bg-amber/10 text-amber' },
    { label: '지출결의서', span: 1, tone: 'bg-ok/10 text-ok' },
    { label: '경영기획팀', span: 2, tone: 'bg-blue/10 text-blue' },
    ...(showAccount ? [{ label: '거래처 정보 (자동)', span: 3, tone: 'bg-ink3/10 text-ink2' }] : []),
  ];

  const renderRow = (r: PurchasePayment) => {
    const account = MOCK_VENDOR_ACCOUNTS[r.vendor];
    const items = (
      <button onClick={() => onPeek(r)} title={r.items.join(', ')} className="flex items-center gap-1 text-[11px] font-semibold text-ink2 hover:text-teal">
        <FileText size={11} className="shrink-0 text-ink3" />
        <span className="underline decoration-border-hi underline-offset-2">{shortItems(r.items)}</span>
      </button>
    );
    return (
      <tr key={r.id} className="hover:bg-panel-alt/40">
        <td className={`${bizTd} text-center text-ink3`}>{r.no}</td>
        {!grouped && (
          <td className={bizTd}>
            <Two top={<span className="font-semibold text-ink">{r.client}</span>} bottom={<span className={sub}>{r.bizType}</span>} />
          </td>
        )}
        <td className={bizTd}>{vendorInHead ? items : <Two top={r.vendor} bottom={items} />}</td>
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
        <td className={`${bizTd} text-center ${done(r.salesVatCollected)}`}>
          <button
            onClick={() => onPatch(r.id, { salesVatCollected: !r.salesVatCollected })}
            title="누르면 바뀝니다"
            className={`h-6 w-8 rounded-md text-[11px] font-extrabold ${r.salesVatCollected ? 'text-ok' : 'bg-danger/10 text-danger'}`}
          >
            {r.salesVatCollected ? 'O' : 'X'}
          </button>
        </td>
        <td className={`${bizTd} ${done(isBuildDone(r))}`}>
          <Two
            top={<DateEdit label="시작" value={r.buildFrom} onChange={(v) => onPatch(r.id, { buildFrom: v })} />}
            bottom={<DateEdit label="종료" value={r.buildTo} min={r.buildFrom} onChange={(v) => onPatch(r.id, { buildTo: v })} />}
          />
        </td>
        <td className={`${bizTd} text-center ${done(r.expense === 'approved')}`}>
          {r.expense === 'none' ? (
            <Button size="sm" onClick={() => onPatch(r.id, { expense: 'drafting' })}><PenLine size={11} /> 기안 작성</Button>
          ) : (
            <Pill tone={EXPENSE_TONE[r.expense]}>{EXPENSE_LABEL[r.expense]}</Pill>
          )}
        </td>
        <td className={`${bizTd} ${done(!!r.taxDate)}`}>
          <span className="flex items-center gap-1.5">
            <DateEdit value={r.taxDate} onChange={(v) => onPatch(r.id, { taxDate: v })} />
            {!r.taxDate && (
              <button
                onClick={() => onPatch(r.id, { taxRequested: !r.taxRequested })}
                title="누르면 바뀝니다"
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${r.taxRequested ? 'bg-amber/10 text-amber' : 'bg-ink3/10 text-ink3'}`}
              >
                {r.taxRequested ? '발행 요청함' : '발행 요청'}
              </button>
            )}
          </span>
        </td>
        <td className={`${bizTd} ${done(!!r.payDate)}`}>
          <DateEdit value={r.payDate} onChange={(v) => onPatch(r.id, { payDate: v })} />
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
  };

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          {headGroups.map((g, i) => (
            <th key={i} colSpan={g.span} className={`border-l border-panel px-3 py-1.5 text-center text-[10.5px] font-bold whitespace-nowrap first:border-l-0 ${g.tone}`}>
              {g.label}
            </th>
          ))}
        </tr>
        <tr>
          <th className={`${bizTh} text-center`}>번호</th>
          {!grouped && <Th2 top="도입기업" bottom="사업구분" topExtra={setFilter('client')} bottomExtra={setFilter('bizType')} />}
          {vendorInHead ? <th className={bizTh}>발주 내역</th> : <Th2 top="발주처" bottom="발주 내역" topExtra={setFilter('vendor')} />}
          <th className={bizTh}>지급 조건{setFilter('term')}</th>
          <Th2 top="(예정) 계산서 발행일" bottom="(예정) 결제일" topExtra={dateFilter('planTax')} bottomExtra={dateFilter('planPay')} />
          <Th2 top="매입 합계" bottom="공급가액 + 부가세" right />
          <th className={`${bizTh} text-center`}>매출 부가세 수금{setFilter('salesVat')}</th>
          <th className={bizTh}>구축일{dateFilter('build')}</th>
          <th className={`${bizTh} text-center`}>진행{setFilter('expense')}</th>
          <th className={bizTh}>(확정) 계산서 발행일{dateFilter('tax')}</th>
          <th className={bizTh}>(확정) 결제일{dateFilter('pay')}</th>
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
        {rows.length === 0 && <BizEmptyRow colSpan={colCount}>조건에 맞는 매입 결제 건이 없습니다.</BizEmptyRow>}
        {groupMode === 'none'
          ? rows.map(renderRow)
          : groupPayments(rows, groupMode).flatMap((g) => [
              <GroupHead key={`g:${g.key}`} group={g} colCount={colCount} open={!closed.has(g.key)} onToggle={() => toggle(g.key)} />,
              ...(closed.has(g.key) ? [] : g.rows.map(renderRow)),
            ])}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-panel-alt font-extrabold text-ink">
            <td colSpan={poCols - 1} className={`${bizTd} border-b-0 text-right`}>합계</td>
            <td className={`${num} border-b-0`}>
              <Two top={won(summary.total)} bottom={<span className={`${sub} font-semibold`}>{won(summary.supply)} + {won(summary.vat)}</span>} />
            </td>
            <td colSpan={colCount - poCols} className={`${bizTd} border-b-0`} />
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** 묶음 머리 줄 — 도입기업·사업구분(·발주처), 건수, 결제 끝난 건수, 묶음 합계. 누르면 접고 편다 */
function GroupHead({ group, colCount, open, onToggle }: { group: PaymentGroup; colCount: number; open: boolean; onToggle: () => void }) {
  const s = summarize(group.rows);
  return (
    <tr className="bg-panel-alt/70">
      <td colSpan={colCount} className="border-b border-border px-3 py-2">
        <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-[12px]">
          {open ? <ChevronDown size={14} className="shrink-0 text-ink3" /> : <ChevronRight size={14} className="shrink-0 text-ink3" />}
          <span className="font-extrabold text-ink">{group.client}</span>
          <span className="text-ink3">{group.bizType}</span>
          {group.vendor && (
            <>
              <span className="text-ink3">›</span>
              <span className="font-bold text-ink2">{group.vendor}</span>
            </>
          )}
          <Pill tone="mute">{s.count}건</Pill>
          <Pill tone={s.paidCount === s.count ? 'ok' : 'info'}>결제 완료 {s.paidCount}/{s.count}</Pill>
          <span className="ml-auto font-bold text-ink tabular-nums">{won(s.total)}원</span>
        </button>
      </td>
    </tr>
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

/** 두 줄 칸의 머리 — 윗줄 이름, 아랫줄 이름(흐리게). extra: 이름 옆에 붙일 것(열 필터 단추) */
function Th2({ top, bottom, right = false, topExtra, bottomExtra }: { top: string; bottom: string; right?: boolean; topExtra?: ReactNode; bottomExtra?: ReactNode }) {
  return (
    <th className={`${bizTh} leading-tight ${right ? 'text-right' : ''}`}>
      {top}
      {topExtra}
      <span className="block font-semibold text-ink3">
        {bottom}
        {bottomExtra}
      </span>
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

/**
 * 고칠 수 있는 날짜 — 날짜 글자와 달력 아이콘이 늘 보이고, 누르면 바로 달력이 뜬다.
 * 날짜 입력 상자를 칸마다 띄워 두면 표가 넓어져서, 보이지 않는 입력 상자를 두고 달력만 불러낸다.
 */
function DateEdit({ label, value, min, onChange }: { label?: string; value: string; min?: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus(); // 달력을 바로 띄우지 못하는 브라우저 — 입력 상자로 넘긴다
    }
  };
  return (
    <span className="flex items-center gap-1.5">
      {label && <span className={dateLabel}>{label}</span>}
      <span className="relative inline-flex">
        <button
          onClick={open}
          title="누르면 달력이 뜹니다"
          className={`-mx-1 flex items-center gap-1 rounded px-1 tabular-nums hover:bg-panel-alt ${value ? 'text-ink' : 'text-ink3'}`}
        >
          {value || '날짜 선택'}
          <CalendarDays size={12} className="shrink-0 text-ink3" />
        </button>
        <input
          ref={input}
          type="date"
          tabIndex={-1}
          aria-label={label ?? '날짜'}
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
        />
      </span>
    </span>
  );
}
