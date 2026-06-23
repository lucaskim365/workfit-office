import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [code: string, name: string, wh: string, stock: string, safe: string, status: string];
const ROWS: Row[] = [
  ['WF-300-B', '300mm 웨이퍼', 'A-Zone', '8,420', '5,000', '정상'],
  ['WF-200-A', '200mm 웨이퍼', 'A-Zone', '3,100', '4,000', '부족'],
  ['CHM-SL-05', '슬러리 SL-05', 'A-Zone', '142', '100', '정상'],
  ['RES-PR-22', '포토레지스트', 'A-Zone', '38', '60', '부족'],
  ['PKG-BGA-14', 'BGA 기판', 'C-Zone', '5,200', '2,000', '과다'],
];
const tone = (s: string): Tone => (s === '정상' ? 'ok' : s === '부족' ? 'err' : 'warn');

/** 실시간 재고 조회 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatStockScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="실시간 재고 조회" sub="실시간 재고 조회 (Stock Status)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <MKpis items={[['총 품목', '248', '종'], ['안전재고 미만', '12', '종', 'err'], ['총 재고가', '14.2', '억'], ['재고회전율', '8.4', '회']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="품목·Lot별 현재고" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">안전재고 대비 실시간</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['품목', '품목명', '창고', '현재고', '안전재고', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r[1]}</td>
                  <td className={td('left')}>{r[2]}</td>
                  <td className={`${td('right')} font-bold tabular-nums`} style={{ color: r[5] === '부족' ? C.err : C.ink }}>{r[3]}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{r[4]}</td>
                  <td className={td('center')}><Pill tone={tone(r[5])} solid={r[5] === '부족'}>{r[5]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="재고 상태 분포">
          <div className="mb-2 flex justify-center">
            <Donut data={[{ name: '정상', v: 224, c: C.teal }, { name: '부족', v: 12, c: C.err }, { name: '과다', v: 12, c: C.warn }]} size={140} centerTop="248" centerSub="총 품목" />
          </div>
          <div className="flex flex-col gap-2">
            {([['정상', 224, C.teal], ['안전재고 미만', 12, C.err], ['과다 재고', 12, C.warn]] as const).map(([l, n, c]) => (
              <div key={l} className="flex items-center gap-2 text-[11px]">
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: c }} />
                <span className="flex-1 font-semibold text-ink2">{l}</span>
                <b className="text-ink">{n}종</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
