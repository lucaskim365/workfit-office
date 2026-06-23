import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, th, td } from '../_mat';

type Row = [do_: string, so: string, cust: string, code: string, qty: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['DO-260611-08', 'SO-26-1102', '삼성전자', 'WF-300-B', '2,000', '상차중', true],
  ['DO-260611-07', 'SO-26-1099', 'SK하이닉스', 'PKG-BGA-14', '1,500', '출하완료'],
  ['DO-260611-05', 'SO-26-1095', 'LG이노텍', 'MOD-CAM-02', '1,200', '출하완료'],
  ['DO-260611-09', 'SO-26-1105', '삼성전자', 'WF-200-A', '3,000', '출하대기'],
];
const tone = (s: string): Tone => (s === '출하완료' ? 'ok' : s === '상차중' ? 'info' : 'mute');

/** 완제품 출하 관리 — 와이어프레임 wms-screens-2.jsx 정본. */
export default function MatShippingScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="완제품 출하 관리" sub="완제품 출하 관리 (Shipping)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <MKpis items={[['금일 출하 DO', '12', '건'], ['출하완료', '8', '건', 'teal'], ['출하 수량', '7,700', 'EA'], ['출하 대기', '3', '건']]} />
      <Card title="고객 주문(DO) 기준 출하 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">상차·Shipment 등록</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['출하지시(DO)', '주문번호', '고객사', '품목', '수량', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[6] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[6] ? C.teal : C.ink, borderLeft: r[6] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[1]}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r[2]}</td>
                <td className={`${td('left')} font-mono text-[11px]`}>{r[3]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[4]}</td>
                <td className={td('center')}><Pill tone={tone(r[5])}>{r[5]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
