import { CalendarClock } from 'lucide-react';
import { useScheduleChangeList } from '@/features/scheduleChange/useScheduleChanges';
import { changesOfDoc, scheduleRangeText } from '@/domain/scheduleChange/schema';

/**
 * 결재 후 일정 변경 이력 — 외근·출장 문서 화면 위에 보인다. 문서 본문은 그대로이고, 인쇄에는 나오지 않는다.
 */
export function ScheduleChangeNotice({ docId }: { docId: string }) {
  const { data } = useScheduleChangeList();
  const history = changesOfDoc(data ?? [], docId);
  if (!history.length) return null;
  const last = history[history.length - 1];
  return (
    <div className="mb-4 rounded-xl border border-[#0876c8]/30 bg-[#0876c8]/5 p-3.5 text-[12px] print:hidden">
      <div className="mb-1 flex items-center gap-2 font-bold text-[#0866ad]">
        <CalendarClock size={15} className="shrink-0" />
        <span>일정 변경됨 · 지금 일정 {scheduleRangeText(last.startDate, last.endDate, last.startTime, last.endTime)}</span>
      </div>
      <ul className="m-0 list-none space-y-0.5 p-0 text-[11.5px] text-[#444]">
        {history.map((h) => (
          <li key={h.id}>
            <span className="text-[#888] line-through">{scheduleRangeText(h.prevStartDate, h.prevEndDate, h.prevStartTime, h.prevEndTime)}</span>
            <span className="mx-1 text-[#888]">→</span>
            <strong className="font-semibold">{scheduleRangeText(h.startDate, h.endDate, h.startTime, h.endTime)}</strong>
            <span className="ml-1.5 text-[#777]">{h.reason} · {h.changedByName} {h.createdAt.slice(5, 10).replace('-', '/')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
