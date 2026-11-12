import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCommuteEvaluation } from '@/features/commute/useCommuteEvaluation';
import { useCommuteRoster } from '@/features/commute/useCommuteRoster';
import { useLeaveLedger, type LeaveLedgerMode } from '@/features/commute/useLeaveLedger';
import type { LeaveLedgerEntry } from '@/domain/leave/ledger';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * PWA 근태 관제 '연차 원장' — 웹 근태 '전사 연차 원장'과 같은 계산(useLeaveLedger). 보기 전용(가감·일괄 부여는 웹에서).
 * 전사 권한자만 연다(부르는 쪽에서 판정).
 */
export default function MobileLeaveLedgerView() {
  const { approvals: approvalsData, holidays } = useCommuteEvaluation();
  const approvals = useMemo(() => approvalsData ?? [], [approvalsData]);
  const roster = useCommuteRoster(true);
  const [mode, setMode] = useState<LeaveLedgerMode>('HIRE_DATE');
  const { entries, summary } = useLeaveLedger({ enabled: true, mode, roster, approvals, holidays });
  const [keyword, setKeyword] = useState('');
  const [dept, setDept] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const depts = useMemo(() => [...new Set(entries.map((e) => e.dept).filter(Boolean))], [entries]);
  const list = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return entries.filter((e) => !e.isRetired && (!dept || e.dept === dept) && (!kw || e.name.toLowerCase().includes(kw) || e.dept.toLowerCase().includes(kw)));
  }, [entries, keyword, dept]);

  const stat = (label: string, value: string, tone = '') => (
    <div className={`rounded-xl bg-panel-alt/60 p-2 ${tone}`}>
      <span className="block text-[10px] text-ink3">{label}</span>
      <span className="text-[13.5px] font-black text-ink">{value}</span>
    </div>
  );

  return (
    <>
      <div className="grid shrink-0 grid-cols-4 gap-1.5 border-b border-border/50 bg-white px-4 py-2.5 text-center">
        {stat('관리 인원', `${summary.totalEmployees}명`)}
        {stat('총 부여', `${fmt(summary.totalGranted)}일`, 'border border-teal/20 bg-teal-soft/20')}
        {stat('총 사용', `${fmt(summary.totalUsed)}일`)}
        {stat('평균 소진', `${summary.avgUsageRate}%`)}
      </div>
      <div className="shrink-0 space-y-2 border-b border-border/40 bg-white/50 px-4 py-2">
        <div className="flex gap-1.5">
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-2 py-1.5 text-[11.5px] text-ink outline-none"
            aria-label="부서"
          >
            <option value="">전체 부서</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 rounded-xl border border-border bg-white p-0.5 text-[11px] font-bold">
            {(
              [
                ['HIRE_DATE', '입사일'],
                ['FISCAL_YEAR', '회계연도'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`rounded-lg px-2 py-1 ${mode === key ? 'bg-ink text-white' : 'text-ink3'}`}
                aria-pressed={mode === key}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
        {list.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-ink3">해당 조건에 맞는 사원이 없습니다.</div>
        ) : (
          list.map((e) => <LedgerCard key={e.empNo + e.name} entry={e} open={open === e.empNo + e.name} onToggle={() => setOpen((o) => (o === e.empNo + e.name ? null : e.empNo + e.name))} />)
        )}
        <p className="pb-2 pt-1 text-center text-[10px] text-ink3">연차 가감·대체휴무 부여는 웹 근태 화면에서 합니다.</p>
      </div>
    </>
  );
}

function LedgerCard({ entry: e, open, onToggle }: { entry: LeaveLedgerEntry; open: boolean; onToggle: () => void }) {
  // 웹 원장의 '잔여'와 같은 값(총부여 − 사용, 선사용이면 마이너스)
  const remaining = e.remainingDays;
  return (
    <div className={`rounded-xl border bg-white shadow-2xs ${remaining < 0 ? 'border-rose-300/80' : 'border-border/80'}`}>
      <button type="button" onClick={onToggle} className="w-full p-3 text-left" aria-expanded={open}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-bold text-ink">{e.name}</span>
              <span className="text-[10.5px] text-ink3">{e.position}</span>
              {e.dept && <span className="truncate rounded bg-panel-alt px-1.5 text-[9px] text-ink2">{e.dept}</span>}
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink3">
              입사 {e.hireDate || '—'}
              {e.isUnderOneYear ? ' · 1년 미만' : ''}
              {e.advanceStatus.isAdvanceUsed && <span className="ml-1 rounded bg-amber-500/15 px-1 font-bold text-amber-700">선사용</span>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className={`text-[15px] font-black ${remaining < 0 ? 'text-rose-500' : 'text-teal'}`}>{fmt(remaining)}일</span>
            <span className="block text-[10px] text-ink3">잔여 · 소진 {e.usageRate}%</span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
          <span className="rounded-lg bg-panel-alt/60 py-1 text-ink2">부여 <b className="text-ink">{fmt(e.totalGrantedDays)}</b></span>
          <span className="rounded-lg bg-panel-alt/60 py-1 text-ink2">사용 <b className="text-ink">{fmt(e.usedDays)}</b></span>
          <span className="rounded-lg bg-panel-alt/60 py-1 text-ink2">신청중 <b className="text-ink">{fmt(e.pendingDays)}</b></span>
          <span className="rounded-lg bg-panel-alt/60 py-1 text-ink2">가감 <b className="text-ink">{e.adjustedDays > 0 ? '+' : ''}{fmt(e.adjustedDays)}</b></span>
        </div>
      </button>
      {open && (
        <div className="space-y-1 border-t border-border/60 px-3 py-2 text-[10.5px]">
          {e.leaveHistory.length === 0 && e.adjustmentHistory.length === 0 ? (
            <div className="py-1 text-center text-ink3">사용·가감 내역이 없습니다.</div>
          ) : (
            <>
              {e.leaveHistory.map((h) => (
                <div key={h.docId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-ink2">
                    <span className="font-mono">{h.startDate === h.endDate ? h.startDate : `${h.startDate}~${h.endDate.slice(5)}`}</span> {h.leaveType}
                    {h.status === '진행중' ? ' (신청중)' : ''}
                  </span>
                  <span className="shrink-0 font-bold text-ink">-{fmt(h.daysCount)}일</span>
                </div>
              ))}
              {e.adjustmentHistory.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-ink2">가감 · {a.reason}</span>
                  <span className="shrink-0 font-bold text-ink">
                    {a.deltaDays > 0 ? '+' : ''}
                    {fmt(a.deltaDays)}일
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
