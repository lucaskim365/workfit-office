import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { leaveChip } from '@/domain/commute/statusDisplay';
import { annualLeaveHistoryDocs, calculateLeaveDays } from '@/domain/leave/policy';
import { StatusBadge } from '@/features/commute/StatusBadge';
import type { LeaveBalance } from '@/features/gw/useLeave';
import { PERSON_TONES } from '@/shared/theme/statusColors';
import { formatMinutes } from '@/domain/leave/substituteLedger';

const REQUEST_FILTERS = ['전체', '진행중', '완료', '반려'] as const;
type RequestFilter = (typeof REQUEST_FILTERS)[number];

const STATUS_STYLE: Record<string, string> = {
  완료: 'bg-emerald-500/15 text-emerald-600',
  반려: 'bg-rose-500/15 text-rose-600',
};

/** 근태·휴가(앱) 아래 이력 — 쓴 연차·대체휴무 내역과 내 휴가원 목록. 문서를 누르면 결재 상세로 간다. 회사 연차 부여 체계가 없어 부여 줄은 두지 않는다. */
export default function MobileLeaveHistory({
  balance,
  holidayMap,
}: {
  balance: LeaveBalance;
  holidayMap: Map<string, string>;
}) {
  const nav = useNavigate();
  const [tab, setTab] = useState<'annual' | 'requests'>('annual');
  const [filter, setFilter] = useState<RequestFilter>('전체');

  const usedDocs = useMemo(() => annualLeaveHistoryDocs(balance.myDocs), [balance.myDocs]);
  const requests = useMemo(
    () => (filter === '전체' ? balance.myDocs : balance.myDocs.filter((d) => d.status === filter)),
    [balance.myDocs, filter],
  );
  const substitutes = balance.substituteHoliday.detailList;

  const tabClass = (on: boolean) => `rounded-lg py-1.5 text-[12px] font-bold ${on ? 'bg-white text-teal shadow-xs' : 'text-ink3'}`;

  return (
    <div className="space-y-2.5 rounded-2xl border border-border/80 bg-white p-3.5 shadow-xs">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab('annual')} className={tabClass(tab === 'annual')}>연차·대체휴무 내역</button>
        <button type="button" onClick={() => setTab('requests')} className={tabClass(tab === 'requests')}>휴가 신청 이력 ({balance.myDocs.length})</button>
      </div>

      {tab === 'annual' ? (
        <ul className="divide-y divide-border/60">
          {substitutes.map((item) => (
            <li key={`sub-${item.entry.id}`} className="flex items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-bold ${PERSON_TONES.leave.badge}`}>대체휴무</span>
                  <span className="text-[11px] text-ink3">{item.entry.workDate}</span>
                </div>
                <p className="mt-1 truncate text-[11.5px] text-ink2">휴일근로 {formatMinutes(item.entry.workMinutes)}</p>
                <p className="text-[10.5px] text-ink3">{item.status === 'REVOKED' ? '취소됨' : item.status === 'EXPIRED' ? '만료됨' : `만료 ~${item.entry.expiresOn}`}</p>
              </div>
              <b className={`shrink-0 text-[13px] ${item.status === 'REVOKED' || item.status === 'EXPIRED' ? 'text-ink3 line-through' : 'text-emerald-600'}`}>+{formatMinutes(item.entry.minutes)}</b>
            </li>
          ))}

          {usedDocs.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => nav(`/m/approval/${d.id}`)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge chip={leaveChip(d.form?.leaveType, d.title)} />
                    <span className="truncate text-[11px] text-ink3">{d.form?.startDate} ~ {d.form?.endDate}</span>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] text-ink2">{d.body || d.title}</p>
                </div>
                <span className="flex shrink-0 items-center gap-0.5">
                  <b className="text-[13px] text-rose-500">
                    -{calculateLeaveDays({
                      leaveType: d.form?.leaveType,
                      startDate: d.form?.startDate,
                      endDate: d.form?.endDate,
                      rawDays: d.form?.days,
                      title: d.title,
                      holidays: holidayMap,
                    })}일
                  </b>
                  <ChevronRight size={14} className="text-ink3" />
                </span>
              </button>
            </li>
          ))}

          {usedDocs.length === 0 && substitutes.length === 0 && (
            <li className="py-5 text-center text-[12px] text-ink3">사용 완료된 연차가 없습니다.</li>
          )}
        </ul>
      ) : (
        <>
          <div className="flex gap-1">
            {REQUEST_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilter(st)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${filter === st ? 'bg-teal text-white' : 'bg-slate-100 text-ink3'}`}
              >
                {st}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border/60">
            {requests.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => nav(`/m/approval/${d.id}`)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge chip={leaveChip(d.form?.leaveType, d.title)} />
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLE[d.status] ?? 'bg-amber/20 text-amber'}`}>{d.status}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-ink2">{d.form?.startDate} ~ {d.form?.endDate} · {d.form?.days}일</p>
                    <p className="text-[10.5px] text-ink3">{d.docNo || d.id.slice(0, 8)}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-ink3" />
                </button>
              </li>
            ))}
            {requests.length === 0 && <li className="py-5 text-center text-[12px] text-ink3">신청 내역이 없습니다.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
