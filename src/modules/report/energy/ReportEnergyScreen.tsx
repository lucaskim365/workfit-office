import { Card } from '@/shared/ui/Card';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
const cols: RCol[] = [{ label: '유틸리티' }, { label: '전월', align: 'right' }, { label: '당월', align: 'right' }, { label: '증감', align: 'right' }, { label: '비용', align: 'right' }];
const rows = [
  ['전력', '482 MWh', '468 MWh', '-2.9%', '6,240만'],
  ['용수', '12,400 t', '12,800 t', '+3.2%', '1,860만'],
  ['질소(N₂)', '88,000 N㎥', '85,200 N㎥', '-3.2%', '1,420만'],
  ['압축공기', '142,000 N㎥', '139,500 N㎥', '-1.8%', '980만'],
];

/** 에너지·유틸리티 사용 — 와이어프레임 report-cost.jsx 정본. */
export default function ReportEnergyScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="에너지·유틸리티 사용" sub="원가·효율 리포트 / 에너지·유틸리티 사용량" type="R5" />
      <RParam><FField label="유틸리티"><FSel /></FField><FField label="라인"><FSel /></FField></RParam>
      <MKpis items={[['전력 사용', '468', 'MWh', 'teal'], ['원단위', '0.19', 'kWh/EA'], ['유틸 총비용', '1.05', '억원'], ['전월비', '-2.1', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="전력 사용량 추이 (MWh)">
          <LineChart series={[{ data: [495, 488, 502, 476, 482, 468], c: C.blue }]} labels={labels} h={210} max={560} area />
        </Card>
        <Card title="유틸리티별 사용·비용" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={4} />
        </Card>
      </div>
    </div>
  );
}
