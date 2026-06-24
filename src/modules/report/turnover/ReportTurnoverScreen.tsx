import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { C, RHead, RParam, MKpis, RTable, ProgBar, FField, FSel, type RCol } from '../_report';

const aging: [string, number, string][] = [['0~30일', 64, C.teal], ['31~60일', 21, C.blue], ['61~90일', 9, C.warn], ['91일+', 6, C.err]];
const cols: RCol[] = [{ label: '품목', mono: true }, { label: '회전율', align: 'right' }, { label: '회전일수', align: 'right' }, { label: '체류 구간' }, { label: '판정', align: 'center' }];
const raw: [string, string, string, string, string][] = [
  ['WF-300-B', '8.2회', '44일', '0~30일', '정상'],
  ['PKG-BGA-14', '6.1회', '60일', '31~60일', '정상'],
  ['CHM-SL-05', '3.4회', '107일', '91일+', '체화'],
  ['RES-PR-22', '9.8회', '37일', '0~30일', '정상'],
  ['CHM-GAS-02', '2.1회', '174일', '91일+', '체화'],
];
const rows = raw.map((r) => [r[0], r[1], r[2], r[3], <Pill key="p" tone={r[4] === '체화' ? 'err' : 'ok'}>{r[4]}</Pill>]);

/** 재고 회전율·장기재고 — 와이어프레임 report-mat.jsx 정본. */
export default function ReportTurnoverScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="재고 회전율·장기재고" sub="자재·재고 리포트 / 재고 회전율 및 Aging" type="R5" />
      <RParam><FField label="창고"><FSel /></FField></RParam>
      <MKpis items={[['평균 회전율', '5.9', '회'], ['평균 회전일수', '62', '일'], ['체화 품목', '14', '종'], ['장기재고액', '0.57', '억원']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Card title="재고 경과기간(Aging) 분포">
          <div className="mt-1 flex flex-col gap-3">
            {aging.map((a) => (
              <div key={a[0]}>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="font-semibold text-ink2">{a[0]}</span><span className="font-extrabold text-ink">{a[1]}%</span></div>
                <ProgBar v={a[1]} color={a[2]} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="품목별 회전율·체류기간" bodyClassName="p-0">
          <RTable cols={cols} rows={rows} highlightCol={1} />
        </Card>
      </div>
    </div>
  );
}
