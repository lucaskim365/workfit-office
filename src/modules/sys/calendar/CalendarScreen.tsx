import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const HOLIDAYS = new Set([6, 7, 14, 21, 28]);
const TODAY = 10;
const SHIFTS: Array<[string, string, string]> = [
  ['주간 (Day)', '08:00 ~ 20:00', T.teal],
  ['야간 (Night)', '20:00 ~ 08:00', T.navy],
];

/** 공장 달력 — 가동/휴무일 + 교대 설정 + 요약. 와이어프레임 sys-screens-2.FactoryCalendarContent 정본. */
export default function CalendarScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공장 달력</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 공장 달력</p>
        </div>
        <ActionBar actions={[{ preset: 'save', label: '저장', variant: 'primary' }]} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        <Card
          title="2026년 6월"
          action={
            <div className="flex items-center gap-3.5 text-[10.5px] font-semibold text-ink2">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-teal" />가동일</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#f3c6c1]" />휴무일</span>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1.5">
            {DOW.map((d, i) => (
              <div key={d} className={`py-1 text-center text-[11px] font-bold ${i === 0 ? 'text-danger' : i === 6 ? 'text-blue' : 'text-ink2'}`}>{d}</div>
            ))}
            {DAYS.map((d) => {
              const hol = HOLIDAYS.has(d);
              const isToday = d === TODAY;
              return (
                <div
                  key={d}
                  style={{ aspectRatio: '1.1' }}
                  className={`flex cursor-pointer flex-col rounded-lg border p-1.5 ${isToday ? 'border-teal ring-1 ring-teal' : 'border-border'} ${hol ? 'bg-[#fdeceb]' : 'bg-panel'}`}
                >
                  <span className={`text-[11.5px] font-bold ${hol ? 'text-danger' : 'text-ink'}`}>{d}</span>
                  <span className={`mt-auto text-[8.5px] font-bold ${hol ? 'text-danger' : 'text-teal'}`}>{hol ? '휴무' : '가동'}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="교대(시프트) 설정">
            <div className="flex flex-col gap-2.5">
              {SHIFTS.map(([name, time, color]) => (
                <div key={name} className="flex items-center gap-2.5 rounded-[9px] border border-border bg-panel-alt px-3.5 py-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="flex-1 text-[12px] font-bold text-ink">{name}</span>
                  <span className="text-[11.5px] font-semibold tabular-nums text-ink2">{time}</span>
                </div>
              ))}
              <button className="px-0.5 py-1 text-left text-[11.5px] font-bold text-blue">＋ 시프트 추가</button>
            </div>
          </Card>
          <Card title="이달 요약">
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="가동일" value="25" unit="일" tone="teal" />
              <Kpi label="휴무일" value="5" unit="일" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
