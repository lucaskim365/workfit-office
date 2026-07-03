import { Card } from '@/shared/ui/Card';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, RLegend, ProgBar, FField, FSel } from '../_report';
import { getExecDashboardData } from '@/modules/exec/mock';

/**
 * 종합 KPI 대시보드 — 와이어프레임 report-exec.jsx 정본.
 * 데이터는 경영 대시보드와 동일한 단일 소스(getExecDashboardData). 계획서 P4.
 */
export default function ReportKpiScreen() {
  const d = getExecDashboardData();
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="종합 KPI 대시보드" sub="경영 대시보드 / 종합 KPI (Executive)" type="R2" />
      <RParam period={d.period}><FField label="공장"><FSel value={d.company} w={80} /></FField></RParam>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {d.kpis.map((t) => {
          const up = t.delta.trim().startsWith('+');
          const good = up === t.goodWhenUp;
          return (
            <Card key={t.key}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11.5px] font-semibold text-ink2">{t.label}</div>
                  <div className="mt-1 text-[26px] font-extrabold tracking-tight tabular-nums text-ink">{t.value}</div>
                  <div className="mt-0.5 text-[11px] font-bold" style={{ color: good ? C.ok : C.err }}>{up ? '▲' : '▼'} {t.delta.replace(/^[-+]/, '')} <span className="font-medium text-ink3">전월비</span></div>
                </div>
                <Sparkline data={t.spark} w={84} h={36} color={t.color} />
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="생산성 vs 품질 (월별)">
          <LineChart series={[{ data: d.trend.productivity, c: C.teal }, { data: d.trend.quality, c: C.blue }]} labels={d.trend.labels} h={200} max={100} />
          <RLegend items={[['생산 달성률', C.teal], ['종합 수율', C.blue]]} />
        </Card>
        <Card title="부문별 종합 평가">
          <div className="mt-1 flex flex-col gap-3">
            {d.scores.map((r) => (
              <div key={r.label}>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="font-semibold text-ink2">{r.label}</span><span className="font-extrabold text-ink">{r.score}점</span></div>
                <ProgBar v={r.score} color={r.color} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
