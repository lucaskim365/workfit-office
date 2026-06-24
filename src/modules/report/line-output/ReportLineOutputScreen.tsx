import { Card } from '@/shared/ui/Card';
import { RHead, RParam, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '라인 / 공정' }, { label: '06/16', align: 'right' }, { label: '06/17', align: 'right' }, { label: '06/18', align: 'right' }, { label: '06/19', align: 'right' }, { label: '06/20', align: 'right' }, { label: '합계', align: 'right' }];
const rows = [
  ['M-Line 1 · 가공', '7,820', '7,910', '8,010', '7,640', '6,980', '38,360'],
  ['M-Line 1 · 조립', '7,640', '7,780', '7,900', '7,500', '6,900', '37,720'],
  ['M-Line 2 · 가공', '3,510', '3,540', '3,580', '3,300', '3,420', '17,350'],
  ['A-Line · 패키징', '11,540', '11,760', '12,000', '11,200', '11,520', '58,020'],
  ['A-Line · 검사', '11,420', '11,640', '11,880', '11,090', '11,400', '57,430'],
];
const total = ['합계', '41,930', '42,630', '43,370', '40,730', '40,220', '208,880'];

/** 라인/공정별 생산량 집계 — 와이어프레임 report-prod.jsx 정본. */
export default function ReportLineOutputScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="라인/공정별 생산량 집계" sub="생산 리포트 / 라인·공정 생산량 피벗" type="R3" />
      <RParam><FField label="집계 단위"><FSel value="일자" w={80} /></FField><FField label="공장"><FSel value="Fab1" w={90} /></FField></RParam>
      <Card title="라인·공정 × 일자 교차 집계" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">단위: EA · 행=라인·공정, 열=일자</span>}>
        <RTable cols={cols} rows={rows} total={total} highlightCol={6} />
      </Card>
    </div>
  );
}
