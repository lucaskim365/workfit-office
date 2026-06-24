import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td, won } from '../_sales';
import { orderTotals } from '@/domain/salesOrder/schema';
import { useSalesOrders } from '@/features/salesOrder/useSalesOrders';

/** 수주/주문서 입력 — 데이터: features/salesOrder (header-line). */
export default function SalesOrderScreen() {
  const { data: orders = [] } = useSalesOrders();
  const cur = orders[0];
  const lines = cur?.lines ?? [];
  const total = cur ? orderTotals(cur).amount : 0;
  const header: [string, string][] = cur
    ? [
        ['수주번호', cur.no], ['거래처', cur.customer], ['수주일자', cur.orderDate],
        ['납품 요청일', cur.reqDeliveryDate], ['결제 조건', cur.paymentTerms], ['영업 담당', cur.salesperson],
      ]
    : [];

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="수주/주문서 입력" sub="영업수주 관리 / 수주 등록 (Sales Order)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.7fr]">
        <Card title="주문 헤더">
          <div className="flex flex-col gap-3">
            {header.map(([k, v], i) => (
              <div key={k} className="flex flex-col gap-1">
                <span className="text-[10.5px] font-bold text-ink3">{k}</span>
                <div className="flex h-[34px] items-center rounded-lg border border-border-hi px-3 text-[12px] text-ink" style={{ background: i === 0 ? C.panelAlt : '#fff', fontWeight: i === 0 ? 700 : 500, fontFamily: i === 0 ? 'ui-monospace, monospace' : 'inherit' }}>{v}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="주문 품목 (Line Items)" bodyClassName="p-0" action={<ActionButton icon="plus" label="품목 추가" />}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['품목', '품명', '수량', '단가', '납기일', '금액'].map((c, i) => <th key={c} className={th(i >= 2 && i !== 4 ? 'right' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.code + i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{l.code}</td>
                  <td className={td('left')}>{l.name}</td>
                  <td className={`${td('right')} tabular-nums`}>{l.qty}</td>
                  <td className={`${td('right')} tabular-nums`}>{won(l.price)}</td>
                  <td className={`${td('left')} tabular-nums`}>{l.due}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(l.qty * l.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.navy }}>
                <td colSpan={5} className="px-3 py-2.5 text-[11.5px] font-bold" style={{ color: '#dfe6f2' }}>공급가액 합계 (VAT 별도)</td>
                <td className="px-3 py-2.5 text-right text-[13px] font-extrabold tabular-nums text-white">{won(total)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3"><ActionButton icon="save" label="임시 저장" /><ActionButton icon="save" label="수주 확정" variant="primary" /></div>
        </Card>
      </div>
    </div>
  );
}
