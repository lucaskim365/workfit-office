import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Donut } from '@/shared/ui/charts/Donut';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { C, KpiGrid } from '../_maint';

const SPS_CAT: Record<string, Tone> = { 소모성: 'info', 정밀부품: 'warn', 전장부품: 'ok', 기구부품: 'mute' };
const SPS_CATC: Record<string, string> = { 소모성: '#3a6ee0', 정밀부품: C.warn, 전장부품: C.teal, 기구부품: '#b7c0d4' };

interface Row { code: string; name: string; cat: string; loc: string; wh: string; unit: string; price: number; stock: number; safe: number; opt: number; turn: number; lastIn: string; lastOut: string; idle: number; state: string }
const SPS_ROWS: Row[] = [
  { code: 'SP-MB-200', name: '캐리어 멤브레인', cat: '소모성', loc: 'A-03-2', wh: 'A구역', unit: 'EA', price: 480000, stock: 6, safe: 8, opt: 12, turn: 2.4, lastIn: '06-02', lastOut: '06-09', idle: 12, state: '부족' },
  { code: 'SP-RR-300', name: '리테이너 링', cat: '소모성', loc: 'A-03-3', wh: 'A구역', unit: 'EA', price: 320000, stock: 18, safe: 8, opt: 16, turn: 1.8, lastIn: '05-28', lastOut: '06-07', idle: 14, state: '정상' },
  { code: 'SP-PAD-IC', name: '연마 패드', cat: '소모성', loc: 'A-04-1', wh: 'A구역', unit: 'EA', price: 210000, stock: 4, safe: 10, opt: 24, turn: 3.6, lastIn: '06-10', lastOut: '06-06', idle: 5, state: '부족' },
  { code: 'SP-HTR-3K', name: '튜브 히터 어셈블리', cat: '전장부품', loc: 'C-01-1', wh: 'C구역', unit: 'EA', price: 1850000, stock: 2, safe: 2, opt: 3, turn: 0.6, lastIn: '06-07', lastOut: '06-10', idle: 11, state: '주의' },
  { code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', loc: 'A-05-2', wh: 'A구역', unit: 'EA', price: 3200000, stock: 1, safe: 1, opt: 2, turn: 0.3, lastIn: '03-14', lastOut: '04-02', idle: 80, state: '주의' },
  { code: 'SP-ORK-A', name: 'O-Ring 키트', cat: '기구부품', loc: 'B-02-4', wh: 'B구역', unit: 'SET', price: 95000, stock: 24, safe: 6, opt: 12, turn: 1.2, lastIn: '06-09', lastOut: '06-08', idle: 9, state: '정상' },
  { code: 'SP-BRG-SP', name: '스핀들 베어링', cat: '정밀부품', loc: 'A-06-1', wh: 'A구역', unit: 'EA', price: 540000, stock: 5, safe: 4, opt: 8, turn: 0.9, lastIn: '05-20', lastOut: '05-30', idle: 22, state: '정상' },
  { code: 'SP-FIL-IM', name: '이온소스 필라멘트', cat: '소모성', loc: 'B-04-2', wh: 'B구역', unit: 'EA', price: 680000, stock: 0, safe: 3, opt: 6, turn: 1.4, lastIn: '05-12', lastOut: '06-09', idle: 12, state: '결품' },
  { code: 'SP-PMP-DM', name: '다이어프램 펌프', cat: '기구부품', loc: 'C-03-1', wh: 'C구역', unit: 'EA', price: 420000, stock: 7, safe: 3, opt: 6, turn: 0.4, lastIn: '02-08', lastOut: '03-15', idle: 98, state: '정상' },
  { code: 'SP-VLV-PN', name: '공압 밸브', cat: '기구부품', loc: 'B-01-3', wh: 'B구역', unit: 'EA', price: 165000, stock: 11, safe: 4, opt: 10, turn: 1.1, lastIn: '06-04', lastOut: '06-05', idle: 16, state: '정상' },
  { code: 'SP-SEN-PT', name: '백금 측온센서(Pt100)', cat: '전장부품', loc: 'C-02-2', wh: 'C구역', unit: 'EA', price: 88000, stock: 3, safe: 5, opt: 10, turn: 1.6, lastIn: '05-30', lastOut: '06-08', idle: 13, state: '부족' },
  { code: 'SP-GSK-CF', name: 'CF 가스켓 세트', cat: '소모성', loc: 'B-03-1', wh: 'B구역', unit: 'SET', price: 42000, stock: 36, safe: 12, opt: 30, turn: 2.1, lastIn: '06-08', lastOut: '06-09', idle: 10, state: '정상' },
];
const stTone = (s: string): Tone => (s === '정상' ? 'ok' : s === '결품' ? 'err' : 'warn');
const won = (n: number) => n.toLocaleString('ko-KR');
const short = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : '' + n);

