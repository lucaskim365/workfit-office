import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { C } from '../_maint';

const FAULT_TYPES = ['기계', '전기', '제어', '유공압', 'S/W'];
const TYPE_C: Record<string, string> = { 기계: '#1f2f55', 전기: C.blue, 제어: C.teal, 유공압: C.warn, 'S/W': '#b7c0d4' };

interface Part { name: string; byType: number[]; repair: number; recur: number; eq: string }
const FAULT_PARTS: Part[] = [
  { name: '베어링/구동부', byType: [14, 1, 0, 2, 0], repair: 38, recur: 12, eq: 'CMP 02호기' },
  { name: '모터', byType: [6, 9, 1, 0, 0], repair: 26, recur: 8, eq: 'Depo 03호기' },
  { name: '센서', byType: [1, 7, 8, 0, 1], repair: 14, recur: 22, eq: 'Etch 01호기' },
  { name: '밸브/실린더', byType: [3, 0, 1, 12, 0], repair: 19, recur: 9, eq: 'Clean 04호기' },
  { name: '히터', byType: [2, 11, 2, 0, 0], repair: 31, recur: 6, eq: 'Thermal 05호기' },
  { name: '제어보드(PCB)', byType: [0, 6, 13, 0, 4], repair: 22, recur: 18, eq: 'Implant 02호기' },
  { name: '진공펌프', byType: [9, 1, 0, 5, 0], repair: 28, recur: 11, eq: 'Etch 01호기' },
];

