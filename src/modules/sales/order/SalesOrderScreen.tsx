import { Card } from '@/shared/ui/Card';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, th, td, won } from '../_sales';

type Line = [code: string, name: string, qty: number, price: string, due: string, amt: number];
const LINES: Line[] = [
  ['MX-200', '메모리 모듈', 12, '3,960,000', '2026-07-05', 47520000],
  ['CMP-CON-14', '보드 커넥터', 200, '12,800', '2026-07-05', 2560000],
  ['PKG-BGA-14', 'BGA 기판', 5, '4,250,000', '2026-07-12', 21250000],
];
const HEADER: [string, string][] = [
  ['수주번호', 'SO-2606-088'], ['거래처', '한빛전자'], ['수주일자', '2026-06-23'],
  ['납품 요청일', '2026-07-05'], ['결제 조건', '월말 마감 / 익월 30일'], ['영업 담당', '김영업'],
];

/** 수주/주문서 입력 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesOrderScreen() {
  const total = LINES.reduce((s, l) => s + l[5], 0);
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="수주/주문서 입력" sub="영업수주 관리 / 수주 등록 (Sales Order)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.7fr]">
        <Card title="주문 헤더">
          <div className="flex flex-col gap-3">
            {HEADER.map(([k, v], i) => (
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
              {LINES.map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r[0]}</td>
                  <td className={td('left')}>{r[1]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[2]}</td>
                  <td className={`${td('right')} tabular-nums`}>{won(Number(r[3].replace(/,/g, '')))}</td>
                  <td className={`${td('left')} tabular-nums`}>{r[4]}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r[5])}</td>
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
