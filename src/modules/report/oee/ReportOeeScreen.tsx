import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { Gauge } from '@/shared/ui/charts/Gauge';
import { LineChart } from '@/shared/ui/charts/LineChart';
import { C, RHead, RParam, RTable, ProgBar, FField, FSel, type RCol } from '../_report';

const factors: [string, number, string][] = [['가용성 (Availability)', 92.4, C.blue], ['성능 (Performance)', 95.1, C.teal], ['품질 (Quality)', 98.6, C.navy]];
const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
const cols: RCol[] = [{ label: '설비', mono: true }, { label: '가용성', align: 'right' }, { label: '성능', align: 'right' }, { label: '품질', align: 'right' }, { label: 'OEE', align: 'right' }, { label: '등급', align: 'center' }];
const raw: [string, string, string, string, string, string][] = [
  ['ETCH-01', '94.1%', '93.2%', '99.0%', '86.8%', '양호'],
  ['CVD-03', '90.2%', '96.4%', '98.1%', '85.3%', '양호'],
  ['LITHO-02', '88.6%', '92.0%', '97.4%', '79.4%', '주의'],
  ['BOND-05', '95.8%', '97.1%', '99.2%', '92.3%', '우수'],
];
const tone = (s: string): Tone => (s === '우수' ? 'ok' : s === '주의' ? 'warn' : 'info');
const rows = raw.map((r) => [r[0], r[1], r[2], r[3], <b key="o" className="text-ink">{r[4]}</b>, <Pill key="p" tone={tone(r[5])}>{r[5]}</Pill>]);

/** OEE 종합 리포트 — 와이어프레임 report-equip.jsx 정본. */
export default function ReportOeeScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="OEE 종합 리포트" sub="설비 리포트 / 종합 설비 효율 (OEE)" type="R2" />
      <RParam><FField label="설비"><FSel /></FField><FField label="라인"><FSel /></FField></RParam>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Card title="종합 OEE">
          <div className="flex flex-col items-center gap-2">
            <Gauge value={86.6} max={100} label="OEE (%)" size={170} color={C.teal} />
            <div className="mt-1 flex w-full flex-col gap-2.5">
              {factors.map((f) => (
                <div key={f[0]}>
                  <div className="mb-1 flex justify-between text-[11px]"><span className="font-semibold text-ink2">{f[0]}</span><span className="font-extrabold text-ink">{f[1]}%</span></div>
                  <ProgBar v={f[1]} color={f[2]} />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="월별 OEE 추이">
          <LineChart series={[{ data: [82, 84, 85, 83, 86, 86.6], c: C.teal }]} labels={labels} h={150} max={100} area />
          <div className="mt-3.5"><RTable cols={cols} rows={rows} highlightCol={4} /></div>
        </Card>
      </div>
    </div>
  );
}
