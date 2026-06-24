import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';

type Row = [no: string, cust: string, date: string, method: string, amt: number, doc: string, match: string];
const ROWS: Row[] = [
  ['RC-2606-055', '대륭산업', '2026-06-23', '계좌이체', 14025000, 'TI-2606-072', '소진'],
  ['RC-2606-054', '세진테크', '2026-06-22', '어음', 17424000, 'TI-2606-068', '소진'],
  ['RC-2606-053', '한빛전자', '2026-06-20', '계좌이체', 30000000, '선입금', '미소진'],
  ['RC-2606-051', '동진정밀', '2026-06-18', '카드', 2112000, 'TI-2606-065', '소진'],
];

/** 수금 입력 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesCollectionScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="수금 입력" sub="수금 및 채권 관리 / 입금 등록 (Collection)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="수금일자"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="수금방법"><FSel /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="plus" label="미수금 매칭" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 수금액', '6.4', '억원', 'teal'], ['수금 건수', '55', '건'], ['미매칭 입금', '1', '건'], ['선수금 잔액', '3,000', '만원']]} />
      <Card title="입금 등록 · 채권 매칭" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">입금 → 세금계산서(채권) 매칭</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['수금번호', '거래처', '수금일', '수금방법', '수금액', '매칭 증빙', '매칭'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[1]}</td>
                <td className={`${td('left')} tabular-nums`}>{r[2]}</td>
                <td className={td('left')}><Pill tone="mute">{r[3]}</Pill></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r[4])}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r[5]}</td>
                <td className={td('center')}><Pill tone={r[6] === '소진' ? 'ok' : 'warn'}>{r[6]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
