import { Card } from '@/shared/ui/Card';
import { RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '라인' }, { label: '교대' }, { label: '제품', mono: true }, { label: '계획', align: 'right' }, { label: '양품', align: 'right' }, { label: '불량', align: 'right' }, { label: '달성률', align: 'right' }];
const rows = [
  ['M-Line 1', '주간', 'MX-200', '4,800', '4,720', '62', '98.3%'],
  ['M-Line 1', '야간', 'MX-200', '4,800', '4,655', '81', '97.0%'],
  ['M-Line 2', '주간', 'MX-310', '3,600', '3,540', '44', '98.3%'],
  ['A-Line', '주간', 'PKG-BGA', '6,000', '5,880', '95', '98.0%'],
  ['A-Line', '야간', 'PKG-BGA', '6,000', '5,790', '120', '96.5%'],
];
const total = ['합계', '', '', '25,200', '24,585', '402', '97.6%'];

/** 일일 생산 실적 보고서 — 와이어프레임 report-prod.jsx 정본. */
export default function ReportProdDailyScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="일일 생산 실적 보고서" sub="생산 리포트 / 일일 생산 실적 (Daily Production)" type="R1" />
      <RParam period="2026-06-21 (일간)"><FField label="공장"><FSel value="Fab1" w={90} /></FField><FField label="라인"><FSel /></FField></RParam>
      <MKpis items={[['총 생산(양품)', '24,585', 'EA', 'teal'], ['계획 달성률', '97.6', '%'], ['불량', '402', 'EA'], ['가동률', '94.2', '%']]} />
      <Card title="라인·교대별 생산 실적" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">2026-06-21 마감 기준</span>}>
        <RTable cols={cols} rows={rows} total={total} highlightCol={4} />
      </Card>
    </div>
  );
}
