import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td } from '../_mat';

type Row = [po: string, code: string, name: string, vendor: string, poQty: string, recvQty: string, status: string, sel?: boolean];
const ROWS: Row[] = [
  ['PO-260610-12', 'WF-300-B', '300mm 웨이퍼', '대성반도체', '2,500', '2,500', '입고완료', true],
  ['PO-260610-15', 'CHM-SL-05', '슬러리 SL-05', 'JS머트리얼', '60', '60', '입고완료'],
  ['PO-260611-02', 'RES-PR-22', '포토레지스트', '한울케미칼', '40', '38', '부분입고'],
  ['PO-260611-05', 'PKG-BGA-14', 'BGA 기판', '동진정밀', '3,000', '0', '입고대기'],
];
const tone = (s: string): Tone => (s === '입고완료' ? 'ok' : s === '부분입고' ? 'warn' : 'mute');

/** 구매 입고 등록 — 와이어프레임 wms-screens.jsx 정본. */
export default function MatReceiptScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="구매 입고 등록" sub="구매 입고 등록 (Purchase Receipt)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="입고일자"><FSel value="2026-06-11" w={130} /></FField>
        <FField label="협력사"><FSel /></FField>
        <FField label="상태"><FSel /></FField>
        <FField label="검색"><FInput ph="PO번호 / 품목" w={180} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="ERP PO 조회" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['입고 예정 PO', '12', '건'], ['입고완료', '8', '건', 'teal'], ['입고 수량', '4,598', 'EA'], ['미입고', '4', '건']]} />
      <Card title="구매 발주(PO) 대비 입고 현황" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">ERP PO 항목 대조</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['PO번호', '품목', '협력사', 'PO수량', '입고수량', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i} style={{ background: r[7] ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: r[7] ? C.teal : C.ink, borderLeft: r[7] ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                <td className={`${td('left')} font-semibold text-ink`}><span className="font-mono text-[11px]">{r[1]}</span> <span className="text-[10.5px] text-ink3">{r[2]}</span></td>
                <td className={td('left')}>{r[3]}</td>
                <td className={`${td('right')} tabular-nums`}>{r[4]}</td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{r[5]}</td>
                <td className={td('center')}><Pill tone={tone(r[6])}>{r[6]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
