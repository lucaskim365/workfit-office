import { useMemo, useState } from 'react';
import { usePositions, useRemovePosition, useUpsertPosition } from '@/features/position/usePositions';
import type { Position } from '@/domain/position/schema';

/**
 * 직급관리 (기준정보) — 직급명·서열(rank)·부서책임자 여부 CRUD.
 * rank 는 동적 결재선 룰의 직급범위 매칭·상향 탐색에 쓰인다. ([[dynamic-route-engine]])
 */
const BLANK: Position = { id: '', name: '', rank: 5, isDeptHead: false };

export default function PositionScreen() {
  const { data: rows = [], isLoading } = usePositions();
  const upsert = useUpsertPosition();
  const remove = useRemovePosition();
  const [sel, setSel] = useState<Position | null>(null);
  const [msg, setMsg] = useState('');

  const sorted = useMemo(() => [...rows].sort((a, b) => a.rank - b.rank), [rows]);
  const nextId = () => {
    const n = rows.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0) + 1;
    return `P${String(n).padStart(2, '0')}`;
  };

  const save = async () => {
    if (!sel) return;
    if (!sel.name.trim()) return setMsg('직급명을 입력하세요.');
    const item = { ...sel, id: sel.id || nextId() };
    await upsert.mutateAsync(item);
    setMsg('저장되었습니다.');
    setSel(null);
  };
  const del = async (id: string) => { await remove.mutateAsync(id); if (sel?.id === id) setSel(null); };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">직급관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 직급관리</p>
        </div>
        <button onClick={() => { setSel({ ...BLANK }); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 직급 추가</button>
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] items-start gap-3.5">
        {/* 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {['서열', '직급명', '부서책임자', ''].map((h) => (
                  <th key={h} className="border-b border-border bg-panel-alt px-3.5 py-2.5 text-left text-[10.5px] font-bold text-ink2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={4} className="px-3.5 py-8 text-center text-ink3">불러오는 중…</td></tr>}
              {sorted.map((p) => (
                <tr key={p.id} onClick={() => { setSel(p); setMsg(''); }} className={`cursor-pointer ${sel?.id === p.id ? 'bg-teal-soft/60' : 'hover:bg-panel-alt'}`}>
                  <td className="border-b border-border px-3.5 py-2.5 tabular-nums text-ink2">{p.rank}</td>
                  <td className="border-b border-border px-3.5 py-2.5 font-semibold text-ink">{p.name}</td>
                  <td className="border-b border-border px-3.5 py-2.5">{p.isDeptHead ? <span className="rounded bg-teal/15 px-1.5 py-px text-[10px] font-bold text-teal">책임자</span> : <span className="text-ink3">—</span>}</td>
                  <td className="border-b border-border px-3.5 py-2.5 text-right"><button onClick={(e) => { e.stopPropagation(); del(p.id); }} className="text-[12px] text-ink3 hover:text-red-500">삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 편집 */}
        <div className="rounded-xl border border-border bg-panel p-4">
          {sel ? (
            <div className="space-y-3">
              <div className="text-[13px] font-bold text-ink">{sel.id ? `직급 편집 · ${sel.id}` : '새 직급'}</div>
              <Field label="직급명"><input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal" /></Field>
              <Field label="서열(rank, 작을수록 상위)"><input type="number" value={sel.rank} onChange={(e) => setSel({ ...sel, rank: Number(e.target.value) })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal" /></Field>
              <label className="flex items-center gap-2 text-[12.5px] text-ink2"><input type="checkbox" checked={sel.isDeptHead} onChange={(e) => setSel({ ...sel, isDeptHead: e.target.checked })} /> 부서 책임자 직급(팀장·공장장 등)</label>
              {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setSel(null)} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
                <button onClick={save} disabled={upsert.isPending} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-[12px] text-ink3">직급을 선택하거나 추가하세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold text-ink2">{label}</span>{children}</label>;
}
