import { Card } from '@/shared/ui/Card';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, MKpis, RTable, RLegend, FField, FSel, type RCol } from '../_report';

const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
const cols: RCol[] = [{ label: '설비', mono: true }, { label: 'MTBF(h)', align: 'right' }, { label: 'MTTR(h)', align: 'right' }, { label: '고장(건)', align: 'right' }, { label: '추세', align: 'center' }];
const rows = [
  ['ETCH-01', '412', '2.4', '5', '↗'],
  ['CVD-03', '386', '3.1', '6', '↘'],
  ['LITHO-02', '298', '4.2', '9', '↘'],
  ['BOND-05', '524', '1.8', '3', '↗'],
];

/** MTBF/MTTR 신뢰성 — 와이어프레임 report-equip.jsx 정본. */
export default function ReportMtbfScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="MTBF/MTTR 신뢰성" sub="설비 리포트 / 신뢰성 분석 (MTBF·MTTR)" type="R5" />
      <RParam><FField label="설비"><FSel /></FField></RParam>
      <MKpis items={[['평균 MTBF', '405', 'h', 'teal'], ['평균 MTTR', '2.9', 'h'], ['총 고장', '23', '건'], ['신뢰도', '94.1', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="MTBF / MTTR 월별 추이">
          <LineChart series={[{ data: [360, 372, 358, 390, 398, 405], c: C.teal }, { data: [380, 360, 420, 310, 300, 290], c: C.warn }]} labels={labels} h={210} max={500} />
          <RLegend items={[['MTBF (h)', C.teal], ['MTTR (×0.1h)', C.warn]]} />
        </Card>
        <Card title="설비별 신뢰성 지표" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={1} />
        </Card>
      </div>
    </div>
  );
}
