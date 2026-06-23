import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { Donut } from '@/shared/ui/charts/Donut';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C } from '../_maint';

const TARGET = 88;
const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
const TREND = [89.2, 90.1, 88.6, 91.3, 90.8, 92.0];

interface Eq { name: string; line: string; load: number; run: number; trend: number[] }
const RATE_EQ: Eq[] = [
  { name: 'Thermal 05호기', line: '확산', load: 1980, run: 1900, trend: [94, 95, 94, 96, 95, 96] },
  { name: '프레스 01호기', line: '성형', load: 1960, run: 1880, trend: [95, 96, 94, 96, 95, 96] },
  { name: 'CMP 02호기', line: '평탄화', load: 1960, run: 1840, trend: [92, 93, 92, 94, 94, 94] },
  { name: 'Depo 03호기', line: '증착', load: 1980, run: 1820, trend: [90, 91, 90, 92, 92, 92] },
  { name: 'Etch 01호기', line: '식각', load: 1980, run: 1760, trend: [87, 88, 87, 89, 89, 89] },
  { name: '사출 03호기', line: '성형', load: 1960, run: 1700, trend: [85, 86, 85, 87, 87, 87] },
  { name: 'Implant 02호기', line: '주입', load: 1980, run: 1680, trend: [83, 84, 83, 85, 85, 85] },
  { name: 'Clean 04호기', line: '세정', load: 1960, run: 1600, trend: [80, 81, 80, 82, 82, 82] },
];
const RATE_COMP = [
  { name: '가동', v: 90.0, c: C.teal },
  { name: '대기', v: 4.2, c: '#8ab4f8' },
  { name: '계획정지(PM)', v: 3.3, c: '#b7c0d4' },
  { name: '비가동', v: 2.5, c: C.err },
];
const rate = (e: Eq) => +((e.run / e.load) * 100).toFixed(1);
const achieve = (e: Eq) => Math.round((rate(e) / TARGET) * 100);
const rateState = (e: Eq) => { const r = rate(e); return r >= TARGET + 5 ? '우수' : r >= TARGET ? '달성' : r >= TARGET - 3 ? '주의' : '미달'; };
const rateTone = (s: string): Tone => (s === '우수' ? 'ok' : s === '달성' ? 'info' : s === '주의' ? 'warn' : 'err');

function Sel({ value, w }: { value: string; w?: number }) {
  return <span className="inline-flex items-center justify-between gap-3.5 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold whitespace-nowrap text-ink" style={{ minWidth: w }}>{value} <span className="text-[8px] text-ink3">▾</span></span>;
}
function RateBar({ pct, target }: { pct: number; target: number }) {
  const c = pct >= target ? C.teal : pct >= target - 3 ? C.warn : C.err;
  return (
    <div className="relative h-[9px] min-w-[80px] rounded-[5px]" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded-[5px]" style={{ width: `${Math.min(pct, 100)}%`, background: c }} />
      <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: `${target}%`, background: C.navy }} title={`목표 ${target}%`} />
    </div>
  );
}

