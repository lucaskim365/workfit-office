import { useMemo, useState } from 'react';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useEmployeeProfiles } from '@/features/employeeProfile/useEmployeeProfiles';
import type { User } from '@/domain/user/schema';
import { Button } from '@/shared/ui/Button';
import { EMERGENCY_CONTACTS, type EmergencyContact } from '@/data/emergencyContacts';


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
 * - [📞 비상연락망]: 공식 비상연락망 마스터코드·소속·직급·연락처·이메일 표
 */
export default function OrgChartScreen() {
  const org = useOrgTree();
  const { data: employeeProfiles = [] } = useEmployeeProfiles();
  const profileMap = useMemo(() => {
    return new Map(employeeProfiles.map((p) => [p.userId || p.id, p]));
  }, [employeeProfiles]);

  const [viewMode, setViewMode] = useState<'visual' | 'emergency'>('visual');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = org.users.find((u) => u.id === selectedUserId);
  const selectedProfile = selectedUserId ? profileMap.get(selectedUserId) : null;

  // 유효 부서 및 유효 사용자 목록
  const validDepts = useMemo(() => org.depts.filter((d) => !isExcludedDept(d.name)), [org.depts]);
  const validUsers = useMemo(
    () => org.users.filter((u) => u.status === '사용' && !isExcludedUser(u) && !isExcludedDept(u.dept)),
    [org.users],
  );

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

        {/* 2단 뷰 모드 전환 버튼 (비주얼 차트 / 비상연락망) */}
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
            onClick={() => setViewMode('emergency')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11.5px] font-bold transition-all ${
              viewMode === 'emergency'
                ? 'bg-panel text-teal shadow-xs'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📞</span> 비상연락망
          </button>
        </div>
      </div>

      {/* ── 1. 비주얼 차트 뷰 (엑셀 원본 스타일 다이어그램) ── */}
      {viewMode === 'visual' && (
        <div className="mt-5">
          <VisualDiagramOrgChart org={org} validUsers={validUsers} validDepts={validDepts} onSelectUserId={setSelectedUserId} />
        </div>
      )}


      {/* ── 2. 비상연락망 뷰 (공식 명단 16명 표출) ── */}
      {viewMode === 'emergency' && (
        <div className="mt-5">
          <EmergencyContactView />
        </div>
      )}


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
                🏢 {selectedUser.dept} · {selectedUser.position}
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
                    <span className="block text-[11px] text-ink3">업무 연락처</span>
                    {selectedUser.position.includes('대표') || selectedUser.dept === '대표이사' || selectedUser.dept.includes('위원회') ? (
                      <span className="mt-1 block font-mono text-[11px] text-ink3 italic">비공개</span>
                    ) : (
                      <span className="mt-1 block font-mono font-semibold text-ink">
                        {selectedProfile?.phone ? `📞 ${selectedProfile.phone}` : '—'}
                      </span>
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

/** ── 비상연락망 컴포넌트 ── */
function EmergencyContactView() {
  const [keyword, setKeyword] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<EmergencyContact | null>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return EMERGENCY_CONTACTS;
    return EMERGENCY_CONTACTS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.engName && c.engName.toLowerCase().includes(q)) ||
        (c.masterCode && c.masterCode.toLowerCase().includes(q)) ||
        c.department.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        (c.duty && c.duty.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [keyword]);

  const handleCopy = (text: string, label: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(`${label} 복사됨!`);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const handleExportCsv = () => {
    const headers = ['번호', '마스터코드', '이름', '영문이름', '소속', '직급', '연락처', '전자메일'];
    const rows = filtered.map((c) => [
      c.no,
      c.masterCode || '',
      c.name,
      c.engName || '',
      `"${c.department.replace(/"/g, '""')}"`,
      `"${c.position.replace(/"/g, '""')}"`,
      c.phone || '',
      c.email || '',
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `워크핏_비상연락망_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 툴바 & 검색 & 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-panel p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-soft text-xl text-teal shadow-xs">
            📞
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">전사 공식 비상연락망</h2>
              <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal font-mono">
                총 {EMERGENCY_CONTACTS.length}명
              </span>
            </div>
            <p className="text-[11.5px] text-ink3 mt-0.5">
              임직원의 프로필을 클릭하면 상세 비상연락 카드가 표시됩니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 복사 안내 알림 토스트 */}
          {copiedText && (
            <span className="rounded-lg bg-teal px-2.5 py-1 text-[11px] font-bold text-white shadow-xs animate-in fade-in">
              ✓ {copiedText}
            </span>
          )}

          {/* 검색 입력창 */}
          <div className="relative">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="이름, 부서, 직급, 연락처 검색..."
              className="h-9 w-60 rounded-xl border border-border bg-panel-alt/50 pl-3 pr-8 text-[12px] text-ink placeholder:text-ink3 outline-none focus:border-teal transition-colors"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink3 hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          {/* CSV 내보내기 & 인쇄 */}
          <Button size="sm" variant="secondary" onClick={handleExportCsv}>
            <span>📥 CSV 저장</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <span>🖨️ 인쇄</span>
          </Button>
        </div>
      </div>

      {/* ── 비상연락망 정통 표 ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-panel-alt/80 text-[11.5px] font-extrabold text-ink">
                <th className="py-3 px-3 text-center w-14">번호</th>
                <th className="py-3 px-3 text-center w-24">마스터코드</th>
                <th className="py-3 px-3 w-36">이름 (프로필)</th>
                <th className="py-3 px-3 w-32">영문이름</th>
                <th className="py-3 px-4 min-w-[220px]">소속</th>
                <th className="py-3 px-3 w-28">직급</th>
                <th className="py-3 px-4 w-40">연락처</th>
                <th className="py-3 px-4 w-52">전자메일</th>
                <th className="py-3 px-3 text-center w-20">카드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filtered.map((item) => {
                const isVacant = item.name === '(공석)';
                const isTopLeader = item.no <= 3;

                return (
                  <tr
                    key={item.no}
                    onClick={() => {
                      if (!isVacant) setSelectedContact(item);
                    }}
                    className={`transition-colors ${
                      isVacant
                        ? 'bg-panel-alt/10'
                        : isTopLeader
                        ? 'bg-panel-alt/30 hover:bg-teal-soft/20 cursor-pointer'
                        : 'hover:bg-teal-soft/15 cursor-pointer'
                    }`}
                  >
                    {/* 번호 */}
                    <td className="py-3 px-3 text-center font-mono text-[11.5px] text-ink3">
                      {item.no}
                    </td>

                    {/* 마스터코드 */}
                    <td className="py-3 px-3 text-center font-mono text-[11.5px] font-semibold text-ink2">
                      {item.masterCode || '—'}
                    </td>

                    {/* 이름 (프로필 아바타 클릭 지원) */}
                    <td className="py-3 px-3">
                      {isVacant ? (
                        <div className="flex items-center gap-2 text-ink3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-panel-alt border border-border text-xs">
                            👤
                          </span>
                          <span className="italic">{item.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <div
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-xs transition-transform group-hover:scale-110 ${
                              isTopLeader
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                : 'bg-gradient-to-br from-teal to-teal-dark'
                            }`}
                          >
                            {item.name[0]}
                          </div>
                          <div>
                            <span className="font-bold text-ink group-hover:text-teal group-hover:underline flex items-center gap-1">
                              {item.name}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 영문이름 */}
                    <td className="py-3 px-3 font-sans text-ink3 text-[11px]">
                      {item.engName || '—'}
                    </td>

                    {/* 소속 */}
                    <td className="py-3 px-4 text-ink">
                      {item.department.includes(' / ') ? (
                        <div className="space-y-0.5 leading-snug">
                          {item.department.split(' / ').map((dept, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-[10px] text-teal">▪</span>
                              <span className="font-semibold text-ink2">{dept}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="font-semibold text-ink2">{item.department}</span>
                      )}
                    </td>

                    {/* 직급 (및 직책) */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-ink">
                        <span>{item.position}</span>
                        {item.duty && item.duty !== item.position && (
                          <span className="ml-1 text-[11px] text-ink3 font-normal">
                            ({item.duty})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 연락처 */}
                    <td className="py-3 px-4 font-mono text-[11.5px]">
                      {item.phone ? (
                        <div className="flex items-center gap-1.5 group">
                          <a
                            href={`tel:${item.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-teal font-bold hover:underline"
                            title="전화 걸기"
                          >
                            {item.phone}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(item.phone!, '전화번호', e)}
                            title="전화번호 복사"
                            className="opacity-0 group-hover:opacity-100 p-1 text-[10px] text-ink3 hover:text-ink transition-opacity"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <span className="text-ink3 text-[11px] italic">비공개</span>
                      )}
                    </td>

                    {/* 전자메일 */}
                    <td className="py-3 px-4 font-mono text-[11.5px]">
                      {item.email ? (
                        <div className="flex items-center gap-1.5 group">
                          <a
                            href={`mailto:${item.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-ink2 hover:text-teal hover:underline"
                            title="이메일 작성"
                          >
                            {item.email}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(item.email!, '이메일', e)}
                            title="이메일 복사"
                            className="opacity-0 group-hover:opacity-100 p-1 text-[10px] text-ink3 hover:text-ink transition-opacity"
                          >
                            📋
                          </button>
                        </div>
                      ) : (
                        <span className="text-ink3 text-[11px] italic">비공개</span>
                      )}
                    </td>

                    {/* 카드 열기 버튼 */}
                    <td className="py-3 px-3 text-center">
                      {!isVacant && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContact(item);
                          }}
                          className="rounded-lg border border-border bg-panel-alt/60 px-2 py-1 text-[11px] font-bold text-ink2 hover:bg-teal hover:text-white hover:border-teal transition-all"
                        >
                          🪪 카드
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink3">
                    검색 조건과 일치하는 연락처 정보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 비상연락망 상세 프로필 카드 모달 ── */}
      {selectedContact && (
        <div
          onClick={() => setSelectedContact(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-panel text-left shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* 카드 상단 배너 */}
            <div className="relative h-28 bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 p-4">
              <div className="flex items-center justify-between text-white/90">
                <span className="text-[11px] font-mono tracking-wider font-semibold uppercase flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>WORKFIT EMERGENCY CONTACT</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedContact(null)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-black/30 text-xs font-bold text-white hover:bg-black/60 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 중앙 원형 프로필 아바타 */}
              <div className="absolute -bottom-10 left-6">
                <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-panel bg-gradient-to-br from-teal to-teal-dark text-3xl font-black text-white shadow-lg">
                  {selectedContact.name[0]}
                </div>
              </div>
            </div>

            {/* 카드 본문 영역 */}
            <div className="pt-12 px-6 pb-6 space-y-4">
              {/* 성명 & 직급 & 마스터코드 */}
              <div className="flex items-start justify-between gap-2 border-b border-border pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-ink">{selectedContact.name}</h3>
                    {selectedContact.engName && (
                      <span className="text-xs text-ink3 font-sans">({selectedContact.engName})</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-md bg-teal-soft px-2 py-0.5 text-xs font-bold text-teal">
                      {selectedContact.position}
                    </span>
                    {selectedContact.duty && selectedContact.duty !== selectedContact.position && (
                      <span className="rounded-md bg-panel-alt border border-border px-2 py-0.5 text-xs font-semibold text-ink2">
                        {selectedContact.duty}
                      </span>
                    )}
                  </div>
                </div>

                {selectedContact.masterCode && (
                  <div className="text-right shrink-0">
                    <span className="block text-[10px] text-ink3 font-mono">마스터코드</span>
                    <span className="rounded bg-panel-alt border border-border px-2 py-0.5 font-mono text-xs font-bold text-ink2">
                      #{selectedContact.masterCode}
                    </span>
                  </div>
                )}
              </div>

              {/* 소속 부서 목록 */}
              <div>
                <span className="block text-[11px] font-bold text-ink3 mb-1.5">소속 부서</span>
                <div className="space-y-1">
                  {selectedContact.department.split(' / ').map((dept: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl bg-panel-alt/50 border border-border/60 px-3 py-1.5 text-[12px] font-semibold text-ink"
                    >
                      <span className="text-teal text-xs">▪</span>
                      <span>{dept}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 주요 비상 연락처 */}
              <div className="space-y-2.5 rounded-2xl bg-teal-soft/20 border border-teal/20 p-4">
                {/* 전화번호 */}
                <div>
                  <span className="block text-[10.5px] font-bold text-teal-dark mb-1">
                    📱 휴대전화 (비상연락처)
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-base font-extrabold text-ink tracking-wide">
                      {selectedContact.phone || '연락처 비공개'}
                    </span>
                    {selectedContact.phone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${selectedContact.phone}`}
                          className="flex items-center gap-1 rounded-xl bg-teal px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-dark transition-colors"
                        >
                          <span>📞 통화</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(selectedContact.phone!, '전화번호', e)}
                          className="rounded-xl border border-border bg-panel px-2.5 py-1.5 text-xs font-bold text-ink2 hover:text-ink transition-colors"
                        >
                          복사
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 이메일 */}
                <div className="border-t border-teal/10 pt-2.5">
                  <span className="block text-[10.5px] font-bold text-teal-dark mb-1">
                    ✉️ 공식 업무 이메일
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12.5px] font-semibold text-ink truncate">
                      {selectedContact.email || '이메일 비공개'}
                    </span>
                    {selectedContact.email && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`mailto:${selectedContact.email}`}
                          className="flex items-center gap-1 rounded-xl border border-border bg-panel px-3 py-1 text-xs font-bold text-ink hover:text-teal transition-colors"
                        >
                          <span>✉️ 작성</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(selectedContact.email!, '이메일', e)}
                          className="rounded-xl border border-border bg-panel px-2.5 py-1 text-xs font-bold text-ink2 hover:text-ink transition-colors"
                        >
                          복사
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 안내 및 닫기 */}
              <div className="flex items-center justify-between pt-2 text-[11px] text-ink3">
                <span>※ 비상 상황 시 신속 보고 체계 준수</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedContact(null)}
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

