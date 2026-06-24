import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';

type Row = [cust: string, limit: number, d30: number, d60: number, over: number, status: string];
const ROWS: Row[] = [
  ['한빛전자', 124500000, 52272000, 0, 0, '정상'],
  ['대륭산업', 38000000, 0, 14025000, 0, '정상'],
  ['세진테크', 62000000, 17424000, 0, 8200000, '연체'],
  ['동진정밀', 15000000, 0, 0, 4400000, '연체'],
  ['한솔머트리얼', 28000000, 9800000, 0, 0, '정상'],
];
const tone = (s: string): Tone => (s === '연체' ? 'err' : 'ok');

/** 채권/미수금 현황 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesArScreen() {
  const totalAR = ROWS.reduce((s, r) => s + r[2] + r[3] + r[4], 0);
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="채권/미수금 현황" sub="수금 및 채권 관리 / 미수금·연체 (Accounts Receivable)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="기준일"><FSel value="2026-06-23" w={130} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="연체여부"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['총 미수금', (totalAR / 1e8).toFixed(2), '억원'], ['정상 채권', '85.9', '백만', 'teal'], ['연체 채권', '12.6', '백만'], ['연체 거래처', '2', '사']]} />
      <Card title="거래처별 채권 잔액 · 연체 (Aging)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">여신한도 대비 잔액 · 연체 30일+ 강조</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['거래처', '여신한도', '0~30일', '31~60일', '연체(60일+)', '상태'].map((c, i) => <th key={c} className={th(i >= 1 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => {
              const overdue = r[4] > 0;
              return (
                <tr key={i} style={{ background: overdue ? '#fdecea' : i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`} style={{ borderLeft: overdue ? `3px solid ${C.err}` : '3px solid transparent' }}>{r[0]}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{won(r[1])}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[2] ? won(r[2]) : '—'}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r[3] ? won(r[3]) : '—'}</td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: overdue ? C.err : C.ink3, fontWeight: overdue ? 800 : 400 }}>{r[4] ? won(r[4]) : '—'}</td>
                  <td className={td('center')}><Pill tone={tone(r[5])} solid={overdue}>{r[5]}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
