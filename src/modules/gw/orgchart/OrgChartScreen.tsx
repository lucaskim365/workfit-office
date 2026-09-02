import { useMemo, useState } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import type { User } from '@/domain/user/schema';
import { Button } from '@/shared/ui/Button';

/** 테스트 부서 및 테스트 계정 예외처리 */
const isExcludedUser = (user: User) =>
  user.dept.includes('테스트') ||
  user.name.includes('테스터') ||
  user.name.includes('테스트') ||
  user.name.includes('허진욱2') ||
  user.name === 'ㅎ테스터';

const isExcludedDept = (deptName: string) =>
  deptName.includes('테스트');

/**
 * 조직도 (그룹웨어)
 * - [📊 비주얼 차트]: 워크핏 공식 엑셀 조직도 스타일(피치/그린/블루 3열 격자 다이어그램)
 * - [📋 리스트로 보기]: 전사 임직원 직급·직책·부서·상급자·연락처 일괄 조회 및 검색 리스트
 */
export default function OrgChartScreen() {
  const org = useOrgTree();
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = org.users.find((u) => u.id === selectedUserId);

  // 리스트 뷰 필터 상태
  const [listDeptFilter, setListDeptFilter] = useState('all');
  const [listKeyword, setListKeyword] = useState('');

  // 유효 부서 및 유효 사용자 목록
  const validDepts = useMemo(() => org.depts.filter((d) => !isExcludedDept(d.name)), [org.depts]);
  const validUsers = useMemo(
    () => org.users.filter((u) => u.status === '사용' && !isExcludedUser(u) && !isExcludedDept(u.dept)),
    [org.users],
  );

  /** 리스트로 보기 필터링된 사원 목록 (대표이사 및 기술경영전략위원회는 연락처 비공개) */
  const listMembers = useMemo(() => {
    const text = listKeyword.trim().toLowerCase();
    return validUsers
      .filter((u) => (listDeptFilter === 'all' ? true : u.dept === listDeptFilter))
      .filter((u) => {
        if (!text) return true;
        return (
          u.name.toLowerCase().includes(text) ||
          u.dept.toLowerCase().includes(text) ||
          u.position.toLowerCase().includes(text) ||
          u.email.toLowerCase().includes(text)
        );
      })
      .sort((a, b) => {
        const rankDiff = org.rankOf(a.position) - org.rankOf(b.position);
        return rankDiff || a.name.localeCompare(b.name, 'ko');
      });
  }, [validUsers, org, listDeptFilter, listKeyword]);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      {/* 브레드크럼 + 타이틀 & 뷰 모드 탭 */}
      <div className="mb-1 text-xs font-medium text-ink3">
        그룹웨어 <span className="px-1">/</span> 조직도
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">🏢</span>
          <h1 className="text-xl font-bold text-ink">조직도</h1>
          <span className="ml-2 text-[12px] text-ink3">
            {validDepts.length}개 부서 · {validUsers.length}명
          </span>
        </div>

        {/* 2단 뷰 모드 전환 버튼 (비주얼 차트 / 리스트로 보기) */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-panel-alt/60 p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${
              viewMode === 'visual'
                ? 'bg-panel text-teal shadow-xs'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📊</span> 비주얼 차트
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${
              viewMode === 'list'
                ? 'bg-panel text-teal shadow-xs'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📋</span> 리스트로 보기
          </button>
        </div>
      </div>

      {/* ── 1. 비주얼 차트 뷰 (엑셀 원본 스타일 다이어그램) ── */}
      {viewMode === 'visual' && (
        <div className="mt-5">
          <VisualDiagramOrgChart org={org} validUsers={validUsers} validDepts={validDepts} onSelectUserId={setSelectedUserId} />
        </div>
      )}

      {/* ── 2. 리스트로 보기 뷰 ── */}
      {viewMode === 'list' && (
        <div className="mt-5 space-y-3">
          {/* 필터 툴바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-ink3">부서:</span>
              <select
                value={listDeptFilter}
                onChange={(e) => setListDeptFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-panel-alt/50 px-2.5 text-[11px] font-bold text-ink outline-none focus:border-teal/50"
              >
                <option value="all">전체 부서</option>
                {validDepts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={listKeyword}
                onChange={(e) => setListKeyword(e.target.value)}
                placeholder="이름, 직급, 부서, 이메일 검색..."
                className="h-8 w-60 rounded-lg border border-border bg-panel-alt/50 px-3 text-[11.5px] text-ink placeholder:text-ink3 outline-none focus:border-teal/50"
              />
              {listKeyword && (
                <button
                  type="button"
                  onClick={() => setListKeyword('')}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-ink3 hover:text-ink"
                >
                  초기화
                </button>
              )}
            </div>
          </div>

          {/* 사원 리스트 테이블 */}
          <div className="overflow-hidden rounded-xl border border-border bg-panel shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/60 text-[10.5px] font-extrabold text-ink2">
                    <th className="p-3">성명</th>
                    <th className="p-3">부서</th>
                    <th className="p-3">직급 / 직책</th>
                    <th className="p-3">업무 이메일</th>
                    <th className="p-3">직속 상급자</th>
                    <th className="p-3 text-center">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {listMembers.map((u) => {
                    const manager = org.directManagerOf(u.id);
                    const isPrivate = u.position.includes('대표') || u.dept === '대표이사' || u.dept.includes('위원회');
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-panel-alt/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedUserId(u.id)}
                      >
                        <td className="p-3 font-bold text-ink flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-teal-soft text-[10px] font-extrabold text-teal">
                            {u.name[0]}
                          </span>
                          <span>{u.name}</span>
                        </td>
                        <td className="p-3 font-semibold text-teal">{u.dept}</td>
                        <td className="p-3 text-ink2">
                          {u.position} {u.jobTitle && <span className="text-ink3">({u.jobTitle})</span>}
                        </td>
                        <td className="p-3 font-mono text-ink2">
                          {isPrivate ? (
                            <span className="italic text-ink3 text-[10.5px]">비공개</span>
                          ) : (
                            <a
                              href={`mailto:${u.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-teal hover:underline"
                            >
                              ✉ {u.email}
                            </a>
                          )}
                        </td>
                        <td className="p-3 text-ink3">{manager?.name ? `↑ ${manager.name} (${manager.position || manager.jobTitle || '부서장'})` : '—'}</td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUserId(u.id);
                            }}
                          >
                            상세 정보
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {listMembers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-ink3">
                        검색 조건에 일치하는 임직원이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 임직원 상세 모달 */}
      {selectedUserId && selectedUser && (
        <>
          <div
            onClick={() => setSelectedUserId(null)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-0 z-50 m-auto flex h-[460px] w-[700px] max-h-[90vh] max-w-[95vw] overflow-hidden rounded-3xl border border-border bg-panel text-left shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* 좌측 프로필 카드 영역 */}
            <div className="flex w-[230px] shrink-0 select-none flex-col items-center justify-between border-r border-border bg-gradient-to-b from-teal-soft/10 to-panel-alt/5 p-6">
              <div className="mt-4 flex w-full flex-col items-center">
                <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-panel bg-teal text-3xl font-black text-white shadow-md">
                  {selectedUser.name[0]}
                </div>

                <div className="mt-3.5 text-center text-base font-extrabold text-ink">
                  {selectedUser.name}
                </div>
                <div className="mt-1 rounded border border-border bg-panel-alt px-2 py-0.5 font-mono text-[10px] font-bold text-ink2">
                  사번: {selectedUser.position.includes('대표') || selectedUser.dept === '대표이사' || selectedUser.dept.includes('위원회') ? '비공개' : (selectedUser.empNo || '-')}
                </div>

                <div className="mt-4 space-y-1 text-center">
                  <div className="text-xs font-bold text-teal">{selectedUser.dept}</div>
                  <div className="text-[11px] font-semibold text-ink3">
                    {selectedUser.position} {selectedUser.jobTitle && `· ${selectedUser.jobTitle}`}
                  </div>
                </div>
              </div>

              <div className="w-full rounded-xl border border-border/40 bg-panel-alt/20 py-2 text-center text-[10.5px] text-ink3">
                🏢 {selectedUser.roleGroup === 'ADMIN' ? '시스템 관리자' : selectedUser.roleGroup === 'OPERATOR' ? '운영 담당자' : '일반 사용자'}
              </div>
            </div>

            {/* 우측 상세정보 영역 */}
            <div className="flex flex-1 flex-col justify-between overflow-hidden bg-panel">
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-panel-alt/5 p-3.5">
                <span className="text-[12px] font-extrabold text-ink">임직원 상세 정보</span>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded px-2 py-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6 text-[12px]">
                <h2 className="flex items-center gap-1.5 border-b border-border pb-2 text-sm font-extrabold text-ink">
                  <span>💼</span> 인사 및 소속 정보
                </h2>

                <div className="grid grid-cols-2 gap-x-3.5 gap-y-4">
                  <div>
                    <span className="block text-[11px] text-ink3">성명</span>
                    <span className="mt-1 block font-semibold text-ink">{selectedUser.name}</span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-ink3">소속 부서</span>
                    <span className="mt-1 block font-semibold text-ink">{selectedUser.dept}</span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-ink3">직급 / 직책</span>
                    <span className="mt-1 block font-semibold text-ink">
                      {selectedUser.position} {selectedUser.jobTitle && `(${selectedUser.jobTitle})`}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-ink3">업무 이메일</span>
                    {selectedUser.position.includes('대표') || selectedUser.dept === '대표이사' || selectedUser.dept.includes('위원회') ? (
                      <span className="mt-1 block font-mono text-[11px] text-ink3 italic">비공개</span>
                    ) : (
                      <a
                        href={`mailto:${selectedUser.email}`}
                        className="mt-1 block font-mono font-semibold text-teal hover:underline break-all"
                      >
                        ✉ {selectedUser.email || '-'}
                      </a>
                    )}
                  </div>

                  <div>
                    <span className="block text-[11px] text-ink3">계정 상태</span>
                    <span
                      className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        selectedUser.status === '사용'
                          ? 'border-teal/20 bg-teal-soft/20 text-teal'
                          : 'border-border bg-panel-alt text-ink3'
                      }`}
                    >
                      {selectedUser.status}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-ink3">직속 상급자</span>
                    <span className="mt-1 block font-semibold text-ink">
                      {(() => {
                        const mgr = org.directManagerOf(selectedUser.id);
                        if (!mgr) return '—';
                        return `${mgr.name} (${mgr.position || mgr.jobTitle || '부서장'})`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end border-t border-border bg-panel-alt/10 p-4">
                <Button size="sm" onClick={() => setSelectedUserId(null)}>
                  닫기
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** ── 워크핏 공식 엑셀 조직도 스타일 비주얼 다이어그램 (실제 DB 데이터 동적 매핑) ── */
function VisualDiagramOrgChart({
  org,
  validUsers,
  validDepts,
  onSelectUserId,
}: {
  org: ReturnType<typeof useOrgTree>;
  validUsers: User[];
  validDepts: ReturnType<typeof useOrgTree>['depts'];
  onSelectUserId: (id: string) => void;
}) {
  // 1. 대표이사 / 최고경영진 (실제 DB에서 직급/부서 매칭)
  const ceoUser = validUsers.find((u) => u.position.includes('대표') || u.dept === '대표이사') ?? validUsers[0];

  // 2. 직속 부서 및 위원회 (대표이사 직속, 기술경영전략위원회, 경영기획팀 등)
  const committeeDept = validDepts.find((d) => d.name.includes('위원회'));
  const committeeMembers = validUsers.filter((u) => u.dept === committeeDept?.name);

  const labDept = validDepts.find((d) => d.name.includes('연구소'));
  const labMembers = validUsers.filter((u) => u.dept === labDept?.name);

  const planningDept = validDepts.find((d) => d.name.includes('경영기획'));
  const planningMembers = validUsers.filter((u) => u.dept === planningDept?.name);

  // 3. 주력 본부 (AX지능화본부 또는 사업본부)
  const hqDept = validDepts.find((d) => d.name.includes('본부')) ?? validDepts[0];
  const hqHead = validUsers.find((u) => u.id === hqDept?.headUserId || (u.dept === hqDept?.name && u.jobTitle.includes('본부장'))) ?? null;

  // 4. 하위 팀 목록 (본부 산하 팀들 또는 일반 팀들)
  const teamDepts = validDepts.filter(
    (d) =>
      d.name !== '대표이사' &&
      d.name !== '대표이사 직속' &&
      !d.name.includes('위원회') &&
      !d.name.includes('연구소') &&
      !d.name.includes('경영기획') &&
      !d.name.includes('본부') &&
      !isExcludedDept(d.name),
  );

  return (
    <div className="rounded-2xl border border-border bg-panel p-6 shadow-sm overflow-x-auto">
      {/* 엑셀 차트 메타 헤더 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-ink tracking-tight">워크핏 조직도</span>
          <span className="rounded bg-teal-soft px-2 py-0.5 text-[10.5px] font-bold text-teal">공식 조직 체계</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ink2">
          <div className="rounded border border-border bg-panel-alt px-2.5 py-1">
            <span className="text-ink3 mr-1.5 font-semibold">총원</span>
            <span className="font-extrabold text-teal">{validUsers.length}명</span>
          </div>
          <div className="rounded border border-border bg-panel-alt px-2.5 py-1">
            <span className="text-ink3 mr-1.5 font-semibold">부서수</span>
            <span className="font-mono font-bold text-ink">{validDepts.length}개</span>
          </div>
        </div>
      </div>

      {/* 엑셀 스타일 다이어그램 바디 (실제 DB 데이터 렌더링) */}
      <div className="min-w-[920px] flex flex-col items-center select-none">
        {/* 1. 최상위 대표이사 박스 (피치 핑크 #FCE4D6) */}
        {ceoUser && (
          <div className="flex flex-col items-center">
            <div className="overflow-hidden rounded-md border border-[#DFA89B] shadow-xs">
              <table className="border-collapse text-center text-[11px] font-bold">
                <tbody>
                  <tr className="bg-[#FCE4D6] text-slate-800">
                    <td className="border-r border-[#DFA89B] px-4 py-1.5">등기임원</td>
                    <td className="border-r border-[#DFA89B] px-4 py-1.5">{ceoUser.position}</td>
                    <td
                      onClick={() => onSelectUserId(ceoUser.id)}
                      className="cursor-pointer px-6 py-1.5 text-slate-900 font-extrabold hover:bg-white/40 transition-colors"
                    >
                      {ceoUser.name}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 중앙 수직선 1 */}
            <div className="h-5 w-px bg-slate-400" />
          </div>
        )}

        {/* 2. 중앙 척추 섹션: 기술경영전략위원회 + 우측 분기(연구소, 기획팀) */}
        <div className="relative w-full max-w-[860px] flex flex-col items-center">
          {/* 기술경영전략위원회 박스 (그린 #E2EFDA) */}
          <div className="overflow-hidden rounded-md border border-[#A9D18E] shadow-xs">
            <div className="bg-[#E2EFDA] border-b border-[#A9D18E] py-1 px-4 text-center text-[11px] font-extrabold text-slate-800">
              {committeeDept?.name ?? '기술경영전략위원회'}
            </div>
            <table className="border-collapse text-center text-[10.5px]">
              <tbody className="divide-y divide-[#A9D18E]/60 bg-white/60 dark:bg-panel">
                {committeeMembers.length > 0 ? (
                  committeeMembers.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => onSelectUserId(m.id)}
                      className="cursor-pointer hover:bg-teal-soft/30 transition-colors"
                    >
                      <td className="border-r border-[#A9D18E] px-3.5 py-1 text-slate-700">{m.jobTitle || '위원'}</td>
                      <td className="border-r border-[#A9D18E] px-3.5 py-1 text-slate-600">{m.position}</td>
                      <td className="px-5 py-1 font-bold text-slate-900">{m.name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-2 text-ink3 text-[10px] italic">
                      소속 인원 없음
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 중앙 연결 척추선 & 우측 분기선 영역 */}
          <div className="relative w-full h-44 flex justify-center">
            {/* 중앙 수직 척추선 */}
            <div className="h-full w-px bg-slate-400" />

            {/* 우측 1차 분기선 ➔ 부설기술연구소 */}
            <div className="absolute top-6 left-1/2 w-28 h-px bg-slate-400" />
            <div className="absolute top-1 left-[calc(50%+112px)]">
              <div className="overflow-hidden rounded-md border border-[#A9D18E] shadow-xs">
                <div className="bg-[#E2EFDA] border-b border-[#A9D18E] py-0.5 px-3 text-center text-[10.5px] font-extrabold text-slate-800">
                  {labDept?.name ?? '부설기술연구소'} ({labMembers.length}명)
                </div>
                <table className="border-collapse text-center text-[10px]">
                  <tbody className="divide-y divide-[#A9D18E]/60 bg-white/60 dark:bg-panel">
                    {labMembers.length > 0 ? (
                      labMembers.map((m) => (
                        <tr
                          key={m.id}
                          onClick={() => onSelectUserId(m.id)}
                          className="cursor-pointer hover:bg-teal-soft/30 transition-colors"
                        >
                          <td className="border-r border-[#A9D18E] px-2.5 py-0.5 text-slate-700">{m.jobTitle || '연구원'}</td>
                          <td className="border-r border-[#A9D18E] px-2.5 py-0.5 text-slate-600">{m.position}</td>
                          <td className="px-3.5 py-0.5 font-bold text-slate-900">{m.name}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-ink3 text-[10px] italic">
                          소속 인원 없음
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 우측 2차 분기선 ➔ 경영기획팀 */}
            <div className="absolute top-28 left-1/2 w-28 h-px bg-slate-400" />
            <div className="absolute top-23 left-[calc(50%+112px)]">
              <div className="overflow-hidden rounded-md border border-[#A9D18E] shadow-xs">
                <div className="bg-[#E2EFDA] border-b border-[#A9D18E] py-0.5 px-3 text-center text-[10.5px] font-extrabold text-slate-800">
                  {planningDept?.name ?? '경영기획팀'} ({planningMembers.length}명)
                </div>
                <table className="border-collapse text-center text-[10px]">
                  <tbody className="divide-y divide-[#A9D18E]/60 bg-white/60 dark:bg-panel">
                    {planningMembers.length > 0 ? (
                      planningMembers.map((m) => (
                        <tr
                          key={m.id}
                          onClick={() => onSelectUserId(m.id)}
                          className="cursor-pointer hover:bg-teal-soft/30 transition-colors"
                        >
                          <td className="border-r border-[#A9D18E] px-2.5 py-0.5 text-slate-700">{m.jobTitle || '팀원'}</td>
                          <td className="border-r border-[#A9D18E] px-2.5 py-0.5 text-slate-600">{m.position}</td>
                          <td className="px-3.5 py-0.5 font-bold text-slate-900">{m.name}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-ink3 text-[10px] italic">
                          소속 인원 없음
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 3. AX지능화본부 헤더 박스 (스카이블루 #DDEBF7, 인원수 표시 제외) */}
        {hqDept && (
          <div className="flex flex-col items-center">
            <div className="overflow-hidden rounded-md border border-[#8EA9DB] shadow-xs">
              <div className="bg-[#DDEBF7] border-b border-[#8EA9DB] py-1 px-8 text-center text-[11px] font-extrabold text-slate-800">
                {hqDept.name}
              </div>
              {hqHead && (
                <table className="border-collapse text-center text-[10.5px]">
                  <tbody className="bg-white/60 dark:bg-panel">
                    <tr
                      onClick={() => onSelectUserId(hqHead.id)}
                      className="cursor-pointer hover:bg-teal-soft/30 transition-colors"
                    >
                      <td className="border-r border-[#8EA9DB] px-4 py-1 text-slate-700 font-semibold">{hqHead.jobTitle || '본부장'}</td>
                      <td className="border-r border-[#8EA9DB] px-4 py-1 text-slate-600">{hqHead.position}</td>
                      <td className="px-6 py-1 font-extrabold text-slate-900">{hqHead.name}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* 본부 아래 수직 연결선 */}
            <div className="h-6 w-px bg-slate-400" />
          </div>
        )}

        {/* 4. 산하 팀들 수평 분기선 & 하위 팀 박스들 (실제 DB에 등록된 팀 목록) */}
        <div className="relative w-full max-w-[960px] pt-4">
          {/* 수평 분기선 */}
          {teamDepts.length > 1 && (
            <div className="absolute top-0 left-[11%] right-[11%] h-px bg-slate-400" />
          )}

          {/* 팀 목록 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 items-start">
            {teamDepts.map((d) => {
              const teamMembers = validUsers
                .filter((u) => u.dept === d.name)
                .sort((a, b) => org.rankOf(a.position) - org.rankOf(b.position) || a.name.localeCompare(b.name, 'ko'));

              return (
                <div key={d.id} className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-400 -mt-4 mb-0" />
                  <div className="w-full overflow-hidden rounded-md border border-[#8EA9DB] shadow-xs">
                    <div className="bg-[#DDEBF7] border-b border-[#8EA9DB] py-1 px-1.5 text-center text-[10.5px] font-extrabold text-slate-800">
                      {d.name} ({teamMembers.length}명)
                    </div>
                    <table className="w-full border-collapse text-center text-[10px]">
                      <tbody className="divide-y divide-[#8EA9DB]/60 bg-white/60 dark:bg-panel">
                        {teamMembers.length > 0 ? (
                          teamMembers.map((m) => (
                            <tr
                              key={m.id}
                              onClick={() => onSelectUserId(m.id)}
                              className="cursor-pointer hover:bg-teal-soft/30 transition-colors"
                            >
                              <td className="border-r border-[#8EA9DB] py-1 text-slate-700">{m.jobTitle || '팀원'}</td>
                              <td className="border-r border-[#8EA9DB] py-1 text-slate-600">{m.position}</td>
                              <td className="py-1 font-bold text-slate-900">{m.name}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="py-2 text-ink3 italic">
                              소속 인원 없음
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
