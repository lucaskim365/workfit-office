import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useDeliveryOrders } from '@/features/deliveryOrder/useDeliveryOrders';

const tone = (s: string): Tone => (s === '출하완료' ? 'ok' : s === '상차중' ? 'info' : 'mute');

/** 완제품 출하 관리 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatShippingScreen() {
  const { data: rows = [], isLoading } = useDeliveryOrders();

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="완제품 출하 관리" sub="완제품 출하 관리 (Shipping)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['금일 출하 DO', '12', '건'], ['출하완료', '8', '건', 'teal'], ['출하 수량', '7,700', 'EA'], ['출하 대기', '3', '건']]} />
      <Card title="고객 주문(DO) 기준 출하 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">상차·Shipment 등록</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['출하지시(DO)', '주문번호', '고객사', '품목', '수량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.no} style={{ background: r.urgent ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r.urgent ? C.teal : C.ink, borderLeft: r.urgent ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r.so}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r.cust}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r.code}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '출하지시가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
