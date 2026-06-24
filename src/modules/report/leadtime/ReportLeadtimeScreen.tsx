import { Card } from '@/shared/ui/Card';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C, RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const procs = [
  { label: '가공', v: 4.2, c: C.teal }, { label: '조립', v: 6.8, c: C.blue },
  { label: '검사', v: 2.1, c: C.navy }, { label: '대기', v: 5.4, c: C.warn },
  { label: '포장', v: 1.6, c: C.c5 },
];
const cols: RCol[] = [{ label: '공정' }, { label: '작업', align: 'right' }, { label: '대기', align: 'right' }, { label: '리드타임', align: 'right' }, { label: '비중', align: 'right' }];
const rows = [
  ['가공', '3.8h', '0.4h', '4.2h', '21%'],
  ['조립', '5.9h', '0.9h', '6.8h', '34%'],
  ['검사', '1.8h', '0.3h', '2.1h', '11%'],
  ['공정 간 대기', '—', '5.4h', '5.4h', '27%'],
  ['포장', '1.4h', '0.2h', '1.6h', '8%'],
];
const total = ['합계', '12.9h', '7.2h', '20.1h', '100%'];

/** 공정 리드타임 분석 — 와이어프레임 report-cost.jsx 정본. */
export default function ReportLeadtimeScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="공정 리드타임 분석" sub="원가·효율 리포트 / 공정별 리드타임" type="R5" />
      <RParam><FField label="제품"><FSel /></FField><FField label="공정"><FSel /></FField></RParam>
      <MKpis items={[['총 리드타임', '20.1', 'h'], ['작업 시간', '12.9', 'h', 'teal'], ['대기 시간', '7.2', 'h'], ['대기 비중', '35.8', '%']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card title="공정별 리드타임 (h)">
          <RankBars rows={procs} />
        </Card>
        <Card title="공정별 작업·대기 시간 명세" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} total={total} highlightCol={3} />
        </Card>
      </div>
    </div>
  );
}
