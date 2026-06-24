import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, Bar, th, td } from '../_sales';

type Row = [no: string, cust: string, due: string, ordered: number, delivered: number, pending: number, status: string];
const ROWS: Row[] = [
  ['SO-2606-088', '한빛전자', '2026-07-05', 217, 0, 217, '미납'],
  ['SO-2606-082', '대륭산업', '2026-06-30', 50, 30, 20, '부분납품'],
  ['SO-2606-077', '세진테크', '2026-06-28', 80, 80, 0, '완납'],
  ['SO-2606-071', '동진정밀', '2026-06-25', 500, 350, 150, '부분납품'],
  ['SO-2606-064', '한빛전자', '2026-06-20', 120, 120, 0, '완납'],
];
const tone = (s: string): Tone => (s === '완납' ? 'ok' : s === '부분납품' ? 'warn' : 'info');

/** 주문서 현황 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesOrderStatusScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="주문서 현황" sub="영업수주 관리 / 주문 현황·미납 집계" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="기간"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="납품상태"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['총 수주', '64', '건'], ['완납', '38', '건', 'teal'], ['부분/미납', '26', '건'], ['미납 수량', '387', 'EA']]} />
      <Card title="거래처별 주문·납품 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">수주량 = 납품량 + 미납량</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['수주번호', '거래처', '납기일', '수주량', '납품량', '미납량', '진척', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 5 ? 'right' : i === 7 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => {
              const pct = Math.round((r[4] / r[3]) * 100);
              return (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r[1]}</td>
                  <td className={`${td('left')} tabular-nums`}>{r[2]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[3]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[4]}</td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: r[5] ? C.warn : C.ink3, fontWeight: r[5] ? 700 : 500 }}>{r[5]}</td>
                  <td className={td('left')}><div className="w-[120px]"><Bar v={pct} color={pct === 100 ? C.ok : C.teal} /></div></td>
                  <td className={td('center')}><Pill tone={tone(r[6])}>{r[6]}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
