import { Card } from '@/shared/ui/Card';
import { RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '품목', mono: true }, { label: '품명' }, { label: '기초', align: 'right' }, { label: '입고', align: 'right' }, { label: '출고', align: 'right' }, { label: '기말', align: 'right' }];
const rows = [
  ['WF-300-B', '300mm 웨이퍼', '1,200', '2,500', '2,380', '1,320'],
  ['RES-PR-22', '포토레지스트', '85', '40', '78', '47'],
  ['CHM-SL-05', '슬러리 SL-05', '210', '60', '90', '180'],
  ['PKG-BGA-14', 'BGA 기판', '640', '3,000', '2,880', '760'],
  ['CHM-GAS-02', '공정 가스', '52', '15', '39', '28'],
];
const total = ['합계', '', '2,187', '5,615', '5,467', '2,335'];

/** 자재 수불부 — 와이어프레임 report-mat.jsx 정본. */
export default function ReportStockLedgerScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="자재 수불부" sub="자재·재고 리포트 / 자재 수불부 (Stock Ledger)" type="R1" />
      <RParam><FField label="창고"><FSel value="원자재 창고" /></FField><FField label="품목군"><FSel /></FField></RParam>
      <MKpis items={[['기초 재고', '2,187', 'EA'], ['입고', '5,615', 'EA', 'teal'], ['출고', '5,467', 'EA'], ['기말 재고', '2,335', 'EA']]} />
      <Card title="품목별 수불 명세 (기초 + 입고 − 출고 = 기말)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">2026-06 월간</span>}>
        <RTable cols={cols} rows={rows} total={total} highlightCol={5} />
      </Card>
    </div>
  );
}
