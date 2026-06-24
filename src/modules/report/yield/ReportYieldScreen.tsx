import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
const cols: RCol[] = [{ label: '제품', mono: true }, { label: '수율', align: 'right' }, { label: '불량 Loss', align: 'right' }, { label: '공정 Loss', align: 'right' }, { label: '판정', align: 'center' }];
const raw: [string, string, string, string, string][] = [
  ['MX-200', '98.2%', '1.2%', '0.6%', '양호'],
  ['MX-310', '97.4%', '1.8%', '0.8%', '양호'],
  ['PKG-BGA', '95.8%', '2.9%', '1.3%', '주의'],
];
const rows = raw.map((r) => [r[0], r[1], r[2], r[3], <Pill key="p" tone={r[4] === '양호' ? 'ok' : 'warn'}>{r[4]}</Pill>]);

/** 수율(Yield)·Loss 분석 — 와이어프레임 report-cost.jsx 정본. */
export default function ReportYieldScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="수율(Yield)·Loss 분석" sub="원가·효율 리포트 / 수율 및 손실 분석" type="R2" />
      <RParam><FField label="제품"><FSel /></FField></RParam>
      <MKpis items={[['종합 수율(FPY)', '97.1', '%', 'teal'], ['불량 Loss', '1.9', '%'], ['공정 Loss', '0.9', '%'], ['Loss 금액', '1,840', '만원']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card title="월별 종합 수율 추이">
          <LineChart series={[{ data: [96.2, 96.8, 96.4, 97.0, 97.3, 97.1], c: C.teal }]} labels={labels} h={210} max={100} area />
        </Card>
        <Card title="제품별 수율·손실" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={1} />
        </Card>
      </div>
    </div>
  );
}
