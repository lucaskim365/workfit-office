import { Card } from '@/shared/ui/Card';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, RLegend, ProgBar, FField, FSel } from '../_report';

type Tile = [label: string, value: string, delta: string, color: string, spark: number[]];
const tiles: Tile[] = [
  ['생산 달성률', '97.8%', '+1.2%p', C.teal, [94, 96, 95, 97, 98, 97.8]],
  ['종합 수율(FPY)', '97.1%', '+0.4%p', C.blue, [96, 96.5, 96.2, 97, 97.3, 97.1]],
  ['평균 OEE', '86.6%', '+0.9%p', C.navy, [83, 84, 85, 84, 86, 86.6]],
  ['납기 준수율', '98.4%', '-0.3%p', C.warn, [99, 98, 99, 98.5, 98.7, 98.4]],
  ['재고 회전율', '5.9회', '+0.3', C.teal, [5.4, 5.6, 5.5, 5.7, 5.8, 5.9]],
  ['클레임 건수', '14건', '-3건', C.err, [22, 19, 17, 16, 15, 14]],
];
const scores: [string, number, string][] = [['생산', 92, C.teal], ['품질', 88, C.blue], ['설비', 86, C.navy], ['자재/물류', 90, C.warn], ['원가', 84, '#7a3f97']];

/** 종합 KPI 대시보드 — 와이어프레임 report-exec.jsx 정본. */
export default function ReportKpiScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="종합 KPI 대시보드" sub="경영 대시보드 / 종합 KPI (Executive)" type="R2" />
      <RParam period="2026-06 (월간)"><FField label="공장"><FSel value="전사" w={80} /></FField></RParam>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const up = t[2].startsWith('+');
          const good = (up && t[0] !== '클레임 건수') || (!up && t[0] === '클레임 건수');
          return (
            <Card key={t[0]}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11.5px] font-semibold text-ink2">{t[0]}</div>
                  <div className="mt-1 text-[26px] font-extrabold tracking-tight tabular-nums text-ink">{t[1]}</div>
                  <div className="mt-0.5 text-[11px] font-bold" style={{ color: good ? C.ok : C.err }}>{up ? '▲' : '▼'} {t[2].replace(/^[-+]/, '')} <span className="font-medium text-ink3">전월비</span></div>
                </div>
                <Sparkline data={t[4]} w={84} h={36} color={t[3]} />
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="생산성 vs 품질 (월별)">
          <LineChart series={[{ data: [94, 96, 95, 97, 98, 97.8], c: C.teal }, { data: [96, 96.5, 96.2, 97, 97.3, 97.1], c: C.blue }]} labels={['1월', '2월', '3월', '4월', '5월', '6월']} h={200} max={100} />
          <RLegend items={[['생산 달성률', C.teal], ['종합 수율', C.blue]]} />
        </Card>
        <Card title="부문별 종합 평가">
          <div className="mt-1 flex flex-col gap-3">
            {scores.map((r) => (
              <div key={r[0]}>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="font-semibold text-ink2">{r[0]}</span><span className="font-extrabold text-ink">{r[1]}점</span></div>
                <ProgBar v={r[1]} color={r[2]} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