/** 설비별 / 기간별 가동률 분석 — 와이어프레임 rate-analysis.jsx 정본. */
export default function RateAnalysisScreen() {
  const eqs = [...RATE_EQ].sort((a, b) => rate(b) - rate(a));
  const avgRate = +(RATE_EQ.reduce((s, e) => s + rate(e), 0) / RATE_EQ.length).toFixed(1);
  const achieved = RATE_EQ.filter((e) => rate(e) >= TARGET).length;
  const downHrs = RATE_EQ.reduce((s, e) => s + e.load, 0) - RATE_EQ.reduce((s, e) => s + e.run, 0);
  const mom = +(TREND[5] - TREND[4]).toFixed(1);

  const KPI: [string, string, string, string, number | null][] = [
    ['평균 가동률', '' + avgRate, '%', C.teal, null],
    ['목표 가동률', '' + TARGET, '%', C.ink, null],
    ['목표 달성 설비', `${achieved}/${RATE_EQ.length}`, '대', C.ink, null],
    ['총 비가동시간', downHrs.toLocaleString(), 'h', C.warn, null],
    ['전주 대비', '' + Math.abs(mom), '%p', C.ink, mom],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비별 / 기간별 가동률 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 분석 및 통계 리포트 / 설비별·기간별 가동률 분석</p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value="최근 6주" w={92} /><Sel value="전체 라인" w={92} />
          <ActionBar actions={['compare', 'download']} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map(([l, v, u, c, delta]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[24px] font-extrabold tracking-tight tabular-nums" style={{ color: c }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
              {delta != null && <span className="ml-0.5 text-[11px] font-bold" style={{ color: delta >= 0 ? C.ok : C.err }}>{delta >= 0 ? '▲' : '▼'}{Math.abs(delta)}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card
          title="주별 가동률 추이"
          action={
            <div className="flex gap-3.5 text-[10.5px]">
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[3px] w-2.5 rounded-sm" style={{ background: C.teal }} />가동률</span>
              <span className="flex items-center gap-1.5 font-semibold text-ink2"><span className="w-2.5 border-t-2 border-dashed" style={{ borderColor: C.navy }} />목표 {TARGET}%</span>
            </div>
          }
        >
          <div className="relative">
            <LineChart series={[{ data: TREND, c: C.teal }]} labels={WEEKS} h={210} max={100} grid={5} area />
            <div className="absolute border-t-2 border-dashed" style={{ left: 30, right: 10, top: `${10 + (210 - 34) * (1 - TARGET / 100)}px`, borderColor: C.navy, opacity: 0.55 }} />
          </div>
        </Card>

        <Card title="조업시간 구성">
          <div className="flex flex-col items-center gap-3">
            <Donut data={RATE_COMP} size={134} thickness={22} centerTop={`${avgRate}%`} centerSub="가동률" />
            <div className="flex w-full flex-col gap-1.5">
              {RATE_COMP.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: d.c }} />
                  <span className="flex-1 text-[11px] font-semibold text-ink2">{d.name}</span>
                  <span className="font-mono text-[11px] font-bold text-ink">{d.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="설비별 가동률 상세" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">가동률 = 가동시간 ÷ 조업시간 · 목표 대비 내림차순</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {[['설비 / 라인', 'text-left'], ['조업시간(h)', 'text-right'], ['가동시간(h)', 'text-right'], [`가동률 (목표 ${TARGET}%)`, 'text-left'], ['달성률', 'text-right'], ['6주 추이', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eqs.map((e, i) => {
              const r = rate(e), ac = achieve(e), st = rateState(e);
              return (
                <tr key={e.name} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{e.name}</div><div className="mt-px text-[9.5px] text-ink3">{e.line}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.load.toLocaleString()}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.run.toLocaleString()}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><RateBar pct={r} target={TARGET} /></div>
                      <span className="w-10 text-right font-mono font-extrabold" style={{ color: r >= TARGET ? C.ink : C.err }}>{r}%</span>
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: ac >= 100 ? C.ok : ac >= 97 ? C.warn : C.err }}>{ac}%</td>
                  <td className="border-b border-border px-3 py-2.5 text-center align-middle"><span className="inline-block"><Sparkline data={e.trend} w={72} h={22} color={r >= TARGET ? C.teal : C.warn} /></span></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={rateTone(st)}>{st}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
          <span className="text-[10.5px] text-ink3">전사 평균 가동률 <b style={{ color: C.teal }}>{avgRate}%</b> · 목표 미달 <b style={{ color: C.err }}>{RATE_EQ.length - achieved}대</b></span>
          <span className="ml-auto text-[11px] text-ink3">최저 <b style={{ color: C.err }}>Clean 04호기 {rate(RATE_EQ[7])}%</b> — 비가동 사유 파레토 분석 권고</span>
        </div>
      </Card>
    </div>
  );
}
