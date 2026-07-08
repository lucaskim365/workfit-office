import { useMemo, useState } from 'react';
import { useDepartments, useRemoveDepartment, useUpsertDepartment } from '@/features/department/useDepartments';
import { useUsers } from '@/features/user/useUsers';
import { DEPT_TYPES, type Department } from '@/domain/department/schema';

/**
 * 부서/조직관리 (기준정보) — 부서 트리·상위부서·부서유형·부서장 CRUD.
 * parentId(상향추적)·deptType(공장 등)·headUserId 는 동적 결재선 룰의 토대. ([[dynamic-route-engine]])
 * 도크 조직도(/gw/orgchart, 읽기전용)와 같은 departments 마스터를 공유(여기=편집).
 */
const BLANK: Department = { id: '', name: '', parentId: null, headUserId: null, deptType: '본사', order: 100 };

const TYPE_TONE: Record<string, string> = { 본사: 'text-blue', 공장: 'text-teal', 영업소: 'text-amber', 연구소: 'text-ink2', 기타: 'text-ink3' };

export default function DepartmentScreen() {
  const { data: rows = [], isLoading } = useDepartments();
  const { data: users = [] } = useUsers();
  const upsert = useUpsertDepartment();
  const remove = useRemoveDepartment();
  const [sel, setSel] = useState<Department | null>(null);
  const [msg, setMsg] = useState('');

  const nameOf = (id: string | null) => users.find((u) => u.id === id)?.name ?? '—';

  // 트리 정렬 — parentId 로 깊이 계산 후 DFS 순서.
  const ordered = useMemo(() => {
    const byParent = new Map<string | null, Department[]>();
    for (const d of rows) {
      const arr = byParent.get(d.parentId) ?? [];
      arr.push(d);
      byParent.set(d.parentId, arr);
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const out: { d: Department; depth: number }[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const d of byParent.get(parent) ?? []) { out.push({ d, depth }); walk(d.id, depth + 1); }
    };
    walk(null, 0);
    return out;
  }, [rows]);

  const nextId = () => {
    const n = rows.reduce((m, d) => Math.max(m, Number(d.id.replace(/\D/g, '')) || 0), 0) + 10;
    return `D${String(n).padStart(3, '0')}`;
  };

  const save = async () => {
    if (!sel) return;
    if (!sel.name.trim()) return setMsg('부서명을 입력하세요.');
    if (sel.parentId === sel.id && sel.id) return setMsg('자기 자신을 상위로 지정할 수 없습니다.');
    await upsert.mutateAsync({ ...sel, id: sel.id || nextId() });
    setMsg('저장되었습니다.');
    setSel(null);
  };
  const del = async (id: string) => { await remove.mutateAsync(id); if (sel?.id === id) setSel(null); };

  const parentOptions = rows.filter((d) => d.id !== sel?.id);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">부서/조직관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 부서·조직관리</p>
        </div>
        <button onClick={() => { setSel({ ...BLANK }); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 부서 추가</button>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] items-start gap-3.5">
        {/* 트리 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <div className="grid grid-cols-[1fr_70px_90px_70px] border-b border-border bg-panel-alt px-3.5 py-2 text-[10.5px] font-bold text-ink2">
            <span>부서명</span><span>유형</span><span>부서장</span><span className="text-right">관리</span>
          </div>
          {isLoading && <div className="py-8 text-center text-[12px] text-ink3">불러오는 중…</div>}
          {ordered.map(({ d, depth }) => (
            <div key={d.id} onClick={() => { setSel(d); setMsg(''); }} className={`grid grid-cols-[1fr_70px_90px_70px] items-center border-b border-border px-3.5 py-2.5 text-[12.5px] ${sel?.id === d.id ? 'bg-teal-soft/60' : 'cursor-pointer hover:bg-panel-alt'}`}>
              <span className="truncate font-semibold text-ink" style={{ paddingLeft: depth * 16 }}>{depth > 0 && <span className="text-ink3">└ </span>}{d.name}</span>
              <span className={`text-[11px] font-bold ${TYPE_TONE[d.deptType] ?? 'text-ink3'}`}>{d.deptType}</span>
              <span className="truncate text-[11.5px] text-ink2">{nameOf(d.headUserId)}</span>
              <span className="text-right"><button onClick={(e) => { e.stopPropagation(); del(d.id); }} className="text-[11.5px] text-ink3 hover:text-red-500">삭제</button></span>
            </div>
          ))}
        </div>

        {/* 편집 */}
        <div className="rounded-xl border border-border bg-panel p-4">
          {sel ? (
            <div className="space-y-3">
              <div className="text-[13px] font-bold text-ink">{sel.id ? `부서 편집 · ${sel.id}` : '새 부서'}</div>
              <Field label="부서명"><input value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal" /></Field>
              <Field label="상위 부서">
                <select value={sel.parentId ?? ''} onChange={(e) => setSel({ ...sel, parentId: e.target.value || null })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal">
                  <option value="">(최상위)</option>
                  {parentOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="부서 유형">
                <select value={sel.deptType} onChange={(e) => setSel({ ...sel, deptType: e.target.value as Department['deptType'] })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal">
                  {DEPT_TYPES.filter((t) => t !== '공장' && t !== '영업소').map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="부서장">
                <select value={sel.headUserId ?? ''} onChange={(e) => setSel({ ...sel, headUserId: e.target.value || null })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-2 py-2 text-[12.5px] text-ink outline-none focus:border-teal">
                  <option value="">(미지정)</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept} · {u.position}</option>)}
                </select>
              </Field>
              <Field label="정렬순서"><input type="number" value={sel.order} onChange={(e) => setSel({ ...sel, order: Number(e.target.value) })} className="w-full rounded-lg border border-border-hi bg-panel-alt px-3 py-2 text-[13px] text-ink outline-none focus:border-teal" /></Field>
              {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setSel(null)} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
                <button onClick={save} disabled={upsert.isPending} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-[12px] text-ink3">부서를 선택하거나 추가하세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-bold text-ink2">{label}</span>{children}</label>;
}
