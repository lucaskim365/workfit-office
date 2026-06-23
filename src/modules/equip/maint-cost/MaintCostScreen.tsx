import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { C } from '../_maint';

const COST_KEYS = [
  { key: 'pm', label: '예방보전(PM)', c: C.teal },
  { key: 'bm', label: '사후보전(BM)', c: C.err },
  { key: 'parts', label: '예비품/부품', c: C.blue },
  { key: 'out', label: '외주 수리', c: '#b7c0d4' },
] as const;
type CostKey = (typeof COST_KEYS)[number]['key'];

type Month = { m: string } & Record<CostKey, number>;
const COST_MONTHS: Month[] = [
  { m: '1월', pm: 10.0, bm: 9.0, parts: 8.0, out: 3.0 },
  { m: '2월', pm: 10.5, bm: 8.0, parts: 8.5, out: 2.5 },
  { m: '3월', pm: 10.0, bm: 9.5, parts: 7.5, out: 3.5 },
  { m: '4월', pm: 10.2, bm: 8.5, parts: 8.0, out: 2.3 },
  { m: '5월', pm: 10.5, bm: 8.0, parts: 8.6, out: 3.4 },
  { m: '6월', pm: 10.0, bm: 7.5, parts: 7.9, out: 2.2 },
];

interface Eq { name: string; line: string; pm: number; bm: number; parts: number; out: number; run: number; budget: number }
const COST_EQ: Eq[] = [
  { name: 'Implant 02호기', line: '주입', pm: 8.2, bm: 14.5, parts: 9.1, out: 6.0, run: 1680, budget: 34 },
  { name: 'Clean 04호기', line: '세정', pm: 7.0, bm: 12.8, parts: 7.4, out: 4.2, run: 1600, budget: 30 },
  { name: 'CMP 02호기', line: '평탄화', pm: 9.5, bm: 5.2, parts: 8.0, out: 2.1, run: 1840, budget: 26 },
  { name: 'Etch 01호기', line: '식각', pm: 8.8, bm: 6.0, parts: 6.5, out: 3.4, run: 1760, budget: 25 },
  { name: 'Depo 03호기', line: '증착', pm: 8.0, bm: 4.5, parts: 5.8, out: 2.0, run: 1820, budget: 22 },
  { name: 'Thermal 05호기', line: '확산', pm: 7.5, bm: 2.0, parts: 4.2, out: 1.5, run: 1900, budget: 18 },
  { name: '사출 03호기', line: '성형', pm: 6.0, bm: 3.1, parts: 4.0, out: 1.2, run: 1700, budget: 15 },
  { name: '프레스 01호기', line: '성형', pm: 6.2, bm: 2.4, parts: 3.6, out: 0.8, run: 1880, budget: 15 },
];
const eqTotal = (e: Eq) => +(e.pm + e.bm + e.parts + e.out).toFixed(1);
const costPerHr = (e: Eq) => Math.round((eqTotal(e) * 1e6) / e.run / 100) / 10;
const execPct = (e: Eq) => Math.round((eqTotal(e) / e.budget) * 100);

