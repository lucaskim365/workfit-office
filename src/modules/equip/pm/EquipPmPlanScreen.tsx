import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, Sel, FilterCard, FilterField, KpiGrid } from '../_maint';

const PM_TYPE: Record<string, string> = { 일상: C.teal, 주간: C.blue, 월간: C.amber, 분기: C.violet, 연간: '#e0564f' };

type Ev = [string, string, string];
const PM_EVENTS: Record<number, Ev[]> = {
  2: [['CMP 02', '월간 정밀점검', '월간']],
  4: [['Etch 01', '주간 점검', '주간']],
  5: [['Photo 05', '분기 캘리브레이션', '분기']],
  9: [['Depo 03', '월간 정밀점검', '월간'], ['Implant 02', '주간 점검', '주간']],
  10: [['CMP 02', '주간 점검', '주간'], ['Thermal 05', '일상 점검', '일상']],
  11: [['Clean 04', '월간 정밀점검', '월간']],
  13: [['Etch 01', '분기 오버홀', '분기']],
  16: [['Photo 05', '주간 점검', '주간']],
  18: [['Implant 02', '월간 정밀점검', '월간']],
  20: [['Depo 03', '주간 점검', '주간']],
  23: [['Thermal 05', '연간 오버홀', '연간']],
  25: [['CMP 02', '월간 정밀점검', '월간']],
  27: [['Clean 04', '주간 점검', '주간']],
  30: [['Etch 01', '월간 정밀점검', '월간']],
};
const TODAY = 10;

const PM_WEEK = [
  ['06-09 (화)', 'Depo 03호기', '월간 정밀점검', '이정비', '완료'],
  ['06-09 (화)', 'Implant 02호기', '주간 점검', '이정비', '완료'],
  ['06-10 (수)', 'CMP 02호기', '주간 점검', '김설비', '진행중'],
  ['06-10 (수)', 'Thermal 05호기', '일상 점검', '박보전', '지연'],
  ['06-11 (목)', 'Clean 04호기', '월간 정밀점검', '김설비', '예정'],
  ['06-13 (토)', 'Etch 01호기', '분기 오버홀', '박보전', '예정'],
];
const PM_NEXT: [string, string, string, number][] = [
  ['CMP 02호기', '월간', '06-25', 15], ['Etch 01호기', '분기', '06-13', 3], ['Photo 05호기', '주간', '06-16', 6],
  ['Depo 03호기', '주간', '06-20', 10], ['Implant 02호기', '월간', '06-18', 8], ['Thermal 05호기', '연간', '06-23', 13], ['Clean 04호기', '월간', '06-11', 1],
];
const PM_MASTER = [
  ['CMP 02호기', '연마 헤드 정밀점검', '월간', '30일', '05-25', '06-25', '김설비', '정상'],
  ['CMP 02호기', '구동부 윤활', '주간', '7일', '06-03', '06-10', '김설비', '진행중'],
  ['Etch 01호기', 'RF 매칭 점검', '주간', '7일', '06-06', '06-13', '박보전', '정상'],
  ['Etch 01호기', '챔버 오버홀', '분기', '90일', '03-15', '06-13', '박보전', '임박'],
  ['Photo 05호기', '스테이지 정렬', '주간', '7일', '06-09', '06-16', '김설비', '정상'],
  ['Depo 03호기', '히터 캘리브레이션', '월간', '30일', '05-20', '06-20', '이정비', '정상'],
  ['Implant 02호기', '이온 소스 점검', '월간', '30일', '05-18', '06-18', '이정비', '정상'],
  ['Thermal 05호기', '튜브 일상점검', '일상', '1일', '06-09', '06-10', '박보전', '지연'],
  ['Thermal 05호기', '퍼니스 오버홀', '연간', '365일', '25-06-23', '06-23', '박보전', '임박'],
  ['Clean 04호기', '케미컬 라인 점검', '월간', '30일', '05-11', '06-11', '김설비', '임박'],
];
const stTone = (s: string): Tone => (s === '완료' || s === '정상' ? 'ok' : s === '진행중' ? 'info' : s === '지연' ? 'err' : s === '임박' ? 'warn' : 'mute');

const dow = ['일', '월', '화', '수', '목', '금', '토'];

