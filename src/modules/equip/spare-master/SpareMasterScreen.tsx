import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid, won } from '../_maint';
import { useSpareParts } from '@/features/sparePart/useSpareParts';

const SP_CAT: Record<string, Tone> = { 소모성: 'info', 정밀부품: 'warn', 전장부품: 'ok', 기구부품: 'mute' };
const stTone = (s: string): Tone => (s === '정상' ? 'ok' : s === '결품' ? 'err' : 'warn');

function StockBar({ stock, safe, opt }: { stock: number; safe: number; opt: number }) {
  const max = Math.max(opt * 1.1, stock, 1);
  const c = stock === 0 ? C.err : stock < safe ? C.warn : C.teal;
  return (
    <div className="relative h-2.5 rounded-[5px]" style={{ background: C.bgDeep }}>
      <div className="absolute inset-0 rounded-[5px]" style={{ width: `${(stock / max) * 100}%`, background: c }} />
      <div className="absolute -top-[3px] -bottom-[3px] w-0.5" style={{ left: `${(safe / max) * 100}%`, background: C.err }} title="안전재고" />
    </div>
  );
}

/** 예비품 마스터 관리 — 와이어프레임 spare-master.jsx 정본. */
export default function SpareMasterScreen() {
  const { data: spares = [], isLoading } = useSpareParts();
  const [sel, setSel] = useState('SP-MB-200');
  const [q, setQ] = useState('');
  const cur = spares.find((s) => s.code === sel) || spares[0];
  const rows = spares.filter((s) => !q || s.name.includes(q) || s.code.toLowerCase().includes(q.toLowerCase()));

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '예비품이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">예비품 마스터 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 예비품·스페어 파트 / 예비품 마스터 관리</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '예비품 등록', variant: 'primary' }, 'save', 'upload', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['총 등록 품목', '248', '종', C.ink], ['안전재고 미달', '5', '종', C.warn], ['결품', '1', '종', C.err],
        ['총 재고금액', '186.4', 'M₩', C.ink], ['장기 미사용', '12', '종', C.amber],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        {/* 목록 */}
        <Card
          title="예비품 목록"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink">전체 분류 <span className="text-[8px] text-ink3">▾</span></span>
              <div className="flex items-center gap-1.5 rounded-[7px] border border-border-hi bg-panel px-2.5 py-1.5">
                <span className="text-[11px] text-ink3">⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품번·품명 검색" className="w-[110px] bg-transparent text-[11px] text-ink outline-none" />
              </div>
            </div>
          }
        >
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {[['품번 / 품명', 'text-left'], ['분류', 'text-center'], ['단가(₩)', 'text-right'], ['재고', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const on = s.code === sel;
                return (
                  <tr key={s.code} onClick={() => setSel(s.code)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-3 py-2" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{s.name}</div>
                      <div className="mt-px font-mono text-[9.5px] text-ink3">{s.code} · {s.spec}</div>
                    </td>
                    <td className="border-b border-border px-3 py-2 text-center"><Pill tone={SP_CAT[s.cat]}>{s.cat}</Pill></td>
                    <td className="border-b border-border px-3 py-2 text-right font-mono font-bold text-ink">{won(s.price)}</td>
                    <td className="border-b border-border px-3 py-2 text-center font-extrabold tabular-nums" style={{ color: s.stock === 0 ? C.err : s.stock < s.safe ? C.warn : C.ink2 }}>{s.stock}<span className="text-[9px] font-normal text-ink3"> /{s.safe}</span></td>
                    <td className="border-b border-border px-3 py-2 text-center"><Pill tone={stTone(s.state)}>{s.state}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="품목 상세" bodyClassName="p-0" action={<span className="font-mono text-[10.5px] text-ink3">{cur.code}</span>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-ink">{cur.name}</span>
              <span className="flex gap-1.5"><Pill tone={SP_CAT[cur.cat]}>{cur.cat}</Pill><Pill tone={stTone(cur.state)}>{cur.state}</Pill></span>
            </div>
            <div className="font-mono text-[11px] text-ink3">{cur.spec}</div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">기본 정보</div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[['제조사', cur.maker], ['단가', won(cur.price) + ' ₩'], ['단위', cur.unit], ['리드타임', cur.lead + '일'], ['보관위치', cur.loc], ['보증기간', cur.warranty]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-[10.5px] text-ink3">{k}</span>
                  <span className={`text-[11.5px] font-bold text-ink2 ${/\d/.test(v) ? 'font-mono' : ''}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-b border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-ink3">재고 현황</span>
              <span className="text-[10px] text-ink3">재고금액 <b className="text-ink2">{won(cur.price * cur.stock)} ₩</b></span>
            </div>
            <div className="mb-2.5 flex">
              {([['현재고', cur.stock, cur.stock === 0 ? C.err : cur.stock < cur.safe ? C.warn : C.teal], ['안전재고', cur.safe, C.ink2], ['적정재고', cur.opt, C.ink2]] as const).map(([k, v, c], i) => (
                <div key={k} className="flex-1 text-center" style={{ borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div className="text-[22px] font-extrabold tabular-nums" style={{ color: c }}>{v}</div>
                  <div className="text-[9.5px] text-ink3">{k} ({cur.unit})</div>
                </div>
              ))}
            </div>
            <StockBar stock={cur.stock} safe={cur.safe} opt={cur.opt} />
            {cur.stock < cur.safe && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg px-3 py-2" style={{ background: cur.stock === 0 ? '#fdecea' : '#fef6ec', border: `1px solid ${cur.stock === 0 ? C.err : C.warn}` }}>
                <span className="text-[12px]">{cur.stock === 0 ? '⛔' : '⚠'}</span>
                <span className="text-[10.5px] font-bold" style={{ color: cur.stock === 0 ? C.err : '#b5731f' }}>안전재고 {cur.safe - cur.stock}{cur.unit} 부족 — 발주 요청 권고 (리드타임 {cur.lead}일)</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10.5px] font-bold text-ink3">적용 설비</div>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {cur.eqs.map((e, i) => <span key={i} className="rounded-md px-2.5 py-1 text-[10.5px] font-semibold text-ink2" style={{ background: C.bgDeep }}>{e}</span>)}
            </div>
            <div className="mb-2 text-[10.5px] font-bold text-ink3">대체품</div>
            {cur.alt.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {cur.alt.map((a, i) => <span key={i} className="rounded-md px-2.5 py-1 font-mono text-[10.5px] font-semibold" style={{ color: C.blue, background: '#eaf0fc' }}>⇄ {a}</span>)}
              </div>
            ) : <span className="text-[10.5px] text-ink3">등록된 대체품 없음</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
