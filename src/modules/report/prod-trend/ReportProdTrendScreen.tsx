import { Card } from '@/shared/ui/Card';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, RTable, RLegend, FField, FSel, type RCol } from '../_report';

const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
const series = [
  { data: [88, 92, 95, 91, 97, 94], c: C.teal },
  { data: [41, 43, 44, 42, 45, 43], c: C.blue },
  { data: [64, 68, 71, 66, 72, 69], c: C.warn },
];
const cols: RCol[] = [{ label: '제품', mono: true }, { label: '전월', align: 'right' }, { label: '당월', align: 'right' }, { label: '증감', align: 'right' }, { label: '', align: 'center' }];
const rows = [
  ['MX-200', '94.3K', '97.0K', '+2.9%', '▲'],
  ['MX-310', '42.8K', '45.1K', '+5.4%', '▲'],
  ['PKG-BGA', '69.4K', '72.0K', '-3.6%', '▼'],
];

/** 제품별 생산 추이 — 와이어프레임 report-prod.jsx 정본. */
export default function ReportProdTrendScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="제품별 생산 추이" sub="생산 리포트 / 제품별 생산 추이 (Trend)" type="R5" />
      <RParam><FField label="제품"><FSel value="전체 (3종)" w={110} /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="월별 생산량 추이 (단위: 천 EA)">
          <LineChart series={series} labels={labels} h={230} area max={110} />
          <RLegend items={[['MX-200', C.teal], ['MX-310', C.blue], ['PKG-BGA', C.warn]]} />
        </Card>
        <Card title="전월 대비" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={3} />
        </Card>
      </div>
    </div>
  );
}
