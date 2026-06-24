import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td } from '../_mat';
import { receiptStatus } from '@/domain/receipt/schema';
import { useReceipts, useReceive } from '@/features/receipt/useReceipts';

const tone = (s: string): Tone => (s === '입고완료' ? 'ok' : s === '부분입고' ? 'warn' : 'mute');
const fmt = (n: number) => n.toLocaleString('ko-KR');
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 구매 입고 등록 — 데이터: features/receipt. 입고 처리 시 재고 입고 원장 반영. */
export default function MatReceiptScreen() {
  const [sel, setSel] = useState<string>();
  const { data: rows = [] } = useReceipts();
  const receive = useReceive();

  const selected = rows.find((r) => r.po === sel);
  const canReceive = !!selected && receiptStatus(selected) !== '입고완료';
  const done = rows.filter((r) => receiptStatus(r) === '입고완료').length;
  const pending = rows.filter((r) => receiptStatus(r) !== '입고완료').length;
  const totalRecv = rows.reduce((s, r) => s + r.recvQty, 0);

  const handleReceive = () => {
    if (canReceive && selected) receive.mutate({ po: selected.po, at: stamp() });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="구매 입고 등록" sub="구매 입고 등록 (Purchase Receipt)" actions={<ActionBar actions={['add', 'download']} />} />
      <FBar>
        <FField label="입고일자"><FSel value="2026-06-11" w={130} /></FField>
        <FField label="협력사"><FSel /></FField>
        <FField label="상태"><FSel /></FField>
        <FField label="검색"><FInput ph="PO번호 / 품목" w={180} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="ERP PO 조회" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['입고 예정 PO', String(rows.length), '건'], ['입고완료', String(done), '건', 'teal'], ['입고 수량', fmt(totalRecv), 'EA'], ['미입고/부분', String(pending), '건']]} />
      <Card
        title="구매 발주(PO) 대비 입고 현황"
        bodyClassName="p-0"
        action={
          canReceive ? (
            <ActionButton icon="save" label={`${selected!.po} · 입고 처리`} variant="primary" onClick={handleReceive} />
          ) : (
            <span className="text-[10.5px] text-ink3">행 선택 → 입고 처리 · 입고 시 재고 자동 반영</span>
          )
        }
      >
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['PO번호', '품목', '협력사', 'PO수량', '입고수량', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const on = r.po === sel;
              const st = receiptStatus(r);
              return (
                <tr key={r.po} onClick={() => setSel(r.po)} style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: on ? C.teal : C.ink, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.po}</td>
                  <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r.item}</span> <span className="text-[10.5px] text-ink3">{r.itemName}</span></td>
                  <td className={td('left')}>{r.vendor}</td>
                  <td className={`${td('right')} tabular-nums`}>{fmt(r.poQty)}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{fmt(r.recvQty)}</td>
                  <td className={td('center')}><Pill tone={tone(st)}>{st}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