/** 예방보전(PM) 계획 — 와이어프레임 equip-pm-plan.jsx 정본. */
export default function EquipPmPlanScreen() {
  const cells: (number | null)[] = [null]; // 6/1=월 → 앞 1칸 공백
  for (let d = 1; d <= 30; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">예방보전(PM) 계획</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 보전 및 점검 / 예방보전(PM) 계획</p>
        </div>
        <ActionBar actions={['add', 'save', 'download']} />
      </div>

      <FilterCard>
        <FilterField label="라인"><Sel w={90} /></FilterField>
        <FilterField label="설비"><Sel w={120} /></FilterField>
        <FilterField label="보전유형"><Sel w={100} /></FilterField>
        <FilterField label="담당"><Sel w={90} /></FilterField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FilterCard>

      <KpiGrid
        cols={5}
        items={[
          ['이번달 PM 계획', '32', '건', C.ink], ['완료', '18', '건', C.teal], ['예정', '11', '건', C.blue],
          ['지연', '3', '건', C.err], ['계획 준수율', '94.7', '%', C.teal],
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* 캘린더 */}
        <Card
          bodyClassName="p-0"
          title="2026년 6월 PM 일정"
          action={
            <div className="flex items-center gap-3">
              <div className="flex gap-2.5">
                {Object.entries(PM_TYPE).map(([k, c]) => (
                  <span key={k} className="flex items-center gap-1 text-[9.5px] text-ink2"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{k}</span>
                ))}
              </div>
              <div className="flex gap-1">
                {['‹', '›'].map((a) => <span key={a} className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-hi text-[11px] text-ink2">{a}</span>)}
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-7">
            {dow.map((d, i) => (
              <div key={d} className="border-b border-border bg-panel-alt py-2 text-center text-[11px] font-bold" style={{ color: i === 0 ? '#e0564f' : i === 6 ? C.blue : C.ink2 }}>{d}</div>
            ))}
            {cells.map((d, i) => {
              const ev = d ? PM_EVENTS[d] || [] : [];
              const isToday = d === TODAY;
              const col = i % 7;
              return (
                <div key={i} className="flex flex-col gap-[3px] border-b border-border p-[5px]" style={{ minHeight: 86, borderRight: col < 6 ? `1px solid ${C.border}` : 'none', background: isToday ? C.tealSoft : d ? '#fff' : C.panelAlt }}>
                  {d && <span className="self-start rounded-[5px] text-[10.5px]" style={{ fontWeight: isToday ? 800 : 600, color: isToday ? C.teal : col === 0 ? '#e0564f' : col === 6 ? C.blue : C.ink3, padding: isToday ? '1px 6px' : '1px 2px', background: isToday ? '#fff' : 'transparent' }}>{d}</span>}
                  {ev.map((e, ei) => (
                    <div key={ei} className="flex items-center gap-1 overflow-hidden rounded border border-border bg-panel px-1 py-0.5" style={{ borderLeft: `3px solid ${PM_TYPE[e[2]]}` }}>
                      <span className="truncate text-[9px] font-bold text-ink">{e[0]}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="금주 PM 일정" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">06-08 ~ 06-14</span>}>
            <div className="flex flex-col">
              {PM_WEEK.map((w, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderBottom: i < PM_WEEK.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="w-16 shrink-0 text-[10px] font-bold text-ink2">{w[0]}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[11.5px] font-bold text-ink">{w[1]}</span>
                    <span className="text-[9.5px] text-ink3">{w[2]} · {w[3]}</span>
                  </span>
                  <Pill tone={stTone(w[4])}>{w[4]}</Pill>
                </div>
              ))}
            </div>
          </Card>

          <Card title="설비별 다음 PM" bodyClassName="p-0">
            <div className="flex flex-col">
              {PM_NEXT.map((n, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3.5 py-2" style={{ borderBottom: i < PM_NEXT.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-ink">{n[0]}</span>
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-bold" style={{ color: PM_TYPE[n[1]] }}><span className="h-[7px] w-[7px] rounded-sm" style={{ background: PM_TYPE[n[1]] }} />{n[1]}</span>
                  <span className="w-12 text-right font-mono text-[11px] text-ink2">{n[2]}</span>
                  <span className="w-[42px] text-right text-[11px] font-extrabold tabular-nums" style={{ color: n[3] <= 3 ? C.err : n[3] <= 7 ? C.warn : C.ink3 }}>D-{n[3]}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="PM 계획 마스터" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">{PM_MASTER.length}건</span>}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {['설비', '보전 항목', '유형', '주기', '최근 수행', '다음 예정', '담당', '상태'].map((h, i) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PM_MASTER.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{r[0]}</td>
                <td className="border-b border-border px-3 py-2.5 text-ink2">{r[1]}</td>
                <td className="border-b border-border px-3 py-2.5 text-center"><span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink2"><span className="h-2 w-2 rounded-sm" style={{ background: PM_TYPE[r[2]] }} />{r[2]}</span></td>
                <td className="border-b border-border px-3 py-2.5 text-center text-ink3">{r[3]}</td>
                <td className="border-b border-border px-3 py-2.5 text-center font-mono text-ink2">{r[4]}</td>
                <td className="border-b border-border px-3 py-2.5 text-center font-mono font-bold text-ink">{r[5]}</td>
                <td className="border-b border-border px-3 py-2.5 text-center text-ink2">{r[6]}</td>
                <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r[7])}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
