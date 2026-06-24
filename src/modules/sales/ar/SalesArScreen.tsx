import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';
import { useAccountsReceivable } from '@/features/accountsReceivable/useAccountsReceivable';

const tone = (s: string): Tone => (s === '연체' ? 'err' : 'ok');

/** 채권/미수금 현황 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesArScreen() {
  const { data: rows = [], isLoading } = useAccountsReceivable();
  if (isLoading) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">불러오는 중…</div>;
  }
  const totalAR = rows.reduce((s, r) => s + r.d30 + r.d60 + r.over, 0);
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
            {rows.map((r, i) => {
              const overdue = r.over > 0;
              return (
                <tr key={r.cust} style={{ background: overdue ? '#fdecea' : i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-bold text-ink`} style={{ borderLeft: overdue ? `3px solid ${C.err}` : '3px solid transparent' }}>{r.cust}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{won(r.limit)}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r.d30 ? won(r.d30) : '—'}</td>
                  <td className={`${td('right')} tabular-nums text-ink2`}>{r.d60 ? won(r.d60) : '—'}</td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: overdue ? C.err : C.ink3, fontWeight: overdue ? 800 : 400 }}>{r.over ? won(r.over) : '—'}</td>
                  <td className={td('center')}><Pill tone={tone(r.status)} solid={overdue}>{r.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
