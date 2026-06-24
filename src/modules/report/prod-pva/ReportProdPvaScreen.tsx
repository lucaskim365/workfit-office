import { Card } from '@/shared/ui/Card';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { C, RHead, RParam, MKpis, RTable, RLegend, FField, FSel, type RCol } from '../_report';

const bars = [
  { label: '06/15', plan: 24000, act: 23100 }, { label: '06/16', plan: 24000, act: 24300 },
  { label: '06/17', plan: 25200, act: 24585 }, { label: '06/18', plan: 25200, act: 25010 },
  { label: '06/19', plan: 25200, act: 23800 }, { label: '06/20', plan: 21600, act: 21540 },
];
const cols: RCol[] = [{ label: '제품', mono: true }, { label: '계획', align: 'right' }, { label: '실적', align: 'right' }, { label: '차이', align: 'right' }, { label: '달성률', align: 'right' }];
const rows = [
  ['MX-200', '96,000', '94,300', '-1,700', '98.2%'],
  ['MX-310', '43,200', '42,810', '-390', '99.1%'],
  ['PKG-BGA', '72,000', '69,420', '-2,580', '96.4%'],
];

/** 생산계획 대비 실적 — 와이어프레임 report-prod.jsx 정본. */
export default function ReportProdPvaScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="생산계획 대비 실적" sub="생산 리포트 / 계획 대비 실적 (Plan vs Actual)" type="R3" />
      <RParam><FField label="제품군"><FSel /></FField></RParam>
      <MKpis items={[['계획 합계', '211,200', 'EA'], ['실적 합계', '206,530', 'EA', 'teal'], ['평균 달성률', '97.8', '%'], ['미달 일수', '4', '일']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="일자별 계획 대비 실적">
          <GroupedBars data={bars} series={[{ key: 'plan', c: C.c5 }, { key: 'act', c: C.teal }]} h={240} />
          <RLegend items={[['계획', C.c5], ['실적', C.teal]]} />
        </Card>
        <Card title="제품별 달성 현황" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={4} />
        </Card>
      </div>
    </div>
  );
}
