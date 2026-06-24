import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, MHead, FBar, FField, FSel, th, td } from '../_sales';

type Rep = [name: string, target: number, actual: number, grade: string];
const REPS: Rep[] = [
  ['김영업', 1200, 1284, 'A'],
  ['이세일', 1000, 921, 'B'],
  ['박거래', 800, 868, 'A'],
  ['최수주', 600, 534, 'C'],
];
const LABELS = ['1월', '2월', '3월', '4월', '5월', '6월'];
const gradeBg = (g: string) => (g === 'A' ? C.tealSoft : g === 'B' ? C.blueSoft : C.bgDeep);
const gradeFg = (g: string) => (g === 'A' ? C.teal : g === 'B' ? C.blue : C.warn);

/** 목표 대비 실적(KPI) — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesKpiScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="목표 대비 실적(KPI)" sub="영업 통계 및 분석 / 담당자·팀 목표 달성률" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="기간"><FSel value="2026 2분기" w={110} /></FField>
        <FField label="조직"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Card title="팀 종합 달성률">
          <div className="flex flex-col items-center gap-2">
            <Gauge value={102.5} max={130} label="목표 달성률 (%)" size={170} color={C.teal} />
            <div className="mt-1 flex w-full justify-between text-[11.5px]"><span className="font-semibold text-ink2">팀 목표</span><span className="font-extrabold text-ink">3,600 백만</span></div>
            <div className="flex w-full justify-between text-[11.5px]"><span className="font-semibold text-ink2">팀 실적</span><span className="font-extrabold" style={{ color: C.teal }}>3,607 백만</span></div>
          </div>
        </Card>
        <Card title="영업 담당자별 목표 대비 실적 (백만원)" bodyClassName="p-0">
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['담당자', '목표', '실적', '달성률', '등급'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 2 ? 'right' : i === 4 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {REPS.map((r, i) => {
                const pct = Math.round((r[2] / r[1]) * 100);
                return (
                  <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                    <td className={`${td('left')} font-bold text-ink`}>{r[0]}</td>
                    <td className={`${td('right')} tabular-nums text-ink3`}>{r[1].toLocaleString()}</td>
                    <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[2].toLocaleString()}</td>
                    <td className={td('left')}>
                      <div className="flex w-[150px] items-center gap-2">
                        <div className="h-[7px] flex-1 rounded" style={{ background: C.bgDeep }}><div className="h-full rounded" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? C.teal : pct >= 90 ? C.warn : C.err }} /></div>
                        <span className="min-w-[36px] text-right text-[11px] font-extrabold tabular-nums" style={{ color: pct >= 100 ? C.teal : C.ink2 }}>{pct}%</span>
                      </div>
                    </td>
                    <td className={td('center')}><span className="inline-grid h-[22px] w-[22px] place-items-center rounded-md text-[10.5px] font-extrabold" style={{ background: gradeBg(r[3]), color: gradeFg(r[3]) }}>{r[3]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-4 py-3" style={{ background: C.panelAlt }}>
            <LineChart series={[{ data: [82, 88, 95, 91, 98, 102], c: C.teal }]} labels={LABELS} h={120} max={120} area />
          </div>
        </Card>
      </div>
    </div>
  );
}
