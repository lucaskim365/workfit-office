import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, Bar, th, td } from '../_sales';
import { orderTotals, deliveryStatus } from '@/domain/salesOrder/schema';
import { useSalesOrders } from '@/features/salesOrder/useSalesOrders';

const tone = (s: string): Tone => (s === '완납' ? 'ok' : s === '부분납품' ? 'warn' : 'info');

/** 주문서 현황 — 데이터: features/salesOrder (라인 집계로 납품상태 도출). */
export default function SalesOrderStatusScreen() {
  const { data: orders = [] } = useSalesOrders();
  const rows = orders.map((o) => ({ o, t: orderTotals(o), status: deliveryStatus(o) }));
  const filled = rows.filter((r) => r.status === '완납').length;
  const partialOrUnshipped = rows.filter((r) => r.status !== '완납').length;
  const pendingQty = rows.reduce((s, r) => s + r.t.pending, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="주문서 현황" sub="영업수주 관리 / 주문 현황·미납 집계 (라인 도출)" actions={<ActionBar actions={['refresh', 'download']} />} />
      <FBar>
        <FField label="기간"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="납품상태"><FSel /></FField>
        <span className="ml-auto"><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['총 수주', String(orders.length), '건'], ['완납', String(filled), '건', 'teal'], ['부분/미납', String(partialOrUnshipped), '건'], ['미납 수량', pendingQty.toLocaleString('ko-KR'), 'EA']]} />
      <Card title="거래처별 주문·납품 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">수주량 = 납품량 + 미납량</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['수주번호', '거래처', '납기일', '수주량', '납품량', '미납량', '진척', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 5 ? 'right' : i === 7 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[11.5px] text-ink3">수주 데이터가 없습니다.</td></tr>
            )}
            {rows.map(({ o, t, status }, i) => {
              const pct = t.ordered ? Math.round((t.delivered / t.ordered) * 100) : 0;
              return (
                <tr key={o.no} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{o.no}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{o.customer}</td>
                  <td className={`${td('left')} tabular-nums`}>{o.reqDeliveryDate}</td>
                  <td className={`${td('right')} tabular-nums`}>{t.ordered.toLocaleString('ko-KR')}</td>
                  <td className={`${td('right')} tabular-nums`}>{t.delivered.toLocaleString('ko-KR')}</td>
                  <td className={`${td('right')} tabular-nums`} style={{ color: t.pending ? C.warn : C.ink3, fontWeight: t.pending ? 700 : 500 }}>{t.pending.toLocaleString('ko-KR')}</td>
                  <td className={td('left')}><div className="w-[120px]"><Bar v={pct} color={pct === 100 ? C.ok : C.teal} /></div></td>
                  <td className={td('center')}><Pill tone={tone(status)}>{status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
