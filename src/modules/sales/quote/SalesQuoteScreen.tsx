import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td, won } from '../_sales';

type Row = [no: string, cust: string, item: string, qty: number, amt: string, sent: string, progress: string];
const ROWS: Row[] = [
  ['QT-2606-041', '한빛전자', 'MX-200 외 2종', 12, '48,600,000', '발송', '검토중'],
  ['QT-2606-040', '대륭산업', 'PKG-BGA-14', 5, '21,250,000', '발송', '수주전환'],
  ['QT-2606-038', '세진테크', 'MX-310', 8, '15,840,000', '작성중', '—'],
  ['QT-2606-035', '한빛전자', 'MX-200', 20, '79,200,000', '발송', '실주'],
  ['QT-2606-031', '동진정밀', 'CMP-CON-14 외', 50, '6,400,000', '발송', '수주전환'],
];
const stTone = (s: string): Tone => (s === '수주전환' ? 'ok' : s === '실주' ? 'err' : s === '검토중' ? 'warn' : 'mute');

/** 견적서 입력/관리 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesQuoteScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="견적서 입력/관리" sub="영업수주 관리 / 견적서 입력·발송 (Quotation)" actions={<ActionBar actions={['add', 'save', 'download']} />} />
      <FBar>
        <FField label="견적일자"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="상태"><FSel /></FField>
        <FField label="검색"><FInput ph="견적번호 / 품목" w={170} /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="견적서 발송" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 견적', '24', '건'], ['수주 전환', '9', '건', 'teal'], ['전환율', '37.5', '%'], ['견적 금액', '4.8', '억원']]} />
      <Card title="견적 내역" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">견적 → 수주 전환 추적</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['견적번호', '거래처', '품목', '수량', '견적금액', '발송', '진행'].map((c, i) => <th key={c} className={th(i === 3 || i === 4 ? 'right' : i >= 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r, i) => {
              const on = r[6] === '수주전환';
              return (
                <tr key={i} style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: on ? C.teal : C.ink, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r[0]}</td>
                  <td className={`${td('left')} font-bold text-ink`}>{r[1]}</td>
                  <td className={td('left')}>{r[2]}</td>
                  <td className={`${td('right')} tabular-nums`}>{r[3]}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(Number(r[4].replace(/,/g, '')))}</td>
                  <td className={td('center')}><Pill tone={r[5] === '발송' ? 'info' : 'mute'}>{r[5]}</Pill></td>
                  <td className={td('center')}>{r[6] === '—' ? <span className="text-ink3">—</span> : <Pill tone={stTone(r[6])}>{r[6]}</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
