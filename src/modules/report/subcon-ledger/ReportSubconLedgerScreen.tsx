import { Card } from '@/shared/ui/Card';
import { RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '외주처' }, { label: '품목', mono: true }, { label: '지급', align: 'right' }, { label: '투입', align: 'right' }, { label: '반품', align: 'right' }, { label: '잔여', align: 'right' }];
const rows = [
  ['대성테크', 'PCB-A1', '4,200', '3,100', '0', '1,100'],
  ['한울가공', 'EMI 쉴드캔', '2,800', '2,400', '50', '350'],
  ['동진정밀', '200mm 웨이퍼', '1,500', '900', '0', '600'],
  ['서원SMT', '보드 커넥터', '9,000', '7,200', '120', '1,680'],
];
const total = ['합계', '', '17,500', '13,600', '170', '3,730'];

/** 외주 자재 수불 — 와이어프레임 report-mat.jsx 정본. */
export default function ReportSubconLedgerScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="외주 자재 수불" sub="자재·재고 리포트 / 외주(사급) 자재 수불" type="R3" />
      <RParam><FField label="외주처"><FSel /></FField></RParam>
      <MKpis items={[['지급 합계', '17,500', 'EA'], ['투입', '13,600', 'EA', 'teal'], ['반품', '170', 'EA'], ['외주처 잔여', '3,730', 'EA']]} />
      <Card title="외주처별 사급 자재 수불 (지급 − 투입 − 반품 = 잔여)" bodyClassName="p-0">
        <RTable cols={cols} rows={rows} total={total} highlightCol={5} />
      </Card>
    </div>
  );
}
