import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { C, RHead, RParam, MKpis, RTable, FField, FSel, type RCol } from '../_report';

const cols: RCol[] = [{ label: '품목', mono: true }, { label: '현재고', align: 'right' }, { label: '안전재고', align: 'right' }, { label: '발주점', align: 'right' }, { label: '상태', align: 'center' }, { label: '조치', align: 'center' }];
const raw: [string, string, string, string, string, string][] = [
  ['WF-300-B', '320', '500', '800', '미달', '발주필요'],
  ['RES-PR-22', '46', '40', '70', '발주점', '발주필요'],
  ['CHM-SL-05', '180', '60', '100', '정상', '—'],
  ['PKG-BGA-14', '760', '500', '1,200', '발주점', '발주필요'],
  ['CHM-GAS-02', '28', '30', '50', '미달', '발주필요'],
];
const tone = (s: string): Tone => (s === '미달' ? 'err' : s === '발주점' ? 'warn' : 'ok');
const rows = raw.map((r) => [
  r[0], r[1], r[2], r[3],
  <Pill key="p" tone={tone(r[4])} solid={r[4] === '미달'}>{r[4]}</Pill>,
  r[5] === '—' ? <span key="a" className="text-ink3">—</span>
    : <span key="a" className="rounded-md px-2.5 py-[3px] text-[10px] font-bold" style={{ color: C.blue, border: `1px solid ${C.blue}55` }}>{r[5]}</span>,
]);

/** 안전재고·발주 현황 — 와이어프레임 report-mat.jsx 정본. */
export default function ReportSafetyOrderScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="안전재고·발주 현황" sub="자재·재고 리포트 / 안전재고 미달·발주 현황" type="R3" />
      <RParam period="실시간"><FField label="창고"><FSel /></FField><FField label="상태"><FSel /></FField></RParam>
      <MKpis items={[['관리 품목', '186', '종'], ['안전재고 미달', '2', '종'], ['발주점 도달', '2', '종', 'teal'], ['발주 필요', '4', '건']]} />
      <Card title="안전재고 대비 현재고 · 발주 대상" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">현재고 ≤ 발주점 시 발주 필요</span>}>
        <RTable cols={cols} rows={rows} highlightCol={1} />
      </Card>
    </div>
  );
}