function SpsBar({ stock, safe, opt }: { stock: number; safe: number; opt: number }) {
  const max = Math.max(opt * 1.15, stock, safe, 1);
  const c = stock === 0 ? C.err : stock < safe ? C.warn : C.teal;
  return (
    <div className="relative h-[7px] min-w-[64px] rounded" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded" style={{ width: `${Math.min((stock / max) * 100, 100)}%`, background: c }} />
      <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: `${(safe / max) * 100}%`, background: C.err }} title="안전재고" />
    </div>
  );
}

type SortKey = 'amount' | 'stock' | 'turn' | 'idle';

/** 예비품 재고 조회 — 와이어프레임 spare-stock.jsx 정본. */
export default function SpareStockScreen() {
  const [cat, setCat] = useState('전체');
  const [statusF, setStatusF] = useState('전체');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'amount', dir: 'desc' });

  const withAmt = SPS_ROWS.map((r) => ({ ...r, amount: r.price * r.stock }));
  let rows = withAmt.filter((r) =>
    (cat === '전체' || r.cat === cat) &&
    (statusF === '전체' || r.state === statusF) &&
    (!q || r.name.includes(q) || r.code.toLowerCase().includes(q.toLowerCase())),
  );
  const sortVal = (r: (typeof withAmt)[number]) => ({ amount: r.amount, stock: r.stock, turn: r.turn, idle: r.idle }[sort.key]);
  rows = [...rows].sort((a, b) => (sortVal(a) - sortVal(b)) * (sort.dir === 'asc' ? 1 : -1));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  const caret = (key: SortKey) => (sort.key === key ? <span className="ml-0.5 text-[8px]" style={{ color: C.teal }}>{sort.dir === 'asc' ? '▲' : '▼'}</span> : <span className="ml-0.5 text-[8px] text-ink3 opacity-40">▾</span>);

  const catTotals: Record<string, number> = {};
  withAmt.forEach((r) => { catTotals[r.cat] = (catTotals[r.cat] || 0) + r.amount; });
  const donutData = Object.keys(SPS_CATC).filter((k) => catTotals[k]).map((k) => ({ name: k, v: catTotals[k], c: SPS_CATC[k] }));
  const totalAmt = withAmt.reduce((s, r) => s + r.amount, 0);

  const whTotals: Record<string, number> = {};
  withAmt.forEach((r) => { whTotals[r.wh] = (whTotals[r.wh] || 0) + r.amount; });
  const whRows = Object.keys(whTotals).sort().map((k) => ({ label: k, v: whTotals[k], c: C.navy }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">예비품 재고 조회</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 예비품·스페어 파트 / 예비품 재고 조회</p>
        </div>
        <ActionBar actions={['refresh', 'download']} />
      </div>

      {/* 조회 조건 */}
      <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border bg-panel px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-ink3">분류</span>
          <div className="flex gap-1.5">
            {['전체', '소모성', '정밀부품', '전장부품', '기구부품'].map((c) => (
              <button key={c} onClick={() => setCat(c)} className="rounded-[7px] px-3 py-1.5 text-[10.5px] font-bold" style={{ border: `1px solid ${cat === c ? C.teal : C.borderHi}`, background: cat === c ? C.teal : '#fff', color: cat === c ? '#fff' : C.ink2 }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-ink3">보관위치</span>
          <span className="inline-flex items-center gap-3 rounded-[7px] border border-border-hi bg-panel px-3 py-[7px] text-[11.5px] font-semibold text-ink">전체 구역 <span className="text-[8px] text-ink3">▾</span></span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5">
          <span className="text-[11px] text-ink3">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품번·품명 검색" className="w-[130px] bg-transparent text-[11.5px] text-ink outline-none" />
        </div>
        <ActionBar actions={['search']} />
      </div>

      <KpiGrid cols={5} items={[
        ['조회 품목', '' + withAmt.length, '종', C.ink],
        ['총 재고금액', short(totalAmt).replace('M', ''), 'M₩', C.ink],
        ['안전재고 미달', '' + withAmt.filter((r) => r.stock > 0 && r.stock < r.safe).length, '종', C.warn],
        ['결품', '' + withAmt.filter((r) => r.stock === 0).length, '종', C.err],
        ['장기 미사용(90일+)', '' + withAmt.filter((r) => r.idle >= 90).length, '종', C.amber],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[300px_1fr]">
        {/* 분석 */}
        <div className="flex flex-col gap-3.5">
          <Card title="분류별 재고금액">
            <div className="flex flex-col items-center gap-3">
              <Donut data={donutData} size={134} thickness={22} centerTop={short(totalAmt)} centerSub="총 재고금액(₩)" />
              <div className="flex w-full flex-col gap-1.5">
                {donutData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: d.c }} />
                    <span className="flex-1 text-[11px] font-semibold text-ink2">{d.name}</span>
                    <span className="font-mono text-[11px] font-bold text-ink">{short(d.v)}</span>
                    <span className="w-[30px] text-right text-[9.5px] text-ink3">{Math.round((d.v / totalAmt) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="구역별 재고금액">
            <RankBars rows={whRows} />
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-[10.5px]">
              <span className="font-semibold text-ink3">장기 미사용 재고금액</span>
              <span className="font-mono font-extrabold text-ink">{won(withAmt.filter((r) => r.idle >= 90).reduce((s, r) => s + r.amount, 0))} ₩</span>
            </div>
          </Card>
        </div>

        {/* 테이블 */}
        <Card
          title="예비품 재고 현황"
          bodyClassName="p-0"
          action={
            <div className="flex gap-1.5">
              {['전체', '정상', '부족', '주의', '결품'].map((f) => (
                <button key={f} onClick={() => setStatusF(f)} className="rounded-[7px] px-3 py-1 text-[10.5px] font-bold" style={{ border: `1px solid ${statusF === f ? C.teal : C.borderHi}`, background: statusF === f ? C.teal : '#fff', color: statusF === f ? '#fff' : C.ink2 }}>{f}</button>
              ))}
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-left text-[10.5px] font-bold whitespace-nowrap text-ink2">품번 / 품명</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">분류</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">위치</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-left text-[10.5px] font-bold whitespace-nowrap text-ink2">재고 / 안전</th>
                <th onClick={() => toggleSort('stock')} className="cursor-pointer select-none border-b border-border bg-panel-alt px-3 py-2.5 text-right text-[10.5px] font-bold whitespace-nowrap text-ink2">현재고{caret('stock')}</th>
                <th onClick={() => toggleSort('turn')} className="cursor-pointer select-none border-b border-border bg-panel-alt px-3 py-2.5 text-right text-[10.5px] font-bold whitespace-nowrap text-ink2">회전율{caret('turn')}</th>
                <th onClick={() => toggleSort('amount')} className="cursor-pointer select-none border-b border-border bg-panel-alt px-3 py-2.5 text-right text-[10.5px] font-bold whitespace-nowrap text-ink2">재고금액(₩){caret('amount')}</th>
                <th onClick={() => toggleSort('idle')} className="cursor-pointer select-none border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">최종이동{caret('idle')}</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2.5 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.code} style={{ background: i % 2 ? C.panelAlt : '#fff' }}>
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{r.name}</div><div className="mt-px font-mono text-[9.5px] text-ink3">{r.code}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={SPS_CAT[r.cat]}>{r.cat}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink3">{r.loc}</td>
                  <td className="border-b border-border px-3 py-2.5"><SpsBar stock={r.stock} safe={r.safe} opt={r.opt} /></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-extrabold tabular-nums" style={{ color: r.stock === 0 ? C.err : r.stock < r.safe ? C.warn : C.ink }}>{r.stock}<span className="text-[9px] font-normal text-ink3"> /{r.safe} {r.unit}</span></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold" style={{ color: r.turn < 0.5 ? C.ink3 : C.ink2 }}>{r.turn.toFixed(1)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink">{won(r.amount)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center">
                    <div className="font-mono text-[10.5px] text-ink2">{r.lastIn > r.lastOut ? r.lastIn : r.lastOut}</div>
                    <div className="mt-px text-[9px] font-bold" style={{ color: r.idle >= 90 ? C.amber : C.ink3 }}>{r.idle >= 90 ? `${r.idle}일 정체` : `${r.idle}일 전`}</div>
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={stTone(r.state)}>{r.state}</Pill></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="border-b border-border px-3 py-8 text-center text-ink3">조회 조건에 해당하는 예비품이 없습니다.</td></tr>}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[10.5px] text-ink3">조회 <b className="text-ink2">{rows.length}</b>종 · 재고수량 합계 <b className="text-ink2">{rows.reduce((s, r) => s + r.stock, 0)}</b></span>
            <span className="text-[11px] text-ink3">재고금액 합계 <b className="font-mono text-ink">{won(rows.reduce((s, r) => s + r.amount, 0))} ₩</b></span>
          </div>
        </Card>
      </div>
    </div>
  );
}
