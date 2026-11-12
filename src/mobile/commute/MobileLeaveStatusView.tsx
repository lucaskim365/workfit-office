import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCommuteEvaluation } from '@/features/commute/useCommuteEvaluation';
import { useScopedMonthLeaves } from '@/features/commute/useScopedMonthLeaves';
import { leaveChip, STATUS_TONES } from '@/domain/commute/statusDisplay';

const pad = (v: number) => String(v).padStart(2, '0');
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/**
 * PWA 근태 관제 '휴가 현황' — 한 달에 걸친 승인 휴가(웹 근태 '휴가 현황'과 같은 규칙, approvedLeavesInMonth).
 * 팀장은 자기 부서까지만(근태 관제와 같은 판정).
 */
export default function MobileLeaveStatusView() {
  const { approvals: approvalsData } = useCommuteEvaluation();
  const approvals = useMemo(() => approvalsData ?? [], [approvalsData]);
  const [month, setMonth] = useState(thisMonth);
  const [keyword, setKeyword] = useState('');
  // 볼 수 있는 휴가만(웹 휴가 현황과 같은 훅)
  const inScope = useScopedMonthLeaves(approvals, month);
  const leaves = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return inScope;
    return inScope.filter(({ doc }) => (doc.drafterName || '').toLowerCase().includes(kw) || (doc.drafterDept || '').toLowerCase().includes(kw));
  }, [inScope, keyword]);
  const totalDays = leaves.reduce((sum, l) => sum + l.days, 0);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-white/90 px-4 py-2">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-white text-ink2 active:scale-95" aria-label="이전 달">
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-black text-ink">
          {month.slice(0, 4)}년 {Number(month.slice(5))}월 · {leaves.length}건 · {totalDays}일
        </span>
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, 1))} className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-white text-ink2 active:scale-95" aria-label="다음 달">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="shrink-0 border-b border-border/40 bg-white/50 px-4 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink3" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="이름, 부서 검색..."
            className="w-full rounded-xl border border-border bg-white py-1.5 pl-8 pr-3 text-[11.5px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
          />
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2.5">
        {leaves.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-ink3">이 달에 승인된 휴가가 없습니다.</div>
        ) : (
          leaves.map(({ doc, startDate, endDate, leaveType, days }) => {
            const chip = leaveChip(leaveType, doc.title);
            return (
              <div key={doc.id} className="rounded-xl border border-border/80 bg-white p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12.5px] font-bold text-ink">{doc.drafterName}</span>
                      {doc.drafterDept && <span className="truncate rounded bg-panel-alt px-1.5 text-[9px] text-ink2">{doc.drafterDept}</span>}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-ink2">
                      {startDate === endDate ? md(startDate) : `${md(startDate)} ~ ${md(endDate)}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${STATUS_TONES[chip.kind].badge}`}>{chip.label}</span>
                    <span className="mt-0.5 block font-mono text-[10.5px] font-bold text-ink">{days}일</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