/** 고장 유형 / 부위별 분석 — 와이어프레임 fault-analysis.jsx 정본. */
export default function FaultAnalysisScreen() {
  const partTotals = FAULT_PARTS.map((p) => p.byType.reduce((s, v) => s + v, 0));
  const typeTotals = FAULT_TYPES.map((_, ti) => FAULT_PARTS.reduce((s, p) => s + p.byType[ti], 0));
  const grand = typeTotals.reduce((s, v) => s + v, 0);
  const maxCell = Math.max(...FAULT_PARTS.flatMap((p) => p.byType));

  const typeDonut = FAULT_TYPES.map((t, i) => ({ name: t, v: typeTotals[i], c: TYPE_C[t] }));
  const topType = FAULT_TYPES[typeTotals.indexOf(Math.max(...typeTotals))];
  const topPartIdx = partTotals.indexOf(Math.max(...partTotals));
  const totalRepair = FAULT_PARTS.reduce((s, p) => s + p.repair, 0);
  const avgMttr = (totalRepair / grand).toFixed(1);
  const recurAvg = Math.round(FAULT_PARTS.reduce((s, p, i) => s + p.recur * partTotals[i], 0) / grand);

  const domType = (p: Part) => FAULT_TYPES[p.byType.indexOf(Math.max(...p.byType))];
  const rows = FAULT_PARTS.map((p, i) => ({ ...p, total: partTotals[i] })).sort((a, b) => b.total - a.total);
  const cellBg = (v: number) => (v === 0 ? C.panelAlt : `rgba(23,168,154,${(0.14 + 0.78 * (v / maxCell)).toFixed(2)})`);
  const cellFg = (v: number) => (v === 0 ? C.ink3 : v / maxCell > 0.5 ? '#fff' : C.ink);

  const KPI: [string, string, string, string, boolean][] = [
    ['총 고장 건수', '' + grand, '건', C.ink, false],
    ['최다 유형', topType, '', C.blue, true],
    ['최다 부위', FAULT_PARTS[topPartIdx].name, '', C.err, true],
    ['평균 수리시간', '' + avgMttr, 'h', C.ink, false],
    ['평균 재발률', '' + recurAvg, '%', C.warn, false],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">고장 유형 / 부위별 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 분석 및 통계 리포트 / 고장 유형·부위별 분석</p>
        </div>
        <ActionBar actions={['compare', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map(([l, v, u, c, small]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="font-extrabold tracking-tight tabular-nums" style={{ color: c, fontSize: small ? 16 : 24 }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[280px_1fr]">
        <Card title="고장 유형 분포">
          <div className="flex flex-col items-center gap-3">
            <Donut data={typeDonut} size={130} thickness={22} centerTop={'' + grand} centerSub="총 고장(건)" />
            <div className="flex w-full flex-col gap-1.5">
              {typeDonut.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: d.c }} />
                  <span className="flex-1 text-[11px] font-semibold text-ink2">{d.name}</span>
                  <span className="font-mono text-[11px] font-bold text-ink">{d.v}</span>
                  <span className="w-[30px] text-right text-[9.5px] text-ink3">{Math.round((d.v / grand) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="유형 × 부위 히트맵" action={<span className="text-[10px] text-ink3">셀 = 고장 건수 · 색농도 비례</span>}>
          <div className="overflow-x-auto">
            <table className="w-full border-separate text-[11px]" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-[10px] font-bold text-ink3">부위 \ 유형</th>
                  {FAULT_TYPES.map((t) => <th key={t} className="min-w-[52px] py-1 text-center text-[10px] font-bold" style={{ color: TYPE_C[t] }}>{t}</th>)}
                  <th className="px-2 py-1 text-right text-[10px] font-bold text-ink2">계</th>
                </tr>
              </thead>
              <tbody>
                {FAULT_PARTS.map((p, pi) => (
                  <tr key={p.name}>
                    <td className="px-2 py-1 text-[11px] font-bold whitespace-nowrap text-ink">{p.name}</td>
                    {p.byType.map((v, ti) => (
                      <td key={ti} className="p-0 text-center">
                        <div className="flex h-[34px] items-center justify-center rounded-md font-mono" style={{ background: cellBg(v), color: cellFg(v), fontWeight: v === maxCell ? 800 : 700, fontSize: v === 0 ? 10 : 12 }}>{v === 0 ? '·' : v}</div>
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-mono font-extrabold text-ink">{partTotals[pi]}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-1.5 text-[10px] font-bold text-ink2">계</td>
                  {typeTotals.map((t, i) => <td key={i} className="py-1.5 text-center font-mono text-[11px] font-extrabold text-ink2">{t}</td>)}
                  <td className="px-2 py-1.5 text-right font-mono font-extrabold" style={{ color: C.teal }}>{grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[9px] px-3 py-2" style={{ background: '#e7eefc' }}>
            <span className="text-[13px]">💡</span>
            <span className="text-[11px] font-semibold text-ink2">최다 조합 <b className="text-ink">제어보드 × 제어({maxCell}건)</b>, <b className="text-ink">베어링 × 기계(14건)</b> — 해당 부위·유형 집중 점검 권고</span>
          </div>
        </Card>
      </div>

      <Card title="부위별 상세" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">고장 건수 내림차순</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {[['부위', 'text-left'], ['주요 유형', 'text-center'], ['고장 건수', 'text-right'], ['비중', 'text-left'], ['수리시간(h)', 'text-right'], ['MTTR(h)', 'text-right'], ['재발률', 'text-right'], ['대표 설비', 'text-left']].map(([h, al]) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const dt = domType(p), pct = (p.total / grand) * 100, mttr = (p.repair / p.total).toFixed(1);
              return (
                <tr key={p.name} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5 font-bold text-ink">{p.name}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><span className="rounded-md px-2 py-0.5 text-[10px] font-bold" style={{ color: TYPE_C[dt], background: `${TYPE_C[dt]}18` }}>{dt}</span></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-extrabold text-ink">{p.total}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-[7px] min-w-[56px] flex-1 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${(pct / ((rows[0].total / grand) * 100)) * 100}%`, background: C.teal }} /></div>
                      <span className="w-[38px] text-right font-mono font-bold text-ink2">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{p.repair}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: +mttr >= 2 ? C.warn : C.ink }}>{mttr}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: p.recur >= 18 ? C.err : p.recur >= 12 ? C.warn : C.ink2 }}>{p.recur}%</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{p.eq}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
          <span className="text-[10.5px] text-ink3">총 {grand}건 · 총 수리시간 {totalRepair}h</span>
          <span className="ml-auto text-[11px] text-ink3">재발률 최고 <b style={{ color: C.err }}>센서 22%</b> — 근본원인(RCA) 분석 권고</span>
        </div>
      </Card>
    </div>
  );
}
