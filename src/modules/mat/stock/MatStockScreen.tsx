import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { C, MHead, MKpis, th, td } from '../_mat';
import { useStocks } from '@/features/stock/useStock';

const tone = (s: string): Tone => (s === '정상' ? 'ok' : s === '부족' ? 'err' : 'warn');
const fmt = (n: number) => n.toLocaleString('ko-KR');

/** 실시간 재고 조회 — 데이터: features/stock/useStock (원장→현재고 도출). */
export default function MatStockScreen() {
  const { data: stocks = [] } = useStocks();
  const shortage = stocks.filter((s) => s.status === '부족').length;
  const over = stocks.filter((s) => s.status === '과다').length;
  const normal = stocks.filter((s) => s.status === '정상').length;

  return (
    <div className="flex flex-col gap-3.5">
      <MHead title="실시간 재고 조회" sub="실시간 재고 조회 (Stock Status) · 원장 도출" actions={<ActionBar actions={['refresh', 'download']} />} />
      <MKpis items={[['관리 품목', String(stocks.length), '종'], ['안전재고 미만', String(shortage), '종', 'err'], ['과다 재고', String(over), '종', 'warn'], ['정상', String(normal), '종', 'ok']]} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="품목·Lot별 현재고" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">원장(stockMovements) 합산 · 실시간</span>}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr>{['품목', '품목명', '창고', '현재고', '안전재고', '상태'].map((c, i) => <th key={c} className={th(i >= 3 && i <= 4 ? 'right' : i === 5 ? 'center' : 'left')}>{c}</th>)}</tr></thead>
            <tbody>
              {stocks.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[11.5px] text-ink3">재고 데이터가 없습니다.</td></tr>
              )}
              {stocks.map((r, i) => (
                <tr key={`${r.item}-${r.warehouse}`} style={{ background: i % 2 ? C.panelAlt : '#fff' }} className="cursor-pointer">
                  <td className={`${td('left')} font-mono text-[11px] font-bold text-ink`}>{r.item}</td>
                  <td className={`${td('left')} font-semibold text-ink`}>{r.itemName}</td>
                  <td className={td('left')}>{r.warehouse}</td>
                  <td className={`${td('right')} font-bold tabular-nums`} style={{ color: r.status === '부족' ? C.err : C.ink }}>{fmt(r.currentQty)}</td>
                  <td className={`${td('right')} tabular-nums text-ink3`}>{fmt(r.safetyStock)}</td>
                  <td className={td('center')}><Pill tone={tone(r.status)} solid={r.status === '부족'}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="재고 상태 분포">
          <div className="mb-2 flex justify-center">
            <Donut data={[{ name: '정상', v: normal, c: C.teal }, { name: '부족', v: shortage, c: C.err }, { name: '과다', v: over, c: C.warn }]} size={140} centerTop={String(stocks.length)} centerSub="총 품목" />
          </div>
          <div className="flex flex-col gap-2">
            {([['정상', normal, C.teal], ['안전재고 미만', shortage, C.err], ['과다 재고', over, C.warn]] as const).map(([l, n, c]) => (
              <div key={l} className="flex items-center gap-2 text-[11px]">
                <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: c }} />
                <span className="flex-1 font-semibold text-ink2">{l}</span>
                <b className="text-ink">{n}종</b>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
