import { useEffect, useMemo, useState } from 'react';
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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = org.users.find((u) => u.id === selectedUserId);

  // 최초 로드 시 모든 부서 전체 펼침 + 첫 팀 선택.
  useEffect(() => {
    if (org.depts.length > 0) {
      setOpenIds(new Set(org.depts.map((d) => d.id)));
    }
    if (org.roots.length > 0 && !selId) {
      const firstTeam = org.roots[0]?.children[0]?.dept.id ?? org.roots[0]?.dept.id ?? null;
      setSelId(firstTeam);
    }
  }, [org.depts, org.roots, selId]);

  const expandAll = () => setOpenIds(new Set(org.depts.map((d) => d.id)));
  const collapseAll = () => setOpenIds(new Set());

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
    return list.filter((m) => [m.name, m.position, m.jobTitle].some((v) => v.toLowerCase().includes(kw)));
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
          <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5 px-1 pt-0.5">
            <span className="text-[11px] font-bold text-ink2">부서 목록</span>
            <div className="flex items-center gap-1.5 text-[10.5px]">
              <button type="button" onClick={expandAll} className="px-1.5 py-0.5 rounded hover:bg-teal-soft text-teal font-semibold transition-colors">전체 펼치기</button>
              <span className="text-ink3">·</span>
              <button type="button" onClick={collapseAll} className="px-1.5 py-0.5 rounded hover:bg-panel-alt text-ink3 hover:text-ink transition-colors">전체 접기</button>
            </div>
          </div>
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
              <MemberCard 
                key={m.id} 
                user={m} 
                manager={org.userById(m.managerId)} 
                isHead={selNode?.dept.headUserId === m.id} 
                onClick={() => setSelectedUserId(m.id)}
              />
            ))}
            {members.length === 0 && (
              <div className="col-span-full py-10 text-center text-[12px] text-ink3">
                {selNode ? '해당 부서에 표시할 사원이 없습니다.' : '왼쪽에서 부서를 선택하세요.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 임직원 상세 모달 (읽기전용, 개인신상 제외) */}
      {selectedUserId && selectedUser && (
        <>
          {/* 백드롭 오버레이 */}
          <div
            onClick={() => setSelectedUserId(null)}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-0 m-auto h-[440px] w-[720px] max-w-[95vw] max-h-[90vh] shadow-2xl z-50 bg-panel border border-border rounded-3xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* 좌측 프로필 카드 영역 */}
            <div className="w-[240px] shrink-0 bg-gradient-to-b from-teal-soft/10 to-panel-alt/5 border-r border-border p-6 flex flex-col items-center justify-between select-none">
              <div className="w-full flex flex-col items-center mt-4">
                {/* 대형 프로필 이니셜 아바타 */}
                <div className="grid h-22 w-22 place-items-center rounded-full bg-teal text-white text-3xl font-black shadow-md border-3 border-panel">
                  {selectedUser.name[0]}
                </div>
                
                {/* 임직원 핵심 성명/사번/직위 정보 */}
                <div className="text-base font-extrabold text-ink mt-4 text-center">
                  {selectedUser.name}
                </div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-panel-alt text-ink2 font-mono mt-1.5">
                  {selectedUser.empNo || '-'}
                </div>

                <div className="mt-5 text-center space-y-1">
                  <div className="text-xs font-bold text-teal">
                    {selectedUser.dept}
                  </div>
                  <div className="text-[11px] font-semibold text-ink3">
                    {selectedUser.position} {selectedUser.jobTitle && `· ${selectedUser.jobTitle}`}
                  </div>
                </div>
              </div>

              {/* 하단 기본 권한 정보 표시 */}
              <div className="w-full text-center py-2.5 px-3 rounded-xl bg-panel-alt/20 border border-border/40 text-[10.5px] text-ink3 leading-relaxed">
                🏢 {selectedUser.roleGroup === 'ADMIN' ? '시스템 관리자' : selectedUser.roleGroup === 'OPERATOR' ? '운영 담당자' : '일반 사용자'}
              </div>
            </div>

            {/* 우측 상세정보 영역 */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-panel">
              {/* 모달 닫기 헤더 */}
              <div className="p-3.5 border-b border-border bg-panel-alt/5 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-ink3 hover:text-ink font-bold text-sm px-2 py-1 rounded hover:bg-panel-alt transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 모달 본문 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[12px]">
                <h2 className="text-sm font-extrabold text-ink flex items-center gap-1.5 border-b border-border pb-2">
                  <span>💼</span> 인사 및 소속 정보
                </h2>

                <div className="grid grid-cols-2 gap-y-4 gap-x-3.5">
                  <div>
                    <span className="text-ink3 text-[11px] block">성명</span>
                    <span className="font-semibold text-ink mt-1 block">{selectedUser.name}</span>
                  </div>

                  <div>
                    <span className="text-ink3 text-[11px] block">소속 부서</span>
                    <span className="font-semibold text-ink mt-1 block">{selectedUser.dept}</span>
                  </div>

                  <div>
                    <span className="text-ink3 text-[11px] block">직급 / 직책</span>
                    <span className="font-semibold text-ink mt-1 block">
                      {selectedUser.position} {selectedUser.jobTitle && `(${selectedUser.jobTitle})`}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink3 text-[11px] block">업무 이메일</span>
                    <span className="font-semibold text-ink mt-1 block font-mono break-all">{selectedUser.email || '-'}</span>
                  </div>

                  <div>
                    <span className="text-ink3 text-[11px] block">계정 상태</span>
                    <span className={`font-bold mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] border ${
                      selectedUser.status === '사용'
                        ? 'bg-teal-soft/20 border-teal/20 text-teal'
                        : 'bg-panel-alt border-border text-ink3'
                    }`}>
                      {selectedUser.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink3 text-[11px] block">직속 상급자</span>
                    <span className="font-semibold text-ink mt-1 block">
                      {org.userById(selectedUser.managerId)?.name || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 모달 하단 버튼 바 */}
              <div className="p-4 border-t border-border bg-panel-alt/10 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded-lg border px-5 py-2 font-bold text-ink2 hover:bg-panel-alt text-[11.5px]"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
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
function MemberCard({ 
  user, manager, isHead, onClick 
}: { 
  user: User; manager: User | undefined; isHead: boolean; onClick?: () => void 
}) {
  return (
    <div 
      onClick={onClick}
      className="rounded-xl border border-border bg-panel-alt px-3 py-2.5 cursor-pointer hover:border-teal/30 hover:shadow-xs transition-all select-none"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-[13px] font-bold text-teal">{user.name[0]}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-bold text-ink">{user.name}</span>
            {isHead && <span className="shrink-0 rounded bg-teal/15 px-1.5 py-px text-[9px] font-bold text-teal">부서장</span>}
          </div>
          <div className="text-[11px] text-ink3">{user.jobTitle ? `${user.jobTitle} · ${user.position}` : user.position}</div>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 text-[10.5px] text-ink3">
        <div className="truncate">✉ {user.email}</div>
        <div>↑ 상급자: {manager?.name ?? '—'}</div>
      </div>
    </div>
  );
}
