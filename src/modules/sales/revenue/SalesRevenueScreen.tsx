import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';

type Row = [no: string, do_: string, cust: string, date: string, supply: number, vat: number, total: number, status: string];
const ROWS: Row[] = [
  ['SL-2606-098', 'DO-2606-120', '대륭산업', '2026-06-23', 12750000, 1275000, 14025000, '확정'],
  ['SL-2606-097', 'DO-2606-121', '동진정밀', '2026-06-23', 1920000, 192000, 2112000, '확정'],
  ['SL-2606-096', 'DO-2606-118', '세진테크', '2026-06-22', 15840000, 1584000, 17424000, '확정'],
  ['SL-2606-095', 'DO-2606-115', '한빛전자', '2026-06-21', 47520000, 4752000, 52272000, '전표대기'],
];
const tone = (s: string): Tone => (s === '확정' ? 'ok' : 'warn');

/** 매출 입력 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesRevenueScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="매출 입력" sub="출하 및 매출 관리 / 매출 전표 생성 (Billing)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="매출일자"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="상태"><FSel /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="plus" label="출고내역 불러오기" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 매출(공급가)', '7.8', '억원', 'teal'], ['부가세', '7,803', '만원'], ['매출 합계', '8.6', '억원'], ['전표 대기', '1', '건']]} />
      <Card title="출고 기반 매출 전표" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">공급가액 + 부가세(10%) = 합계</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['매출번호', '출하번호', '거래처', '매출일', '공급가액', '부가세', '합계', '상태'].map((c, i) => <th key={c} className={th(i >= 4 && i <= 6 ? 'right' : i === 7 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={`${td('left')} tabular-nums`}>{r[3]}</td>
                <td className={`${td('right')} tabular-nums`}>{won(r[4])}</td>
                <td className={`${td('right')} tabular-nums text-ink3`}>{won(r[5])}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r[6])}</td>
                <td className={td('center')}><Pill tone={tone(r[7])}>{r[7]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
