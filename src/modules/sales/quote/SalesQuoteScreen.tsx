import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, FInput, th, td, won } from '../_sales';
import { useQuotes } from '@/features/quote/useQuotes';

const stTone = (s: string): Tone => (s === '수주전환' ? 'ok' : s === '실주' ? 'err' : s === '검토중' ? 'warn' : 'mute');

/** 견적서 입력/관리 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesQuoteScreen() {
  const { data: rows = [], isLoading } = useQuotes();
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
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '견적 내역이 없습니다.'}</td></tr>
            ) : rows.map((r, i) => {
              const on = r.progress === '수주전환';
              return (
                <tr key={r.no} style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold`} style={{ color: on ? C.teal : C.ink, borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>{r.no}</td>
                  <td className={`${td('left')} font-bold text-ink`}>{r.cust}</td>
                  <td className={td('left')}>{r.item}</td>
                  <td className={`${td('right')} tabular-nums`}>{r.qty}</td>
                  <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(Number(r.amt.replace(/,/g, '')))}</td>
                  <td className={td('center')}><Pill tone={r.sent === '발송' ? 'info' : 'mute'}>{r.sent}</Pill></td>
                  <td className={td('center')}>{r.progress === '—' ? <span className="text-ink3">—</span> : <Pill tone={stTone(r.progress)}>{r.progress}</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
