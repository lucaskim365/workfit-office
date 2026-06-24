import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { C, MHead, MKpis, FBar, FField, FSel, th, td, won } from '../_sales';
import { useTaxInvoices } from '@/features/taxInvoice/useTaxInvoices';

const tone = (s: string): Tone => (s === '발행완료' ? 'ok' : 'warn');

/** 세금계산서/거래명세서 — 와이어프레임 sales-screens.jsx 정본. */
export default function SalesTaxInvoiceScreen() {
  const { data: rows = [], isLoading } = useTaxInvoices();
  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="세금계산서/거래명세서" sub="출하 및 매출 관리 / 증빙 발행 (Tax Invoice)" actions={<ActionBar actions={['save', 'download']} />} />
      <FBar>
        <FField label="발행일자"><FSel value="2026-06" w={120} /></FField>
        <FField label="거래처"><FSel /></FField>
        <FField label="증빙종류"><FSel /></FField>
        <span className="ml-auto flex gap-2"><ActionButton icon="download" label="전자세금계산서 발행" accent="excel" /><ActionButton icon="search" label="조회" variant="primary" /></span>
      </FBar>
      <MKpis items={[['금월 발행', '72', '건'], ['전자세금계산서', '58', '건', 'teal'], ['거래명세서', '14', '건'], ['발행 대기', '1', '건']]} />
      <Card title="매출 증빙 발행 내역" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">매출 전표 기반 발행 · 국세청 연동</span>}>
        <table className="w-full border-collapse text-[11.5px]">
          <thead><tr>{['증빙번호', '매출번호', '거래처', '종류', '합계금액', '발행일', '발행상태', '국세청'].map((c, i) => <th key={c} className={th(i === 4 ? 'right' : i >= 6 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-[12px] text-ink3">{isLoading ? '불러오는 중…' : '발행 내역이 없습니다.'}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.no} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r.no}</td>
                <td className={`${td('left')} font-mono text-[10.5px]`}>{r.sale}</td>
                <td className={`${td('left')} font-semibold text-ink`}>{r.cust}</td>
                <td className={td('left')}><Pill tone={r.type === '거래명세서' ? 'mute' : 'info'}>{r.type}</Pill></td>
                <td className={`${td('right')} font-bold tabular-nums text-ink`}>{won(r.amt)}</td>
                <td className={`${td('center')} tabular-nums`}>{r.date}</td>
                <td className={td('center')}><Pill tone={tone(r.status)}>{r.status}</Pill></td>
                <td className={`${td('center')} text-[10.5px]`} style={{ color: r.nts === '—' ? C.ink3 : C.teal, fontWeight: r.nts === '—' ? 400 : 700 }}>{r.nts === '국세청 전송' ? '✓ 전송' : r.nts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
