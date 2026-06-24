import { Card } from '@/shared/ui/Card';
import { RHead, RParam, MKpis, RTable, RPareto, FField, FSel, type RCol } from '../_report';

const data = [
  { label: '솔더링', v: 142 }, { label: '치수불량', v: 98 }, { label: '스크래치', v: 67 },
  { label: '오염', v: 41 }, { label: '변형', v: 28 }, { label: '기타', v: 19 },
];
const cols: RCol[] = [{ label: '불량 유형' }, { label: '코드', mono: true }, { label: '건수', align: 'right' }, { label: '비율', align: 'right' }, { label: '누적', align: 'right' }];
const rows = [
  ['솔더링 불량', 'D-101', '142', '36.4%', '36.4%'],
  ['치수 불량', 'D-203', '98', '25.1%', '61.5%'],
  ['스크래치', 'D-305', '67', '17.2%', '78.7%'],
  ['표면 오염', 'D-118', '41', '10.5%', '89.2%'],
  ['변형/휨', 'D-220', '28', '7.2%', '96.4%'],
];

/** 불량 유형 파레토 — 와이어프레임 report-qual.jsx 정본. */
export default function ReportDefectParetoScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="불량 유형 파레토" sub="품질 리포트 / 불량 유형 파레토 분석" type="R5" />
      <RParam><FField label="공정"><FSel /></FField><FField label="제품"><FSel /></FField></RParam>
      <MKpis items={[['총 불량', '395', '건'], ['상위 3종 비중', '78.7', '%', 'teal'], ['최다 불량', '솔더링', ''], ['불량률', '1.6', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card title="불량 유형별 파레토" action={<span className="text-[10.5px] text-ink3">막대=건수 · 선=누적%</span>}>
          <RPareto data={data} />
        </Card>
        <Card title="불량 순위 상세" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={2} />
        </Card>
      </div>
    </div>
  );
}