function StackedBars({ data }: { data: Month[] }) {
  const w = 560, h = 220, padL = 34, padR = 10, padT = 14, padB = 26;
  const iw = w - padL - padR, ih = h - padT - padB;
  const totals = data.map((d) => COST_KEYS.reduce((s, k) => s + d[k.key], 0));
  const maxV = Math.ceil(Math.max(...totals) / 10) * 10;
  const groupW = iw / data.length;
  const barW = Math.min(38, groupW * 0.56);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: 6 }).map((_, i) => {
        const y = padT + (ih / 5) * i;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke={C.border} strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="8.5" fill={C.ink3}>{Math.round(maxV - (maxV / 5) * i)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const cx = padL + groupW * i + groupW / 2;
        let yCur = padT + ih;
        return (
          <g key={i}>
            {COST_KEYS.map((k, ki) => {
              const bh = (d[k.key] / maxV) * ih;
              yCur -= bh;
              return <rect key={ki} x={cx - barW / 2} y={yCur} width={barW} height={bh} fill={k.c} rx={ki === COST_KEYS.length - 1 ? 2 : 0} />;
            })}
            <text x={cx} y={yCur - 5} textAnchor="middle" fontSize="9.5" fontWeight="800" fill={C.ink}>{totals[i].toFixed(0)}</text>
            <text x={cx} y={h - 9} textAnchor="middle" fontSize="9" fill={C.ink3}>{d.m}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 유지보수 비용(Cost) 분석 — 와이어프레임 maint-cost.jsx 정본. */
export default function MaintCostScreen() {
  const rows = [...COST_EQ].sort((a, b) => eqTotal(b) - eqTotal(a));
  const sum = (k: CostKey) => +COST_EQ.reduce((s, e) => s + e[k], 0).toFixed(1);
  const total = +(sum('pm') + sum('bm') + sum('parts') + sum('out')).toFixed(1);
  const budget = COST_EQ.reduce((s, e) => s + e.budget, 0);
  const exec = Math.round((total / budget) * 100);
  const maxEqTotal = Math.max(...COST_EQ.map(eqTotal));
  const donut = COST_KEYS.map((k) => ({ name: k.label, v: sum(k.key), c: k.c }));

  const KPI: [string, string, string, string][] = [
    ['총 유지보전비', total.toFixed(1), 'M₩', C.ink],
    ['예방보전(PM)', sum('pm').toFixed(1), 'M₩', C.teal],
    ['사후보전(BM)', sum('bm').toFixed(1), 'M₩', C.err],
    ['예비품/부품비', sum('parts').toFixed(1), 'M₩', C.blue],
    ['예산 집행률', '' + exec, '%', exec > 100 ? C.err : C.ink],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">유지보수 비용(Cost) 분석</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 분석 및 통계 리포트 / 유지보수 비용 분석</p>
        </div>
        <ActionBar actions={['compare', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map(([l, v, u, c]) => (
          <div key={l} className="rounded-[11px] border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[24px] font-extrabold tracking-tight tabular-nums" style={{ color: c }}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-[1fr_300px]">
        <Card
          title="월별 유지보수 비용 추이"
          action={
            <div className="flex flex-wrap gap-3 text-[10px]">
              {COST_KEYS.map((k) => <span key={k.key} className="flex items-center gap-1.5 font-semibold text-ink2"><span className="h-[9px] w-[9px] rounded-sm" style={{ background: k.c }} />{k.label}</span>)}
            </div>
          }
        >
          <StackedBars data={COST_MONTHS} />
          <div className="mt-0.5 text-right text-[10px] text-ink3">단위: 백만원(M₩)</div>
        </Card>

        <Card title="비용 구성">
          <div className="flex flex-col items-center gap-3">
            <Donut data={donut} size={134} thickness={22} centerTop={total.toFixed(0)} centerSub="총 비용(M₩)" />
            <div className="flex w-full flex-col gap-1.5">
              {donut.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: d.c }} />
                  <span className="flex-1 text-[11px] font-semibold text-ink2">{d.name}</span>
                  <span className="font-mono text-[11px] font-bold text-ink">{d.v.toFixed(1)}</span>
                  <span className="w-[30px] text-right text-[9.5px] text-ink3">{Math.round((d.v / total) * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-0.5 flex w-full justify-between border-t border-border pt-2.5 text-[10.5px]">
              <span className="font-semibold text-ink3">예방:사후 비율</span>
              <span className="font-mono font-extrabold text-ink">{Math.round((sum('pm') / (sum('pm') + sum('bm'))) * 100)} : {Math.round((sum('bm') / (sum('pm') + sum('bm'))) * 100)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="설비별 비용 상세" bodyClassName="p-0" action={<span className="text-[10px] text-ink3">6개월 누적 · 총비용 내림차순 · 단위 M₩</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {[['설비 / 라인', 'text-left'], ['PM', 'text-right'], ['BM', 'text-right'], ['부품', 'text-right'], ['외주', 'text-right'], ['총비용', 'text-left'], ['시간당(K₩/h)', 'text-right'], ['예산대비', 'text-right']].map(([h, al]) => (
                <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => {
              const tot = eqTotal(e), ex = execPct(e);
              return (
                <tr key={e.name} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{e.name}</div><div className="mt-px text-[9.5px] text-ink3">{e.line}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: C.teal }}>{e.pm.toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: e.bm >= 10 ? C.err : C.ink2 }}>{e.bm.toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.parts.toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{e.out.toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-2 min-w-[60px] flex-1 overflow-hidden rounded" style={{ background: C.bgDeep }}>
                        {COST_KEYS.map((k) => <div key={k.key} style={{ width: `${(e[k.key] / maxEqTotal) * 100}%`, background: k.c }} />)}
                      </div>
                      <span className="w-[38px] text-right font-mono font-extrabold text-ink">{tot.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono text-ink2">{costPerHr(e).toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: ex > 100 ? C.err : ex >= 95 ? C.warn : C.ok }}>{ex}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
          <span className="text-[10.5px] text-ink3">총 유지보전비 <b className="font-mono text-ink">{total.toFixed(1)} M₩</b> / 예산 {budget} M₩ · 집행률 <b style={{ color: exec > 100 ? C.err : C.ink2 }}>{exec}%</b></span>
          <span className="ml-auto text-[11px] text-ink3">BM 최고 <b style={{ color: C.err }}>Implant 02호기 {COST_EQ[0].bm.toFixed(1)}M₩</b> — 예방보전 전환 검토 권고</span>
        </div>
      </Card>
    </div>
  );
}
