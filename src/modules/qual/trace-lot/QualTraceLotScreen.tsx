import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { C, KpiGrid } from '../_qual';
import { useTraceNodes } from '@/features/traceNode/useTraceNodes';

const TR_INSP: Record<string, Tone> = { 합격: 'ok', 조건부: 'warn', 특채: 'warn', 불합격: 'err', 진행중: 'info' };
const INSP_C: Record<string, string> = { ok: C.ok, warn: C.warn, err: C.err, info: C.blue };
const TR_TYPE: Record<string, { c: string; ic: string }> = { 제품: { c: C.teal, ic: '◆' }, 반제품: { c: C.blue, ic: '◇' }, 자재: { c: C.ink3, ic: '○' } };

/** 로트(Lot) 품질 이력 역추적 — 와이어프레임 qual-trace-lot.jsx 정본. */
export default function QualTraceLotScreen() {
  const { data: TR_NODES = [], isLoading } = useTraceNodes();
  const [sel, setSel] = useState('N0');
  const cur = TR_NODES.find((n) => n.id === sel) || TR_NODES[0];
  const root = TR_NODES[0];

  const matCnt = TR_NODES.filter((n) => n.type === '자재').length;
  const vendors = new Set(TR_NODES.filter((n) => n.vendor).map((n) => n.vendor)).size;
  const events = TR_NODES.reduce((s, n) => s + n.events.length, 0);
  const ncrCnt = TR_NODES.filter((n) => n.ncr).length;

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : 'LOT 추적 데이터가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">로트(Lot) 품질 이력 역추적</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 추적·사후관리 / 로트(Lot) 품질 이력 역추적</p>
        </div>
        <ActionBar actions={[{ icon: 'compare', label: '정방향 추적' }, 'download']} />
      </div>

      {/* 추적 대상 바 */}
      <div className="flex flex-wrap items-center gap-[18px] rounded-[11px] px-4 py-3.5" style={{ background: C.navy }}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] font-semibold text-white/55">추적 대상 완제품 LOT</span>
          <span className="flex items-center gap-2"><span className="text-[16px] font-extrabold text-white">{root.name}</span><span className="font-mono text-[11px] font-bold" style={{ color: '#7fe3da' }}>{root.lot}</span></span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">
          <span className="text-[12px] text-white/60">⌕</span>
          <input placeholder="LOT 번호·제품·자재 검색" className="w-[180px] bg-transparent text-[11.5px] text-white outline-none placeholder:text-white/40" />
        </div>
      </div>

      <KpiGrid cols={5} items={[
        ['구성 LOT', '' + (TR_NODES.length - 1), '개', C.ink],
        ['투입 원자재', '' + matCnt, 'LOT', C.ink],
        ['연계 협력사', '' + vendors, '개사', C.blue],
        ['품질 이벤트', '' + events, '건', C.ink],
        ['연계 NCR', '' + ncrCnt, '건', ncrCnt ? C.err : C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.35fr_1fr]">
        {/* 계보 트리 */}
        <Card title="LOT 계보(Genealogy) — 역방향" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">제품 → 반제품 → 원자재</span>}>
          <div className="flex flex-col p-4">
            {TR_NODES.map((n, i) => {
              const on = n.id === sel;
              const t = TR_TYPE[n.type];
              const isLast = i === TR_NODES.length - 1;
              const nextShallow = TR_NODES[i + 1] && TR_NODES[i + 1].level <= n.level;
              return (
                <div key={n.id} className="flex" style={{ paddingLeft: n.level * 26 }}>
                  {n.level > 0 && (
                    <div className="relative w-[18px] shrink-0">
                      <span className="absolute w-0.5" style={{ left: -13, top: 0, bottom: nextShallow || isLast ? '50%' : 0, background: C.border }} />
                      <span className="absolute h-0.5 w-[13px]" style={{ left: -13, top: '50%', background: C.border }} />
                    </div>
                  )}
                  <div onClick={() => setSel(n.id)} className="mb-2 flex flex-1 cursor-pointer items-center gap-2.5 rounded-[9px] px-3 py-2.5" style={{ background: on ? C.tealSoft : C.panelAlt, border: `1px solid ${on ? C.teal : C.border}` }}>
                    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-[13px]" style={{ background: t.c + '1a', color: t.c }}>{t.ic}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-extrabold" style={{ color: on ? C.teal : C.ink }}>{n.name}</span>
                        <span className="rounded px-1.5 py-px text-[8.5px] font-bold" style={{ color: t.c, border: `1px solid ${t.c}44` }}>{n.type}</span>
                        {n.ncr && <span className="text-[8.5px] font-extrabold" style={{ color: C.err }}>● NCR</span>}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-ink3">{n.lot} · {n.vendor || n.code} · {n.qty.toLocaleString()}{n.unit}</div>
                    </div>
                    <Pill tone={TR_INSP[n.insp]} solid={n.insp === '불합격'}>{n.insp}</Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 노드 상세 */}
        <Card title="LOT 품질 이력" bodyClassName="p-0" action={<Pill tone={TR_INSP[cur.insp]} solid={cur.insp === '불합격'}>{cur.inspType} {cur.insp}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2"><span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span><span className="rounded px-1.5 py-px text-[8.5px] font-bold" style={{ color: TR_TYPE[cur.type].c, border: `1px solid ${TR_TYPE[cur.type].c}44` }}>{cur.type}</span></div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink3">{cur.lot} · {cur.code}</div>
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2">
              {[[cur.vendor ? '협력사' : '공정', cur.vendor || cur.code], ['수량', cur.qty.toLocaleString() + ' ' + cur.unit], ['검사 구분', cur.inspType], ['판정', cur.insp], ['참조', cur.extra]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="shrink-0 text-[10px] text-ink3">{k}</span>
                  <span className="text-right text-[10.5px] font-bold" style={{ color: k === '판정' ? INSP_C[TR_INSP[cur.insp]] : C.ink2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="mb-3 text-[10.5px] font-bold text-ink3">품질 이력 타임라인 ({cur.events.length})</div>
            <div className="flex flex-col">
              {cur.events.map((e, i) => {
                const last = i === cur.events.length - 1;
                const c = INSP_C[e[3]] || C.ink3;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: e[3] === 'info' ? '#fff' : c, border: e[3] === 'info' ? `2px solid ${C.borderHi}` : `2px solid ${c}` }} />
                      {!last && <span className="w-0.5 flex-1" style={{ minHeight: 22, background: C.border }} />}
                    </div>
                    <div className="flex-1" style={{ paddingBottom: last ? 0 : 14 }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-bold" style={{ color: e[3] === 'err' ? C.err : C.ink }}>{e[0]}</span>
                        <span className="shrink-0 font-mono text-[8.5px] text-ink3">{e[1]}</span>
                      </div>
                      <div className="mt-0.5 text-[9.5px] text-ink3">{e[2]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-3.5">
            <div className="mb-1.5 text-[10px] font-bold text-ink3">{cur.level === 0 ? '하위 구성' : '상위 사용처 ↑'}</div>
            <div className="flex flex-wrap gap-1.5">
              {(cur.level === 0 ? TR_NODES.filter((n) => n.level >= 1) : TR_NODES.filter((n) => n.level < cur.level)).map((n) => (
                <span key={n.id} onClick={() => setSel(n.id)} className="cursor-pointer rounded-md px-2 py-1 font-mono text-[9.5px] font-bold text-ink2" style={{ background: C.panelAlt, border: `1px solid ${C.border}` }}>{n.lot}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
