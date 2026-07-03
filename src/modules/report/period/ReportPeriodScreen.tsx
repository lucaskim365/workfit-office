import { Card } from '@/shared/ui/Card';
import { GroupedBars } from '@/shared/ui/charts/GroupedBars';
import { C, RHead, RParam, RTable, RLegend, FField, FSel, type RCol } from '../_report';
import { getExecDashboardData } from '@/modules/exec/mock';

const cols: RCol[] = [{ label: '지표' }, { label: '전월', align: 'right' }, { label: '당월', align: 'right' }, { label: '증감', align: 'right' }, { label: '', align: 'center' }];

/**
 * 기간 비교 트렌드 — 와이어프레임 report-exec.jsx 정본.
 * 데이터는 경영 대시보드와 동일한 단일 소스(getExecDashboardData). 계획서 P4.
 */
export default function ReportPeriodScreen() {
  const d = getExecDashboardData();
  const rows = d.periodRows.map((r) => [
    r.label, r.prev, r.cur, r.delta,
    <span key="t" className="font-extrabold" style={{ color: r.up ? C.ok : C.err }}>{r.up ? '▲' : '▼'}</span>,
  ]);
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="기간 비교 트렌드" sub="경영 대시보드 / 기간 비교 (Period Comparison)" type="R5" />
      <RParam period={d.periodCompareLabel}><FField label="비교기준"><FSel value="전월" w={80} /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="핵심 지표 전월 대비 (지수)">
          <GroupedBars data={d.periodBars} series={[{ key: 'prev', c: C.c5 }, { key: 'cur', c: C.teal }]} h={220} max={110} />
          <RLegend items={[['전월', C.c5], ['당월', C.teal]]} />
        </Card>
        <Card title="지표별 증감" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={2} />
        </Card>
      </div>
    </div>
  );
}
