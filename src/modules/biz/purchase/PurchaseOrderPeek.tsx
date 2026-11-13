import type { ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { bizTd, bizTh } from '../_biz';
import { vatOf, type PurchasePayment } from './purchaseMock';

const won = (n: number) => n.toLocaleString('ko-KR');
const num = `${bizTd} text-right tabular-nums`;

/** 발주 내역을 누르면 뜨는 창 — 실제 화면에서는 발주서 문서를 읽기 전용으로 연다. siblings: 같은 발주의 지급 줄 모두 */
export function PurchaseOrderPeek({ row, siblings, onClose }: { row: PurchasePayment; siblings: PurchasePayment[]; onClose: () => void }) {
  const supply = siblings.reduce((a, r) => a + r.supply, 0);
  return (
    <Modal open onClose={onClose} title={`발주서 · ${row.poDocNo}`} width={640}>
      <div className="flex flex-col gap-4 text-[12px] text-ink2">
        <p className="rounded-lg bg-panel-alt px-3 py-2 text-[11px] text-ink3">실제 화면에서는 이 자리에 결재가 끝난 발주서 문서가 읽기 전용으로 열립니다.</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Info label="사업구분">{row.bizType}</Info>
          <Info label="도입기업">{row.client}</Info>
          <Info label="발주처">{row.vendor}</Info>
          <Info label="공급가액 / 부가세">{won(supply)} / {won(vatOf(supply))}원</Info>
        </dl>
        <div>
          <h3 className="mb-1.5 text-[11px] font-bold text-ink3">발주 품목</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-ink">
            {row.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-[11px] font-bold text-ink3">지급 조건</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={bizTh}>구분</th>
                <th className={`${bizTh} text-right`}>비율</th>
                <th className={bizTh}>(예정) 계산서 발행일</th>
                <th className={bizTh}>(예정) 결제일</th>
                <th className={`${bizTh} text-right`}>공급가액</th>
              </tr>
            </thead>
            <tbody>
              {siblings.map((r) => (
                <tr key={r.id} className={r.id === row.id ? 'bg-teal/5' : undefined}>
                  <td className={`${bizTd} font-semibold text-ink`}>{r.term}</td>
                  <td className={num}>{r.rate}%</td>
                  <td className={bizTd}>{r.planTaxDate}</td>
                  <td className={bizTd}>{r.planPayDate}</td>
                  <td className={num}>{won(r.supply)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-bold text-ink3">{label}</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}
