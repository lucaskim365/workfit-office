import { Card } from '@/shared/ui/Card';
import { RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '품목', mono: true }, { label: '품명' }, { label: '재고수량', align: 'right' }, { label: '단가(원)', align: 'right' }, { label: '평가액(원)', align: 'right' }];
const rows = [
  ['WF-300-B', '300mm 웨이퍼', '1,320', '420,000', '554,400,000'],
  ['PKG-BGA-14', 'BGA 기판', '760', '85,000', '64,600,000'],
  ['CHM-SL-05', '슬러리 SL-05', '180', '210,000', '37,800,000'],
  ['RES-PR-22', '포토레지스트', '47', '680,000', '31,960,000'],
  ['CHM-GAS-02', '공정 가스', '28', '320,000', '8,960,000'],
];
const total = ['합계', '', '2,335', '', '697,720,000'];

/** 재고 현황·자산 평가 — 와이어프레임 report-mat.jsx 정본. */
export default function ReportStockValueScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="재고 현황·자산 평가" sub="자재·재고 리포트 / 재고 자산 평가" type="R3" />
      <RParam period="2026-06-21 (기준일)"><FField label="창고"><FSel /></FField><FField label="평가법"><FSel value="이동평균" w={90} /></FField></RParam>
      <MKpis items={[['재고 품목', '186', '종'], ['총 재고수량', '2,335', 'EA'], ['총 평가액', '6.98', '억원', 'teal'], ['장기재고 비중', '8.2', '%']]} />
      <Card title="품목별 재고 자산 평가 (재고수량 × 단가)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">평가액 내림차순</span>}>
        <RTable cols={cols} rows={rows} total={total} highlightCol={4} />
      </Card>
    </div>
  );
}
