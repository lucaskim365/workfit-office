import { useMemo, useState } from 'react';
import { useOrgTree, type OrgNode } from '@/features/gw/useOrgTree';
import type { User } from '@/domain/user/schema';

/**
 * 조직도 (그룹웨어) — 부서 트리(좌) + 선택 부서 사원(우).
 * 부서·사용자·상급자 체인은 useOrgTree 파생. 전자결재 결재선의 조직 데이터 토대.
 * 전용 와이어프레임 부재 → 기존 마스터-디테일 디자인 언어로 신규 구성([[wireframe-source-of-truth]]).
 */
export default function OrgChartScreen() {
  const org = useOrgTree();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selId, setSelId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  // 최초 로드 시 최상위 부서 펼침 + 첫 팀 선택.
  const initReady = org.roots.length > 0;
  useMemo(() => {
    if (!initReady || selId) return;
    setOpenIds(new Set(org.roots.map((r) => r.dept.id)));
    const firstTeam = org.roots[0]?.children[0]?.dept.id ?? org.roots[0]?.dept.id ?? null;
    setSelId(firstTeam);
  }, [initReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const selNode = useMemo(() => {
    if (!selId) return null;
    const find = (nodes: OrgNode[]): OrgNode | null => {
      for (const n of nodes) {
        if (n.dept.id === selId) return n;
        const c = find(n.children);
        if (c) return c;
      }
      return null;
    };
    return find(org.roots);
  }, [selId, org.roots]);

  const kw = q.trim().toLowerCase();
  const members = useMemo(() => {
    const list = selNode?.members ?? [];
    if (!kw) return list;
    return list.filter((m) => m.name.toLowerCase().includes(kw) || m.position.toLowerCase().includes(kw));
  }, [selNode, kw]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl">
      {/* 브레드크럼 + 타이틀 */}
      <div className="mb-1 text-xs font-medium text-ink3">그룹웨어 <span className="px-1">/</span> 조직도</div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">🏢</span>
        <h1 className="text-xl font-bold text-ink">조직도</h1>
        <span className="ml-2 text-[12px] text-ink3">{org.depts.length}개 부서 · {org.users.length}명</span>
      </div>

      <div className="mt-5 grid grid-cols-[300px_1fr] gap-4">
        {/* 좌: 부서 트리 */}
        <div className="rounded-xl border border-border bg-panel p-2">
          {org.roots.map((n) => (
            <DeptRow key={n.dept.id} node={n} depth={0} openIds={openIds} selId={selId} onToggle={toggle} onSelect={setSelId} />
          ))}
          {org.roots.length === 0 && <div className="p-6 text-center text-[12px] text-ink3">부서 데이터가 없습니다.</div>}
        </div>

        {/* 우: 선택 부서 사원 */}
        <div className="rounded-xl border border-border bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-ink">{selNode?.dept.name ?? '부서를 선택하세요'}</div>
              {selNode && (
                <div className="mt-0.5 text-[11px] text-ink3">
                  부서장: {org.userById(selNode.dept.headUserId)?.name ?? '미지정'} · 인원 {selNode.members.length}명
                </div>
              )}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름·직책 검색"
              className="w-44 rounded-lg border border-border-hi bg-panel-alt px-3 py-1.5 text-[12px] text-ink outline-none focus:border-teal"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-4 lg:grid-cols-3">
            {members.map((m) => (
              <MemberCard key={m.id} user={m} manager={org.userById(m.managerId)} isHead={selNode?.dept.headUserId === m.id} />
            ))}
            {members.length === 0 && (
              <div className="col-span-full py-10 text-center text-[12px] text-ink3">
                {selNode ? '해당 부서에 표시할 사원이 없습니다.' : '왼쪽에서 부서를 선택하세요.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 부서 트리 행(재귀). */
function DeptRow({
  node, depth, openIds, selId, onToggle, onSelect,
}: {
  node: OrgNode; depth: number; openIds: Set<string>; selId: string | null;
  onToggle: (id: string) => void; onSelect: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = openIds.has(node.dept.id);
  const selected = selId === node.dept.id;
  const count = node.members.length;

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 pr-2 text-[12.5px] ${selected ? 'bg-teal-soft font-bold text-teal' : 'text-ink hover:bg-panel-alt'}`}
        style={{ paddingLeft: 6 + depth * 16 }}
        onClick={() => onSelect(node.dept.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.dept.id); }}
            className="grid h-4 w-4 shrink-0 place-items-center text-[10px] text-ink3"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{node.dept.name}</span>
        {count > 0 && <span className="ml-auto shrink-0 text-[10px] text-ink3">{count}</span>}
      </div>
      {hasChildren && open && node.children.map((c) => (
        <DeptRow key={c.dept.id} node={c} depth={depth + 1} openIds={openIds} selId={selId} onToggle={onToggle} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** 사원 카드. */
function MemberCard({ user, manager, isHead }: { user: User; manager: User | undefined; isHead: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-panel-alt px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-[13px] font-bold text-teal">{user.name[0]}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-bold text-ink">{user.name}</span>
            {isHead && <span className="shrink-0 rounded bg-teal/15 px-1.5 py-px text-[9px] font-bold text-teal">부서장</span>}
          </div>
          <div className="text-[11px] text-ink3">{user.position}</div>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 text-[10.5px] text-ink3">
        <div className="truncate">✉ {user.email}</div>
        <div>↑ 상급자: {manager?.name ?? '—'}</div>
      </div>
    </div>
  );
}
