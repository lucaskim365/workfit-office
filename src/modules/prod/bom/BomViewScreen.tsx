import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { type BomItem } from '@/domain/bom/schema';
import { useBoms } from '@/features/bom/useBoms';

const KIND_TONE: Record<BomItem['kind'], Tone> = { 제품: 'ok', 반제품: 'warn', 원자재: 'info', 부자재: 'mute' };
const won = (n: number) => n.toLocaleString('ko-KR');

/** BOM(자재명세서) 조회 — 데이터: features/bom/useBoms (header-line). */
export default function BomViewScreen() {
  const [sel, setSel] = useState('CN-ASM-100');
  const [q, setQ] = useState('');
  const { data: boms = [] } = useBoms();
  const prod = boms.find((p) => p.code === sel) ?? boms[0];
  const tree = prod?.items ?? [];
  const revs = prod?.revisions ?? [];
  const products = boms.filter((p) => !q || p.name.includes(q) || p.code.toLowerCase().includes(q.toLowerCase()));
  const matCost = tree.filter((r) => r.price != null).reduce((s, r) => s + r.ext * (r.price as number), 0);
  const maxLvl = tree.length ? Math.max(...tree.map((r) => r.lvl)) : 0;

  const kpis: Array<[string, string, string, string]> = [
    ['등록 제품(BOM)', String(boms.length), '종', 'text-ink'],
    ['BOM 레벨', String(maxLvl + 1), 'Lv', 'text-ink'],
    ['구성 품목', String(Math.max(tree.length - 1, 0)), '종', 'text-ink'],
    ['현재 Revision', `Rev ${prod?.rev ?? '-'}`, '', 'text-blue'],
    ['자재 표준원가', won(matCost), '₩', 'text-teal'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">BOM(자재명세서) 조회</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 기준정보 / BOM(자재명세서) 조회</p>
        </div>
        <ActionBar actions={[{ preset: 'compare', label: 'Rev 비교' }, 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 3 ? 'text-[19px]' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[250px_1fr_290px]">
        {/* 제품 목록 */}
        <Card
          title="제품 목록"
          action={
            <div className="flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2 py-1">
              <span className="text-[10px] text-ink3">⌕</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색" className="w-16 bg-transparent text-[10.5px] text-ink outline-none" />
            </div>
          }
          bodyClassName="p-0"
        >
          <div className="py-1.5">
            {products.map((p) => {
              const on = p.code === sel;
              return (
                <button key={p.code} onClick={() => setSel(p.code)} className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[12px] font-bold ${on ? 'text-teal' : 'text-ink'}`}>{p.name}</div>
                    <div className="mt-px font-mono text-[9.5px] text-ink3">{p.code}</div>
                  </div>
                  <span className="rounded-[5px] bg-blue-soft px-1.5 py-0.5 text-[9.5px] font-bold text-blue">Rev {p.rev}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* BOM 트리 */}
        <Card title="BOM 구성 (다단계)" action={<span className="text-[10.5px] text-ink3">{prod?.name} <span className="font-mono">· {prod?.code} · Rev {prod?.rev}</span></span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['품번 / 품명', '구분', '소요량', '완제품당', 'Loss', '공정/사용처', '단가(₩)', '금액(₩)'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 && i <= 4 ? 'text-right' : i === 1 ? 'text-center' : i >= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tree.map((r, i) => {
                  const amt = r.price != null ? Math.round(r.ext * r.price) : null;
                  return (
                    <tr key={r.code + i} className={r.lvl === 0 || i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2">
                        <div className="flex items-center" style={{ paddingLeft: r.lvl * 20 }}>
                          {r.lvl > 0 && <span className="mr-1.5 text-[11px] text-ink3">└</span>}
                          <div>
                            <div className={`${r.lvl === 0 ? 'font-extrabold text-ink' : 'font-bold text-ink2'}`}>{r.name}</div>
                            <div className="mt-px font-mono text-[9.5px] text-ink3">{r.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-2 text-center"><Pill tone={KIND_TONE[r.kind]}>{r.kind}</Pill></td>
                      <td className="border-b border-border px-3 py-2 text-right font-mono font-bold text-ink">{r.lvl === 0 ? '–' : `${r.qty} ${r.unit}`}</td>
                      <td className="border-b border-border px-3 py-2 text-right font-mono text-ink3">{r.lvl === 0 ? '–' : `${r.ext} ${r.unit}`}</td>
                      <td className={`border-b border-border px-3 py-2 text-right font-mono ${r.loss >= 2 ? 'text-amber' : 'text-ink3'}`}>{r.lvl === 0 ? '–' : `${r.loss}%`}</td>
                      <td className="border-b border-border px-3 py-2 text-[10.5px] text-ink3">{r.proc}</td>
                      <td className="border-b border-border px-3 py-2 text-right font-mono text-ink2">{r.price != null ? won(r.price) : '—'}</td>
                      <td className={`border-b border-border px-3 py-2 text-right font-mono font-bold ${amt != null ? 'text-ink' : 'text-ink3'}`}>{amt != null ? won(amt) : '롤업'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-panel-alt px-4 py-2.5">
            <span className="text-[10.5px] text-ink3">구성 {tree.length - 1}종 · {maxLvl + 1}레벨</span>
            <span className="text-[11px] text-ink3">자재 표준원가 <b className="font-mono text-ink">{won(matCost)} ₩</b> <span className="text-[9.5px]">(가공비 별도)</span></span>
          </div>
        </Card>

        {/* 리비전 이력 */}
        <Card title="리비전 이력" action={<span className="text-[10px] text-ink3">{revs.length}개 Rev</span>} bodyClassName="p-0">
          <div className="p-4">
            {revs.map((r, i) => (
              <div key={r.rev} className={`flex gap-3 ${i < revs.length - 1 ? 'pb-3.5' : ''}`}>
                <div className="flex flex-col items-center">
                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold ${r.cur ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink3'}`}>{r.rev}</div>
                  {i < revs.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-border" style={{ minHeight: 18 }} />}
                </div>
                <div className="flex-1 pt-px">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11.5px] font-extrabold text-ink">Rev {r.rev}</span>
                    {r.cur && <Pill tone="ok">현재</Pill>}
                  </div>
                  <div className="my-0.5 font-mono text-[9.5px] text-ink3">{r.date} · {r.by}</div>
                  <div className="text-[10.5px] leading-relaxed text-ink2">{r.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
