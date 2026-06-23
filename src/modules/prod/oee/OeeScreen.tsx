import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField } from '@/shared/ui/FilterBar';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { ReadSelect } from '../_bits';
import { T } from '@/shared/theme/tokens';

/** 생산성/종합효율 (OEE) — 와이어프레임 prod-screens-2.OeeContent 정본. */
export default function OeeScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">생산성/종합효율</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산성 및 종합효율 (OEE Analysis)</p>
        </div>
        <ActionBar actions={['compare', 'download']} />
      </div>

      <FilterBar onSearch={() => {}}>
        <FilterField label="기간"><ReadSelect value="2026-06" w={120} /></FilterField>
        <FilterField label="라인"><ReadSelect value="전체" w={100} /></FilterField>
        <FilterField label="단위"><ReadSelect value="일별" w={100} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="OEE" value="87.4" unit="%" delta={2.3} tone="teal" /></Card>
        <Card><Kpi label="가동률" value="92.1" unit="%" delta={1.2} /></Card>
        <Card><Kpi label="성능" value="95.0" unit="%" delta={-0.4} /></Card>
        <Card><Kpi label="양품률(FPY)" value="96.8" unit="%" delta={0.8} /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card
          title="OEE 추이 (일별)"
          action={
            <div className="flex gap-3.5">
              {[{ c: T.teal, t: 'OEE' }, { c: T.blue, t: '목표' }].map((it) => (
                <span key={it.t} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.c }} />
                  {it.t}
                </span>
              ))}
            </div>
          }
        >
          <LineChart
            series={[{ data: [82, 85, 84, 88, 91, 89, 87], c: T.teal }, { data: [85, 85, 85, 85, 85, 85, 85], c: T.blue }]}
            labels={['05', '06', '07', '08', '09', '10', '11']}
            w={620}
            h={210}
            max={100}
            area
          />
        </Card>

        <Card title="라인별 OEE 비교">
          <RankBars rows={[
            { label: 'M-Line', v: 89, c: T.teal },
            { label: 'P-Line', v: 84, c: T.teal },
            { label: 'A-Line', v: 61, c: T.warn },
          ]} max={100} />
          <div className="my-3.5 h-px bg-border" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-panel-alt px-2 py-3 text-center">
              <div className="text-[19px] font-extrabold text-ink">413</div>
              <div className="text-[9.5px] font-semibold text-ink3">UPH (시간당)</div>
            </div>
            <div className="rounded-lg bg-panel-alt px-2 py-3 text-center">
              <div className="text-[19px] font-extrabold text-teal">96.8%</div>
              <div className="text-[9.5px] font-semibold text-ink3">FPY (직행률)</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
