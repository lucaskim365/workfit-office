import { Card } from '@/shared/ui/Card';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { C, RHead, RParam, RTable, RLegend, FField, FSel, type RCol } from '../_report';

const bars = [
  { label: '생산량', prev: 94, cur: 98 }, { label: '수율', prev: 96, cur: 97 },
  { label: 'OEE', prev: 84, cur: 87 }, { label: '납기', prev: 99, cur: 98 },
  { label: '불량률', prev: 22, cur: 16 },
];
const cols: RCol[] = [{ label: '지표' }, { label: '전월', align: 'right' }, { label: '당월', align: 'right' }, { label: '증감', align: 'right' }, { label: '', align: 'center' }];
const raw: [string, string, string, string, string][] = [
  ['생산량(천EA)', '198.4', '206.5', '+4.1%', '▲'],
  ['종합 수율', '96.7%', '97.1%', '+0.4%p', '▲'],
  ['평균 OEE', '84.2%', '86.6%', '+2.4%p', '▲'],
  ['납기 준수율', '98.7%', '98.4%', '-0.3%p', '▼'],
  ['불량률', '2.2%', '1.6%', '-0.6%p', '▲'],
];
const rows = raw.map((r) => [r[0], r[1], r[2], r[3], <span key="t" className="font-extrabold" style={{ color: r[4] === '▲' ? C.ok : C.err }}>{r[4]}</span>]);

/** 기간 비교 트렌드 — 와이어프레임 report-exec.jsx 정본. */
export default function ReportPeriodScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="기간 비교 트렌드" sub="경영 대시보드 / 기간 비교 (Period Comparison)" type="R5" />
      <RParam period="2026-05 vs 2026-06"><FField label="비교기준"><FSel value="전월" w={80} /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="핵심 지표 전월 대비 (지수)">
          <GroupedBars data={bars} series={[{ key: 'prev', c: C.c5 }, { key: 'cur', c: C.teal }]} h={220} max={110} />
          <RLegend items={[['전월', C.c5], ['당월', C.teal]]} />
        </Card>
        <Card title="지표별 증감" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={2} />
        </Card>
      </div>
    </div>
  );
}
