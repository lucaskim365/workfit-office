import { Card } from '@/shared/ui/Card';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { C, RHead, RParam, MKpis, RTable, RLegend, FField, FSel, type RCol } from '../_report';

const bars = [
  { label: 'ETCH-01', pm: 320, bm: 180 }, { label: 'CVD-03', pm: 280, bm: 240 },
  { label: 'LITHO-02', pm: 210, bm: 420 }, { label: 'BOND-05', pm: 360, bm: 90 },
];
const cols: RCol[] = [{ label: '설비', mono: true }, { label: 'PM(건)', align: 'right' }, { label: 'BM(건)', align: 'right' }, { label: 'PM 비용', align: 'right' }, { label: 'BM 비용', align: 'right' }, { label: '합계', align: 'right' }];
const rows = [
  ['ETCH-01', '18', '4', '320만', '180만', '500만'],
  ['CVD-03', '16', '6', '280만', '240만', '520만'],
  ['LITHO-02', '12', '9', '210만', '420만', '630만'],
  ['BOND-05', '20', '3', '360만', '90만', '450만'],
];
const total = ['합계', '66', '22', '1,170만', '930만', '2,100만'];

/** 보전 실적·비용 — 와이어프레임 report-equip.jsx 정본. */
export default function ReportMaintCostScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="보전 실적·비용" sub="설비 리포트 / 보전(PM/BM) 실적 및 비용" type="R3" />
      <RParam><FField label="설비"><FSel /></FField><FField label="보전유형"><FSel /></FField></RParam>
      <MKpis items={[['총 보전 건', '88', '건'], ['예방(PM)', '66', '건', 'teal'], ['사후(BM)', '22', '건'], ['총 보전비', '2,100', '만원']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card title="설비별 보전 비용 (만원)">
          <GroupedBars data={bars} series={[{ key: 'pm', c: C.teal }, { key: 'bm', c: C.err }]} h={210} />
          <RLegend items={[['PM 예방', C.teal], ['BM 사후', C.err]]} />
        </Card>
        <Card title="설비별 보전 실적·비용 명세" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} total={total} highlightCol={5} />
        </Card>
      </div>
    </div>
  );
}
