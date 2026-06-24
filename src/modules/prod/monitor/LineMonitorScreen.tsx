import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { KPIS, SPARK } from '@/modules/ops/dashboard/mock';
import { ProgBar } from '../_bits';
import { T } from '@/shared/theme/tokens';
import { useLineMonitors } from '@/features/lineMonitor/useLineMonitors';

/** 생산 현황 모니터링 — 와이어프레임 prod-screens.LineMonitorContent 정본. */
export default function LineMonitorScreen() {
  const { data: lines = [], isLoading } = useLineMonitors();

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산 현황 모니터링</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 현황 모니터링 (Line Monitoring)</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {KPIS.map((k, i) => (
          <Card key={k.label} bodyClassName="flex items-center justify-between">
            <Kpi {...k} />
            <Sparkline data={SPARK} color={i % 2 ? T.blue : T.teal} />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {lines.length === 0 && (
          <div className="col-span-full grid place-items-center py-10 text-[13px] text-ink3">
            {isLoading ? '불러오는 중…' : '라인 정보가 없습니다.'}
          </div>
        )}
        {lines.map((l) => {
          const tone: Tone = l.eq === '가동' ? 'ok' : 'warn';
          return (
            <Card
              key={l.line}
              title={
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${l.eq === '가동' ? 'bg-ok' : 'bg-amber'}`} />
                  {l.line}
                </span>
              }
              action={<Pill tone={tone}>{l.eq}</Pill>}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11.5px] font-semibold text-ink3">가동 품목</span>
                  <span className="font-mono text-[12.5px] font-bold text-ink">{l.item}</span>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between">
                    <span className="text-[11px] font-semibold text-ink3">목표 대비 실적</span>
                    <span className="text-[11.5px] font-bold text-ink">{l.act.toLocaleString()} / {l.plan.toLocaleString()}</span>
                  </div>
                  <ProgBar v={l.act} max={l.plan} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-panel-alt px-3 py-2.5 text-center">
                    <div className="text-[17px] font-extrabold text-teal">{l.oee}%</div>
                    <div className="text-[9.5px] font-semibold text-ink3">OEE</div>
                  </div>
                  <div className="rounded-lg bg-panel-alt px-3 py-2.5 text-center">
                    <div className="text-[17px] font-extrabold text-ink">{Math.round(l.act / 6)}</div>
                    <div className="text-[9.5px] font-semibold text-ink3">UPH</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="라인별 시간대 생산 추이">
        <LineChart
          series={[{ data: [180, 240, 220, 260, 250, 290, 270], c: T.teal }, { data: [120, 150, 140, 165, 160, 180, 175], c: T.blue }]}
          labels={['08', '10', '12', '14', '16', '18', '20']}
          w={680}
          h={200}
          max={320}
          area
        />
      </Card>
    </div>
  );
}
