import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td } from '../_sales';
import { nextStatus, nextActionLabel } from '@/domain/shipment/status';
import { useShipments, useAdvanceShipment, useCompleteShipment } from '@/features/shipment/useShipments';

const tone = (s: string): Tone => (s === '출고완료' ? 'ok' : s === '피킹중' ? 'warn' : 'info');
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 출하/출고 입력 — 데이터: features/shipment. 출고완료 시 수주 납품·재고 차감 연동. */
export default function SalesShipmentScreen() {
  const [sel, setSel] = useState<string>();
  const { data: rows = [] } = useShipments();
  const advanceShip = useAdvanceShipment();
  const completeShip = useCompleteShipment();

  const selected = rows.find((r) => r.no === sel);
  const advance = selected ? nextStatus(selected.status) : null;
  const advanceLabel = selected ? nextActionLabel(selected.status) : null;

  const done = rows.filter((r) => r.status === '출고완료').length;
  const waiting = rows.filter((r) => r.status !== '출고완료').length;
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  const handleAdvance = () => {
    if (!selected || !advance) return;
    if (advance === '출고완료') completeShip.mutate({ no: selected.no, at: stamp() });
    else advanceShip.mutate({ no: selected.no, to: advance });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="출하/출고 입력" sub="출하 및 매출 관리 / 출하 등록 (Shipment)" actions={<ActionBar actions={['add', 'download']} />} />
      <FBar>
        <FField label="출고일자"><FSel value="2026-06-23" w={130} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="창고"><FSel value="완제품 창고" /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="거래명세서" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['출하지시', String(rows.length), '건'], ['출고 완료', String(done), '건', 'teal'], ['출고 대기/진행', String(waiting), '건'], ['출하 수량', totalQty.toLocaleString('ko-KR'), 'EA']]} />
      <Card
        title="출하 지시 · 출고 처리"
        bodyClassName="p-0"
        action={
          selected && advance ? (
            <ActionButton icon="save" label={`${selected.no} · ${advanceLabel}`} variant="primary" onClick={handleAdvance} />
          ) : (
            <span className="text-[10.5px] text-ink3">행 선택 → 피킹/출고 처리 · 출고완료 시 수주·재고 자동 반영</span>
          )
        }
      >
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['출하번호', '수주번호', '거래처', '품목', '수량', '위치', '상태'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i === 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const on = r.no === sel;
              return (
                <tr key={r.no} onClick={() => setSel(r.no)} style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: on ? C.teal : C.ink, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                  <td className={`${td('left')} font-mono text-[10.5px]`}>{r.salesOrder}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r.customer}</td>
                  <td className={`${td('left')} font-mono text-[11px]`}>{r.item}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r.qty}</td>
                  <td className={`${td('left')} font-mono text-[10.5px]`}>{r.location}</td>
                  <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
