import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C, KpiGrid } from '../_maint';

interface Row { sn: string; name: string; cat: string; cycle: number; lastCal: string; nextCal: string; org: string; dept: string }
const PLAN_ROWS: Row[] = [
  { sn: 'CAL-2305-007', name: '디지털 압력계', cat: '압력계', cycle: 12, lastCal: '2025-06-18', nextCal: '2026-06-18', org: '한국계량기기(외부)', dept: '설비팀' },
  { sn: 'CAL-2403-019', name: '외측 마이크로미터', cat: '마이크로미터', cycle: 12, lastCal: '2025-05-20', nextCal: '2026-05-20', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2402-022', name: '표준 온도센서(RTD)', cat: '온도센서', cycle: 12, lastCal: '2025-07-01', nextCal: '2026-07-01', org: 'KOLAS 인정기관(외부)', dept: '품질팀' },
  { sn: 'CAL-2312-014', name: '정밀 전자저울', cat: '저울', cycle: 6, lastCal: '2026-01-05', nextCal: '2026-07-05', org: '한국계량기기(외부)', dept: '품질팀' },
  { sn: 'CAL-2310-011', name: '디지털 토크렌치', cat: '토크렌치', cycle: 6, lastCal: '2026-02-14', nextCal: '2026-08-14', org: '사내 교정실', dept: '설비팀' },
  { sn: 'CAL-2208-003', name: '하이트게이지', cat: '하이트게이지', cycle: 12, lastCal: '2025-09-12', nextCal: '2026-09-12', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2406-030', name: '다이얼게이지', cat: '다이얼게이지', cycle: 12, lastCal: '2025-10-30', nextCal: '2026-10-30', org: '사내 교정실', dept: '품질팀' },
  { sn: 'CAL-2401-001', name: '디지털 버니어캘리퍼스', cat: '캘리퍼스', cycle: 12, lastCal: '2025-12-10', nextCal: '2026-12-10', org: '사내 교정실', dept: '품질팀' },
];
const BASE = Date.UTC(2026, 5, 21);
const dday = (d: string) => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - BASE) / 86400000);
const planState = (d: number) => (d < 0 ? '지연' : d <= 14 ? '임박' : d <= 30 ? '예정' : '정상');
const planTone = (s: string): Tone => (s === '지연' ? 'err' : s === '임박' ? 'warn' : s === '예정' ? 'info' : 'ok');
const isExt = (o: string) => o.includes('외부') || o.includes('KOLAS');
const orgTone = (o: string): Tone => (isExt(o) ? 'mute' : 'info');

/** 검교정 주기 / 계획 관리 — 와이어프레임 cal-plan.jsx 정본. */
export default function CalPlanScreen() {
  const [filter, setFilter] = useState('전체');
  const enriched = PLAN_ROWS.map((r) => ({ ...r, dd: dday(r.nextCal), st: planState(dday(r.nextCal)) }));
  const rows = [...enriched].sort((a, b) => a.dd - b.dd).filter((r) => filter === '전체' || r.st === filter);

  const overdue = enriched.filter((r) => r.st === '지연').length;
  const soon = enriched.filter((r) => r.st === '임박').length;
  const planned = enriched.filter((r) => r.st === '예정').length;
  const ext = enriched.filter((r) => isExt(r.org)).length;

  const months = ['5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthCount = months.map((m, i) => ({ label: m, v: enriched.filter((r) => +r.nextCal.slice(5, 7) === i + 5).length, c: m === '6월' ? C.warn : C.navy }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">검교정 주기 / 계획 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 계측기 및 검교정 관리 / 검교정 주기·계획 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '검교정 계획 생성', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['검교정 대상', '' + PLAN_ROWS.length, '대', C.ink], ['기한 지연', '' + overdue, '대', C.err], ['임박(14일)', '' + soon, '대', C.warn],
        ['30일 내 예정', '' + planned, '대', C.blue], ['외부 의뢰', '' + ext, '대', C.ink],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_300px]">
        {/* 계획 테이블 */}
        <Card
          title="검교정 계획 / 스케줄"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '지연', '임박', '예정', '정상'].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${filter === f ? C.teal : C.borderHi}`, background: filter === f ? C.teal : '#fff', color: filter === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['계측기', 'text-left'], ['주기', 'text-center'], ['최근 검교정', 'text-center'], ['차기 예정', 'text-center'], ['D-day', 'text-right'], ['의뢰기관', 'text-left'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.sn} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{r.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{r.sn}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-mono font-bold text-ink2">{r.cycle}개월</td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{r.lastCal.slice(2)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] font-bold text-ink">{r.nextCal.slice(2)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold" style={{ color: r.dd < 0 ? C.err : r.dd <= 14 ? C.warn : C.ink2 }}>{r.dd < 0 ? `+${-r.dd}` : `D−${r.dd}`}</td>
                  <td className="border-b border-border px-3 py-2.5"><Pill tone={orgTone(r.org)}>{isExt(r.org) ? '외부' : '사내'}</Pill><div className="mt-1 text-[9px] text-ink3">{r.org.replace('(외부)', '')}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={planTone(r.st)}>{r.st}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* 월별 분포 + 임박 */}
        <div className="flex flex-col gap-3.5">
          <Card title="월별 검교정 도래">
            <RankBars rows={monthCount} max={Math.max(...monthCount.map((m) => m.v), 2)} />
          </Card>
          <Card title="조치 필요" bodyClassName="p-0">
            <div className="py-1.5">
              {enriched.filter((r) => r.st === '지연' || r.st === '임박').sort((a, b) => a.dd - b.dd).map((r, i, arr) => (
                <div key={r.sn} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="text-[14px]">{r.st === '지연' ? '⛔' : '⚠'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-bold text-ink">{r.name}</div>
                    <div className="font-mono text-[9.5px] text-ink3">{r.nextCal.slice(2)} · {r.dd < 0 ? `${-r.dd}일 지연` : `${r.dd}일 전`}</div>
                  </div>
                  <Pill tone={planTone(r.st)}>{r.st}</Pill>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3" style={{ background: C.panelAlt }}>
              <button className="w-full rounded-[9px] py-2.5 text-[12px] font-extrabold text-white" style={{ background: C.navy }}>검교정 의뢰서 일괄 생성</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
