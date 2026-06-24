import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';

type Row = [no: string, sale: string, cust: string, type: string, amt: number, date: string, status: string, nts: string];
const ROWS: Row[] = [
  ['TI-2606-072', 'SL-2606-098', '대륭산업', '전자세금계산서', 14025000, '2026-06-23', '발행완료', '국세청 전송'],
  ['TI-2606-071', 'SL-2606-097', '동진정밀', '전자세금계산서', 2112000, '2026-06-23', '발행완료', '국세청 전송'],
  ['TI-2606-070', 'SL-2606-096', '세진테크', '거래명세서', 17424000, '2026-06-22', '발행완료', '—'],
  ['TI-2606-069', 'SL-2606-095', '한빛전자', '전자세금계산서', 52272000, '2026-06-21', '발행대기', '—'],
];
const tone = (s: string): Tone => (s === '발행완료' ? 'ok' : 'warn');

/** 세금계산서/거래명세서 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesTaxInvoiceScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="세금계산서/거래명세서" sub="출하 및 매출 관리 / 증빙 발행 (Tax Invoice)" actions={<ActionBar actions={['save', 'download']} />} />
      <FBar>
        <FField label="발행일자"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="증빙종류"><FSel /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="전자세금계산서 발행" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 발행', '72', '건'], ['전자세금계산서', '58', '건', 'teal'], ['거래명세서', '14', '건'], ['발행 대기', '1', '건']]} />
      <Card title="매출 증빙 발행 내역" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">매출 전표 기반 발행 · 국세청 연동</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['증빙번호', '매출번호', '거래처', '종류', '합계금액', '발행일', '발행상태', '국세청'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i >= 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={td('left')}><Pill tone={r[3] === '거래명세서' ? 'mute' : 'info'}>{r[3]}</Pill></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r[4])}</td>
                <td className={`${td('center')} tabular-nums`}>{r[5]}</td>
                <td className={td('center')}><Pill tone={tone(r[6])}>{r[6]}</Pill></td>
                <td className={`${td('center')} text-[10.5px]`} style={{ color: r[7] === '—' ? C.ink3 : C.teal, fontWeight: r[7] === '—' ? 400 : 700 }}>{r[7] === '국세청 전송' ? '✓ 전송' : r[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
