import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td } from '../_sales';

type Row = [do_: string, so: string, cust: string, code: string, qty: number, loc: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['DO-2606-120', 'SO-2606-082', '대륭산업', 'PKG-BGA-14', 30, 'A-01', '출고완료', true],
  ['DO-2606-121', 'SO-2606-071', '동진정밀', 'CMP-CON-14', 150, 'B-04', '출고완료', true],
  ['DO-2606-122', 'SO-2606-088', '한빛전자', 'MX-200', 12, 'A-02', '피킹중'],
  ['DO-2606-123', 'SO-2606-088', '한빛전자', 'PKG-BGA-14', 5, 'A-01', '출고대기'],
];
const tone = (s: string): Tone => (s === '출고완료' ? 'ok' : s === '피킹중' ? 'warn' : 'info');

/** 출하/출고 입력 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesShipmentScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="출하/출고 입력" sub="출하 및 매출 관리 / 출하 등록 (Shipment)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="출고일자"><FSel value="2026-06-23" w={130} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="창고"><FSel value="완제품 창고" /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="거래명세서" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금일 출하지시', '8', '건'], ['출고 완료', '5', '건', 'teal'], ['출고 대기', '3', '건'], ['출하 수량', '197', 'EA']]} />
      <Card title="출하 지시 · 출고 처리" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">수주 → 출하지시 → 출고 → 매출</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['출하번호', '수주번호', '거래처', '품목', '수량', '위치', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[7] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[7] ? C.teal : C.ink, borderLeft: r[7] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[3]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[4]}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[5]}</td>
                <td className={td('center')}><Pill tone={tone(r[6])}>{r[6]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
