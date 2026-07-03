import { Card } from '@/shared/ui/Card';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { Donut, type DonutDatum } from '@/shared/ui/charts/Donut';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { DivergingBars } from '@/shared/ui/charts/DivergingBars';
import { C, RLegend } from '../report/_report';
import { getExecPerformanceData } from './performance.mock';

const won = (n: number) => n.toLocaleString('ko-KR');

/** 도넛 + 항목별 비중 범례. */
function DonutBlock({ title, data }: { title: string; data: DonutDatum[] }) {
  const top = [...data].sort((a, b) => b.v - a.v)[0];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[11px] font-bold text-ink2">{title}</div>
      <Donut data={data} size={120} thickness={20} centerTop={`${top.v}%`} centerSub={top.name} />
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 text-[10px] text-ink2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.c }} />
            {s.name} {s.v}%
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * 성과 관리(매출·거래처) 섹션 — 경영 대시보드 상단에 삽입.
 * 데이터는 단일 소스 getExecPerformanceData()(데모 샘플).
 */
export function PerformanceSection() {
  const d = getExecPerformanceData();

  return (
    <div className="flex flex-col gap-3.5">
      {/* KPI 4 */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {d.kpis.map((k) => (
          <Card key={k.key}>
            <div className="text-[11.5px] font-semibold text-ink2">{k.label}</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              {k.trend && <span className="text-[15px] font-extrabold" style={{ color: k.color }}>{k.trend === 'up' ? '▲' : '▼'}</span>}
              <span className="text-[28px] font-extrabold tabular-nums tracking-tight" style={{ color: k.color }}>{k.value}</span>
              <span className="text-[12px] font-semibold text-ink3">{k.unit}</span>
            </div>
            {k.sub && <div className="mt-1 text-[10.5px] text-ink3">{k.sub}</div>}
          </Card>
        ))}
      </div>

      {/* 목표 게이지 · 대조군 추이 · 특성 도넛 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.3fr_1.4fr]">
        <Card title="목표 대비 성과">
          <div className="flex flex-col items-center gap-2 pt-1">
            <Gauge value={d.goal.value} label="달성" size={150} color={C.warn} />
            <div className="text-[26px] font-extrabold tabular-nums text-ink">{d.goal.value}<span className="text-[14px] text-ink3">%</span></div>
            <div className="px-2 text-center text-[10.5px] text-ink3">{d.goal.caption}</div>
          </div>
        </Card>

        <Card title="대조군 대비 성장 추이">
          <LineChart
            series={[{ data: d.trend.target, c: C.navy }, { data: d.trend.control, c: C.c5 }]}
            labels={d.trend.labels}
            h={190}
            max={100}
          />
          <RLegend items={[['대상 거래처', C.navy], ['대조군(전년)', C.c5]]} />
        </Card>

        <Card title="대상 거래처 특성">
          <div className="grid grid-cols-2 gap-2 pt-1">
            <DonutBlock title="[업종 특성]" data={d.byIndustry} />
            <DonutBlock title="[지역 특성]" data={d.byRegion} />
          </div>
        </Card>
      </div>

      {/* 주간 매출 증감 · 대상 거래처 상세 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1.4fr]">
        <Card title="전년 대비 매출 추이 (최근 10주)">
          <DivergingBars data={d.weekly} h={210} unit="" upColor={C.err} downColor={C.blue} />
          <RLegend items={[['상승', C.err], ['하락', C.blue]]} />
        </Card>

        <Card title="대상 거래처 정보" bodyClassName="p-0">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-panel-alt text-ink2">
                <th className="px-3 py-2.5 text-left font-bold">NO</th>
                <th className="px-3 py-2.5 text-left font-bold">거래처명</th>
                <th className="px-3 py-2.5 text-left font-bold">지역</th>
                <th className="px-3 py-2.5 text-right font-bold">사업 전 매출</th>
                <th className="px-3 py-2.5 text-right font-bold">당기 매출</th>
                <th className="px-3 py-2.5 text-right font-bold">매출 증감</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => {
                const up = r.growth >= 0;
                return (
                  <tr key={r.no} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 tabular-nums text-ink3">{r.no}</td>
                    <td className="px-3 py-2.5 font-bold text-ink">{r.name}</td>
                    <td className="px-3 py-2.5 text-ink2">{r.region}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{won(r.before)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{won(r.after)}</td>
                    <td className="px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: up ? C.ok : C.err }}>
                      {up ? '▲' : '▼'} {Math.abs(r.growth)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
