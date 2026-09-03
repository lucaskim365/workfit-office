import { useState, useMemo } from 'react';
import { usePermission } from '@/features/auth/usePermission';
import { useUsers } from '@/features/user/useUsers';
import { useEmployeeProfiles, useUpsertEmployeeProfile } from '@/features/employeeProfile/useEmployeeProfiles';
import { useDepartments } from '@/features/department/useDepartments';
import { usePositions } from '@/features/position/usePositions';
import { useJobTitles } from '@/features/jobTitle/useJobTitles';
import type { EmploymentStatus } from '@/domain/employee/schema';

interface OrgNode {
  id: string;
  name: string;
  leaf?: boolean;
  children?: OrgNode[];
}

export default function EmployeeScreen() {
  const { isAdmin } = usePermission();
  const { data: users = [], isLoading: isUsersLoading } = useUsers();
  const { data: employeeProfiles = [] } = useEmployeeProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions();
  const { data: jobTitles = [] } = useJobTitles();
  const upsertEmployeeProfile = useUpsertEmployeeProfile();

  // 대분류 탭: 'list' (임직원 관리) | 'org' (조직도)
  const [activeTab, setActiveTab] = useState<'list' | 'org'>('list');

  // 필터 및 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [posFilter, setPosFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 기본 재직자만 보기

  // 상세 보기 및 편집 대상
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 조직도 선택 부서 상태
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // 신규 등록 폼 상태 (사용자 관리 연동)
  const [selectedCreateUserId, setSelectedCreateUserId] = useState('');
  const [newEmpNo, setNewEmpNo] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('');
  const [newEmpPos, setNewEmpPos] = useState('');
  const [newEmpDuty, setNewEmpDuty] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpHireDate, setNewEmpHireDate] = useState('');
  const [newEmpRrn, setNewEmpRrn] = useState('');
  const [newEmpAddress, setNewEmpAddress] = useState('');
  const [newEmpPersonalEmail, setNewEmpPersonalEmail] = useState('');
  const [newEmpEmergencyPhone, setNewEmpEmergencyPhone] = useState('');
  const [newEmpEducation, setNewEmpEducation] = useState('');

  // 발령 대상 계정 선택 핸들러
  const handleSelectCreateUser = (userId: string) => {
    setSelectedCreateUserId(userId);
    const u = users.find((user) => user.id === userId);
    if (!u) {
      setNewEmpNo('');
      setNewEmpName('');
      setNewEmpEmail('');
      return;
    }
    setNewEmpNo(u.empNo);
    setNewEmpName(u.name);
    setNewEmpEmail(u.email);
    setNewEmpDept(u.dept && u.dept !== '미지정' ? u.dept : departments[0]?.name || '인사지원팀');
    setNewEmpPos(u.position && u.position !== '사원' ? u.position : positions[0]?.name || '사원');
    setNewEmpDuty(u.jobTitle || '팀원');
    setNewEmpPhone((u as any).phone || '');
    setNewEmpHireDate((u as any).hireDate || '');
    setNewEmpRrn((u as any).rrn || '');
    setNewEmpAddress((u as any).address || '');
    setNewEmpPersonalEmail((u as any).personalEmail || '');
    setNewEmpEmergencyPhone((u as any).emergencyPhone || '');
    setNewEmpEducation((u as any).education || '');
  };

  // 정보 수정 폼 상태
  const [editModalTab, setEditModalTab] = useState<'work' | 'personal'>('work');
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpDept, setEditEmpDept] = useState('');
  const [editEmpPos, setEditEmpPos] = useState('');
  const [editEmpDuty, setEditEmpDuty] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpHireDate, setEditEmpHireDate] = useState('');
  const [editEmpStatus, setEditEmpStatus] = useState<EmploymentStatus>('ACTIVE');
  const [editEmpRrn, setEditEmpRrn] = useState('');
  const [editEmpBirthDate, setEditEmpBirthDate] = useState('');
  const [editEmpGender, setEditEmpGender] = useState('');
  const [editEmpAddress, setEditEmpAddress] = useState('');
  const [editEmpPersonalEmail, setEditEmpPersonalEmail] = useState('');
  const [editEmpEmergencyPhone, setEditEmpEmergencyPhone] = useState('');
  const [editEmpEducation, setEditEmpEducation] = useState('');

  // 상세 보기 Drawer 내의 탭 상태 ('work': 인사/소속 | 'personal': 개인/신상)
  const [detailTab, setDetailTab] = useState<'work' | 'personal'>('work');
  const [showRrn, setShowRrn] = useState(false);

  // 조직도 노드 접힘 상태 관리
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // DB employeeProfiles 목록을 임직원 인터페이스로 어댑팅 (users 컬렉션과 매핑 및 폴백)
  const employees = useMemo(() => {
    const profileMap = new Map(employeeProfiles.map((p) => [p.userId || p.id, p]));

    return users.map((u) => {
      const p = profileMap.get(u.id);
      const employmentStatus: EmploymentStatus =
        p?.status || (u.status === '사용' ? 'ACTIVE' : u.status === '잠금' ? 'LEAVE' : 'RETIRED');
      return {
        id: p?.id || u.id,
        employeeNo: p?.empNo || u.empNo || u.id,
        name: p?.name || u.name,
        userId: u.id,
        dept: p?.dept || u.dept || '미지정',
        position: p?.position || u.position || '사원',
        duty: p?.jobTitle || u.jobTitle || '팀원',
        email: u.email || '',
        phone: p?.phone || (u as any).phone || '',
        profileImage: u.photoUrl || '',
        hireDate: p?.hireDate || (u as any).hireDate || '',
        employmentStatus,
        rrn: p?.rrn || (u as any).rrn || '',
        address: p?.address || (u as any).address || '',
        personalEmail: p?.personalEmail || (u as any).personalEmail || '',
        emergencyPhone: p?.emergencyPhone || (u as any).emergencyPhone || '',
        education: p?.education || (u as any).education || '',
        gender: p?.gender || (u as any).gender || '',
        birthDate: p?.birthDate || (u as any).birthDate || '',
      };
    });
  }, [employeeProfiles, users]);

  // 고유 소속 부서 목록 추출 (실제 부서 마스터 + 유저 부서)
  const allDepts = useMemo(() => {
    const set = new Set<string>();
    departments.forEach((d) => set.add(d.name));
    users.forEach((u) => {
      if (u.dept && u.dept !== '미지정') set.add(u.dept);
    });
    return Array.from(set);
  }, [departments, users]);

  // 고유 직급 목록 추출
  const allPositions = useMemo(() => {
    const set = new Set<string>();
    positions.forEach((p) => set.add(p.name));
    users.forEach((u) => {
      if (u.position) set.add(u.position);
    });
    return Array.from(set);
  }, [positions, users]);

  // 고유 직책 목록 추출
  const allJobTitles = useMemo(() => {
    const set = new Set<string>(['팀원', '파트장', '팀장', '본부장', '위원장']);
    jobTitles.forEach((j) => set.add(j.name));
    return Array.from(set);
  }, [jobTitles]);

  // 발령 대기 중인 계정 (부서 미지정 등)
  const unassignedUsers = useMemo(() => {
    return users.filter((u) => !u.dept || u.dept === '미지정');
  }, [users]);

  // 선택된 상세 사원 객체
  const selectedEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedUserId || e.userId === selectedUserId) || null;
  }, [employees, selectedUserId]);

  // 필터링된 임직원 리스트
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchDept = deptFilter === 'all' || e.dept === deptFilter;
      const matchPos = posFilter === 'all' || e.position === posFilter;
      const matchStatus = statusFilter === 'all' || e.employmentStatus === statusFilter;

      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.employeeNo.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q));

      return matchDept && matchPos && matchStatus && matchQuery;
    });
  }, [employees, deptFilter, posFilter, statusFilter, searchQuery]);

  // 실시간 부서 트리 생성
  const orgTree: OrgNode[] = useMemo(() => {
    const deptMap = new Map<string, OrgNode>();
    departments.forEach((d) => {
      deptMap.set(d.id, {
        id: d.id,
        name: d.name,
        leaf: true,
        children: [],
      });
    });

    const roots: OrgNode[] = [];
    departments.forEach((d) => {
      const node = deptMap.get(d.id);
      if (!node) return;
      if (d.parentId && deptMap.has(d.parentId)) {
        const parent = deptMap.get(d.parentId)!;
        parent.leaf = false;
        parent.children?.push(node);
      } else {
        roots.push(node);
      }
    });

    return [
      {
        id: 'company_root',
        name: '워크핏 (전사)',
        leaf: false,
        children: roots.length > 0 ? roots : [{ id: 'default_dept', name: '본사', leaf: true }],
      },
    ];
  }, [departments]);

  const getActiveDeptEmployees = (deptName: string) => {
    return employees.filter((e) => e.dept === deptName && e.employmentStatus !== 'RETIRED');
  };

  const parseRrnInfo = (rrnVal: string) => {
    const cleaned = rrnVal.replace(/[^0-9]/g, '');
    if (cleaned.length < 7) return { gender: '', birthDate: '' };
    const birthPart = cleaned.substring(0, 6);
    const genderDigit = cleaned.charAt(6);

    let gender = '';
    if (['1', '3', '5'].includes(genderDigit)) gender = '남성';
    else if (['2', '4', '6'].includes(genderDigit)) gender = '여성';

    let yearPrefix = '19';
    if (['3', '4'].includes(genderDigit)) yearPrefix = '20';
    else if (['5', '6'].includes(genderDigit)) yearPrefix = '19';

    const birthDate = `${yearPrefix}${birthPart.substring(0, 2)}-${birthPart.substring(2, 4)}-${birthPart.substring(4, 6)}`;
    return { gender, birthDate };
  };

  // 1. 임직원 인사 발령 제출 (신규 employeeProfiles 연동)
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreateUserId) {
      alert('사용자 관리에서 등록된 계정을 먼저 선택해 주세요.');
      return;
    }

    const targetUser = users.find((u) => u.id === selectedCreateUserId);
    if (!targetUser) return;

    let gender = '';
    let birthDate = '';
    if (newEmpRrn) {
      const parsed = parseRrnInfo(newEmpRrn);
      gender = parsed.gender;
      birthDate = parsed.birthDate;
    }

    try {
      await upsertEmployeeProfile.mutateAsync({
        id: targetUser.id,
        values: {
          userId: targetUser.id,
          empNo: targetUser.empNo,
          name: targetUser.name,
          dept: newEmpDept || departments[0]?.name || '인사지원팀',
          position: newEmpPos || positions[0]?.name || '사원',
          jobTitle: newEmpDuty || '팀원',
          status: 'ACTIVE',
          phone: newEmpPhone.trim(),
          hireDate: newEmpHireDate,
          rrn: newEmpRrn.trim(),
          birthDate,
          gender,
          address: newEmpAddress.trim(),
          personalEmail: newEmpPersonalEmail.trim(),
          emergencyPhone: newEmpEmergencyPhone.trim(),
          education: newEmpEducation.trim(),
        },
      });

      setSelectedCreateUserId('');
      setNewEmpNo('');
      setNewEmpName('');
      setNewEmpEmail('');
      setNewEmpPhone('');
      setNewEmpHireDate('');
      setNewEmpRrn('');
      setNewEmpAddress('');
      setNewEmpPersonalEmail('');
      setNewEmpEmergencyPhone('');
      setNewEmpEducation('');
      setIsCreateModalOpen(false);
      alert('임직원 인사 발령이 성공적으로 완료되었습니다.');
    } catch (err: any) {
      alert(err.message || '인사 발령 처리 중 오류가 발생했습니다.');
    }
  };

  // 2. 임직원 정보 편집 모달 활성화 및 초기값 바인딩
  const openEditModal = (emp: typeof employees[0]) => {
    setEditModalTab('work');
    setEditEmpName(emp.name);
    setEditEmpDept(emp.dept);
    setEditEmpPos(emp.position);
    setEditEmpDuty(emp.duty);
    setEditEmpEmail(emp.email || '');
    setEditEmpPhone(emp.phone || '');
    setEditEmpHireDate(emp.hireDate || '');
    setEditEmpStatus(emp.employmentStatus);
    setEditEmpRrn(emp.rrn || '');
    setEditEmpBirthDate(emp.birthDate || '');
    setEditEmpGender(emp.gender || '');
    setEditEmpAddress(emp.address || '');
    setEditEmpPersonalEmail(emp.personalEmail || '');
    setEditEmpEmergencyPhone(emp.emergencyPhone || '');
    setEditEmpEducation(emp.education || '');
    setIsEditModalOpen(true);
  };

  // 3. 임직원 정보 편집 저장 제출 (신규 employeeProfiles 연동)
  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !editEmpName.trim()) return;

    const targetUser = users.find((u) => u.id === selectedUserId);
    if (!targetUser) return;

    let gender = editEmpGender;
    let birthDate = editEmpBirthDate;
    if (editEmpRrn && (!gender || !birthDate)) {
      const parsed = parseRrnInfo(editEmpRrn);
      if (parsed.gender) gender = parsed.gender;
      if (parsed.birthDate) birthDate = parsed.birthDate;
    }

    try {
      await upsertEmployeeProfile.mutateAsync({
        id: targetUser.id,
        values: {
          userId: targetUser.id,
          empNo: targetUser.empNo,
          name: editEmpName.trim(),
          dept: editEmpDept || '미지정',
          position: editEmpPos || '사원',
          jobTitle: editEmpDuty || '',
          status: editEmpStatus,
          phone: editEmpPhone.trim(),
          hireDate: editEmpHireDate,
          rrn: editEmpRrn.trim(),
          birthDate,
          gender,
          address: editEmpAddress.trim(),
          personalEmail: editEmpPersonalEmail.trim(),
          emergencyPhone: editEmpEmergencyPhone.trim(),
          education: editEmpEducation.trim(),
        },
      });

      setIsEditModalOpen(false);
      alert('임직원 인사 및 신상 정보가 성공적으로 반영되었습니다.');
    } catch (err: any) {
      alert(err.message || '수정 중 오류가 발생했습니다.');
    }
  };

  // 4. 퇴직 처리
  const handleRetireEmployee = async (id: string) => {
    if (confirm('임직원 정보 보안 지침에 따라 계정을 퇴직(미사용) 상태로 즉시 변경 처리합니다. 진행하시겠습니까?')) {
      const targetUser = users.find((u) => u.id === id);
      if (!targetUser) return;

      await upsertEmployeeProfile.mutateAsync({
        id: targetUser.id,
        values: {
          status: 'RETIRED',
        },
      });
      alert('퇴직 처리가 완료되어 재직 목록 및 조직도 검색에서 제외됩니다.');
    }
  };

  const toggleDeptCollapse = (deptId: string) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId],
    }));
  };

  return (
    <div className="relative flex h-full w-full gap-5 overflow-hidden bg-panel p-6 text-[12.5px] text-ink">
      {/* ── 좌측 탭 전환 사이드바 ── */}
      <aside className="flex w-[200px] shrink-0 flex-col gap-5 rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="space-y-5">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-navy">
              <span>👤</span>
              <span>인명관리</span>
            </h2>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setActiveTab('list');
                setSelectedUserId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${
                activeTab === 'list'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span>👥</span>
              <span>임직원 관리</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('org');
                setSelectedUserId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${
                activeTab === 'org'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span>🏢</span>
              <span>회사 조직도</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 영역 ── */}
      <main className="flex flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-panel p-5 shadow-sm">
        {/* ==================== A. 임직원 관리 탭 ==================== */}
        {activeTab === 'list' && (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            {/* 상단 타이틀 및 액션바 */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h1 className="text-base font-extrabold text-ink">임직원 목록</h1>
                <p className="mt-0.5 text-[11px] text-ink3">사내 직원의 직급, 직책, 재직 현황 기준정보를 파악하고 검색합니다.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="이름, 사번, 이메일 검색"
                    className="h-8.5 w-60 rounded-lg border border-border bg-panel pl-3 pr-8 text-[11.5px] outline-none focus:border-teal"
                  />
                  <span className="absolute right-2.5 top-2 text-[12px] text-ink3">🔍</span>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setNewEmpDept(departments[0]?.name || '인사지원팀');
                      setNewEmpPos(positions[0]?.name || '사원');
                      setNewEmpDuty('팀원');
                      setIsCreateModalOpen(true);
                    }}
                    className="flex h-8.5 items-center gap-1.5 rounded-lg bg-teal px-3 text-[11.5px] font-bold text-white shadow-xs hover:opacity-90"
                  >
                    <span>➕</span>
                    <span>임직원 등록</span>
                  </button>
                )}
              </div>
            </div>

            {/* 필터 툴바 */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-panel-alt/20 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-ink2">소속 부서:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-7.5 rounded border border-border bg-panel px-2 text-[11.5px] outline-none"
                >
                  <option value="all">전체</option>
                  {allDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-ink2">직급:</span>
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="h-7.5 rounded border border-border bg-panel px-2 text-[11.5px] outline-none"
                >
                  <option value="all">전체</option>
                  {allPositions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-ink2">재직 구분:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-7.5 rounded border border-border bg-panel px-2 text-[11.5px] outline-none"
                >
                  <option value="all">전체</option>
                  <option value="ACTIVE">재직</option>
                  <option value="LEAVE">휴직</option>
                  <option value="RETIRED">퇴직</option>
                </select>
              </div>
            </div>

            {/* 임직원 목록 테이블 */}
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-panel">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 border-b border-border bg-panel-alt/50 text-[11.5px] font-bold text-ink2">
                  <tr>
                    <th className="p-3 text-center w-12">사진</th>
                    <th className="p-3 w-28">사번</th>
                    <th className="p-3 w-28">이름</th>
                    <th className="p-3">부서</th>
                    <th className="p-3 w-24">직급</th>
                    <th className="p-3 w-24">직책</th>
                    <th className="p-3">이메일</th>
                    <th className="p-3 w-32">연락처</th>
                    <th className="p-3 text-center w-20">재직상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((e) => {
                      const isSelected = e.id === selectedUserId;
                      return (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedUserId(e.id)}
                          className={`cursor-pointer border-b border-border transition-colors hover:bg-panel-alt/30 ${
                            isSelected ? 'bg-teal-soft/10 font-semibold' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <span className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-teal-soft text-[11px] font-bold text-teal">
                              {e.name[0]}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-ink2">{e.employeeNo}</td>
                          <td className="p-3 font-semibold text-ink">{e.name}</td>
                          <td className="p-3 text-ink2">{e.dept}</td>
                          <td className="p-3 text-ink2">{e.position}</td>
                          <td className="p-3 text-ink3">{e.duty}</td>
                          <td className="p-3 truncate font-mono text-ink2">{e.email || '-'}</td>
                          <td className="p-3 font-mono text-ink3">{e.phone || '-'}</td>
                          <td className="p-3 text-center">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                                e.employmentStatus === 'ACTIVE'
                                  ? 'border-teal/20 bg-teal-soft/20 text-teal'
                                  : e.employmentStatus === 'LEAVE'
                                  ? 'border-amber/20 bg-amber-soft text-amber'
                                  : 'border-border bg-panel-alt text-ink3'
                              }`}
                            >
                              {e.employmentStatus === 'ACTIVE' ? '재직' : e.employmentStatus === 'LEAVE' ? '휴직' : '퇴직'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-ink3">
                        {isUsersLoading ? '임직원 목록을 불러오는 중...' : '검색 조건에 일치하는 임직원이 없습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== B. 회사 조직도 탭 ==================== */}
        {activeTab === 'org' && (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div>
              <h1 className="text-base font-extrabold text-ink">조직도 트리</h1>
              <p className="mt-0.5 text-[11px] text-ink3">회사 계층별 부서 트리와 소속 재직 직원 명단을 실시간으로 탐색합니다.</p>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-5 overflow-hidden rounded-xl border border-border bg-panel p-4 md:grid-cols-[240px_1fr]">
              {/* 좌측 부서 트리 박스 */}
              <div className="space-y-3 overflow-y-auto border-r border-border pr-4">
                <h3 className="flex items-center gap-1 text-xs font-extrabold text-ink">
                  <span>🏢</span>
                  <span>부서 목록</span>
                </h3>

                <div className="space-y-1 pl-1 text-[12px] font-bold select-none">
                  {orgTree.map(function renderNode(node: OrgNode) {
                    const isCollapsed = collapsedDepts[node.id] || false;
                    const isLeaf = node.leaf || false;
                    const children = node.children || [];
                    const activeMembers = isLeaf ? getActiveDeptEmployees(node.name) : [];

                    return (
                      <div key={node.id} className="mt-0.5 flex flex-col">
                        <div
                          onClick={() => {
                            if (!isLeaf && children.length > 0) {
                              toggleDeptCollapse(node.id);
                            } else {
                              setSelectedDept(node.name);
                            }
                          }}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg py-1.5 px-2 transition-colors ${
                            isLeaf
                              ? `hover:bg-teal-soft/10 text-ink ${selectedDept === node.name ? 'bg-teal-soft/15 font-extrabold text-teal' : ''}`
                              : 'text-ink2 hover:bg-black/5'
                          }`}
                        >
                          {!isLeaf && (
                            <span className="grid h-3 w-3 place-items-center text-[10px] text-ink3">
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                          )}
                          <span>{isLeaf ? '📄' : '📁'}</span>
                          <span>{node.name}</span>
                          {isLeaf && (
                            <span className="ml-1 text-[10px] font-extrabold text-teal">
                              ({activeMembers.length})
                            </span>
                          )}
                        </div>

                        {!isCollapsed && children.length > 0 && (
                          <div className="my-0.5 ml-2.5 flex flex-col gap-0.5 border-l border-border/60 pl-4.5">
                            {children.map(renderNode)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 우측 소속 사원 리스트 박스 */}
              <div className="space-y-4 overflow-y-auto">
                <h3 className="flex items-center gap-1.5 border-b border-border pb-2.5 text-xs font-extrabold text-ink">
                  <span>👥</span>
                  <div className="flex items-center gap-1.5">
                    <span>부서 재직자 검색 명단 {selectedDept !== 'all' && `(${selectedDept})`}</span>
                  </div>
                  {selectedDept !== 'all' && (
                    <button
                      onClick={() => setSelectedDept('all')}
                      className="cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold text-teal hover:underline"
                    >
                      전체 보기
                    </button>
                  )}
                </h3>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {employees
                    .filter((e) => e.employmentStatus !== 'RETIRED' && (selectedDept === 'all' || e.dept === selectedDept))
                    .map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedUserId(emp.id)}
                        className="shadow-2xs flex cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-panel p-3.5 transition-all hover:border-teal/30 hover:shadow-xs"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-soft text-[12px] font-bold text-teal">
                          {emp.name[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-bold text-ink">{emp.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-ink3">
                            <span>{emp.dept}</span>
                            <span>·</span>
                            <span>{emp.position}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================== C. 임직원 상세 모달 패널 ==================== */}
      {selectedUserId && selectedEmp && (
        <>
          <div
            onClick={() => setSelectedUserId(null)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-0 z-50 m-auto flex h-[560px] max-h-[90vh] w-[720px] max-w-[95vw] overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* 좌측 프로필 카드 영역 */}
            <div className="flex w-[240px] shrink-0 flex-col items-center justify-between border-r border-border bg-gradient-to-b from-teal-soft/10 to-panel-alt/5 p-6 select-none">
              <div className="mt-4 flex w-full flex-col items-center">
                <div className="grid h-22 w-22 place-items-center rounded-full border-3 border-panel bg-teal text-3xl font-black text-white shadow-md">
                  {selectedEmp.name[0]}
                </div>

                <div className="mt-4 text-center text-base font-extrabold text-ink">
                  {selectedEmp.name}
                </div>
                <div className="mt-1.5 rounded border border-border bg-panel-alt px-2 py-0.5 font-mono text-[10px] font-bold text-ink2">
                  {selectedEmp.employeeNo}
                </div>

                <div className="mt-5 space-y-1 text-center">
                  <div className="text-xs font-bold text-teal">{selectedEmp.dept}</div>
                  <div className="text-[11px] font-semibold text-ink3">
                    {selectedEmp.position} {selectedEmp.duty && `· ${selectedEmp.duty}`}
                  </div>
                </div>
              </div>

              <div className="w-full rounded-xl border border-border/40 bg-panel-alt/20 py-2.5 px-3 text-center text-[10.5px] leading-relaxed text-ink3">
                소속 부서 및 보직 발령 완료
              </div>
            </div>

            {/* 우측 상세정보 탭 및 필드 영역 */}
            <div className="flex flex-1 flex-col justify-between overflow-hidden bg-panel">
              <div className="flex shrink-0 items-center justify-end border-b border-border bg-panel-alt/5 p-3.5">
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="rounded px-2 py-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex shrink-0 border-b border-border bg-panel-alt/5 text-[11.5px] font-bold">
                <button
                  type="button"
                  onClick={() => setDetailTab('work')}
                  className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                    detailTab === 'work' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
                  }`}
                >
                  💼 인사 및 소속 정보
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailTab('personal');
                    setShowRrn(false);
                  }}
                  className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
                    detailTab === 'personal' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
                  }`}
                >
                  🔒 개인 신상 정보 (인사팀용)
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6 text-[12px]">
                {detailTab === 'work' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-3.5">
                      <div>
                        <span className="block text-[11px] text-ink3">재직 상태</span>
                        <span
                          className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            selectedEmp.employmentStatus === 'ACTIVE'
                              ? 'border-teal/20 bg-teal-soft/20 text-teal'
                              : selectedEmp.employmentStatus === 'LEAVE'
                              ? 'border-amber/20 bg-amber-soft text-amber'
                              : 'border-border bg-panel-alt text-ink3'
                          }`}
                        >
                          {selectedEmp.employmentStatus === 'ACTIVE' ? '재직 중' : selectedEmp.employmentStatus === 'LEAVE' ? '휴직' : '퇴직자'}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">입사일</span>
                        <span className="mt-1 block font-mono font-semibold text-ink">{selectedEmp.hireDate || '-'}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">사번 (ID)</span>
                        <span className="mt-1 block font-mono font-semibold text-ink">{selectedEmp.employeeNo}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">소속 부서</span>
                        <span className="mt-1 block font-semibold text-ink">{selectedEmp.dept}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">직급 / 직책</span>
                        <span className="mt-1 block font-semibold text-ink">
                          {selectedEmp.position} {selectedEmp.duty && `(${selectedEmp.duty})`}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">업무 이메일</span>
                        <span className="mt-1 block break-all font-mono font-semibold text-ink">{selectedEmp.email || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="block text-[11px] text-ink3">업무 연락처</span>
                        <span className="mt-1 block font-mono font-semibold text-ink">{selectedEmp.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {detailTab === 'personal' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-[10.5px] font-bold leading-relaxed text-amber-800">
                      🔒 본 정보는 개인 신상정보를 포함하고 있으므로 열람 및 취급에 주의를 요합니다. (인사관리 전용)
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-3.5">
                      <div>
                        <span className="block text-[11px] text-ink3">생년월일</span>
                        <span className="mt-1 block font-mono font-semibold text-ink">{selectedEmp.birthDate || '-'}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">성별</span>
                        <span className="mt-1 block font-semibold text-ink">{selectedEmp.gender || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="block text-[11px] text-ink3">주민등록번호</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono font-semibold tracking-wider text-ink">
                            {showRrn
                              ? selectedEmp.rrn || '-'
                              : selectedEmp.rrn
                              ? `${selectedEmp.rrn.split('-')[0]}-${selectedEmp.rrn.split('-')[1]?.charAt(0) || ''}******`
                              : '-'}
                          </span>
                          {selectedEmp.rrn && (
                            <button
                              type="button"
                              onClick={() => setShowRrn(!showRrn)}
                              className="cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold text-teal hover:underline"
                            >
                              {showRrn ? '🙈 숨기기' : '👁️ 전체보기'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className="block text-[11px] text-ink3">주소</span>
                        <span className="mt-1 block leading-relaxed font-semibold text-ink">{selectedEmp.address || '-'}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">개인 이메일</span>
                        <span className="mt-1 block break-all font-mono font-semibold text-ink">{selectedEmp.personalEmail || '-'}</span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-ink3">비상 연락처</span>
                        <span className="mt-1 block font-mono font-semibold text-ink">{selectedEmp.emergencyPhone || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="block text-[11px] text-ink3">최종 학력</span>
                        <span className="mt-1 block font-semibold text-ink">{selectedEmp.education || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {isAdmin && selectedEmp.employmentStatus !== 'RETIRED' && (
                <div className="flex shrink-0 gap-2 border-t border-border bg-panel-alt/10 p-4">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedEmp)}
                    className="flex-1 rounded-lg bg-teal py-2 text-[11.5px] font-bold text-white transition-opacity hover:opacity-90"
                  >
                    ⚙️ 인사 발령 / 개인신상 수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetireEmployee(selectedEmp.id)}
                    className="flex-1 rounded-lg border border-red/20 bg-red-soft/10 py-2 text-[11.5px] font-bold text-red transition-colors hover:bg-red-soft/20"
                  >
                    ⚠️ 퇴직 처리
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== D. 관리자 전용 신규 임직원 등록 모달 (사용자 관리 계정 연동) ==================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex max-h-[90vh] w-[480px] flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-panel p-5 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border pb-2">
              <span className="text-[13px] font-extrabold text-navy">👤 임직원 인사 발령 (등록)</span>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-sm font-bold text-ink3 hover:text-ink">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              {/* 계정 선택 필드 */}
              <div className="flex flex-col gap-1.5 rounded-lg border border-teal/30 bg-teal-soft/10 p-3">
                <label className="text-[11.5px] font-extrabold text-teal">
                  1. 발령 대상 계정 선택 (사용자 관리 등록 계정) <span className="text-red">*</span>
                </label>
                <select
                  value={selectedCreateUserId}
                  onChange={(e) => handleSelectCreateUser(e.target.value)}
                  required
                  className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] font-semibold text-ink outline-none focus:border-teal"
                >
                  <option value="">
                    {unassignedUsers.length > 0
                      ? '발령 대기 계정을 선택하세요'
                      : '현재 발령 대기 중인 신규 계정이 없습니다 (전원 발령 완료)'}
                  </option>
                  {unassignedUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.empNo}) - 발령 대기
                    </option>
                  ))}
                </select>
                {unassignedUsers.length === 0 ? (
                  <span className="text-[10.5px] font-semibold text-teal">
                    ✨ 모든 계정이 이미 부서 발령을 마쳤습니다. 신규 직원은 <strong>[사용자 관리]</strong>에서 먼저 계정을 추가해 주세요.
                  </span>
                ) : (
                  <span className="text-[10.5px] text-ink3">
                    💡 <strong>[사용자 관리]</strong>에서 생성된 후 아직 부서가 지정되지 않은 계정만 표시됩니다.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">사번 (계정 연동)</label>
                  <input
                    type="text"
                    value={newEmpNo}
                    disabled
                    placeholder="계정 선택 시 자동 입력"
                    className="h-9 w-full rounded-lg border border-border bg-panel-alt/50 px-3 font-mono text-[12px] text-ink3 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">이름 (계정 연동)</label>
                  <input
                    type="text"
                    value={newEmpName}
                    disabled
                    placeholder="계정 선택 시 자동 입력"
                    className="h-9 w-full rounded-lg border border-border bg-panel-alt/50 px-3 text-[12px] font-bold text-ink3 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">소속 부서 (발령)</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                  >
                    {allDepts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직급</label>
                  <select
                    value={newEmpPos}
                    onChange={(e) => setNewEmpPos(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                  >
                    {allPositions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직책</label>
                  <select
                    value={newEmpDuty}
                    onChange={(e) => setNewEmpDuty(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                  >
                    {allJobTitles.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">업무 이메일</label>
                  <input
                    type="email"
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="name@workfit.co.kr"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">업무 연락처</label>
                  <input
                    type="text"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">입사일</label>
                  <input
                    type="date"
                    value={newEmpHireDate}
                    onChange={(e) => setNewEmpHireDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">주민등록번호</label>
                  <input
                    type="text"
                    value={newEmpRrn}
                    onChange={(e) => setNewEmpRrn(e.target.value)}
                    placeholder="900101-1234567"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">개인 이메일</label>
                  <input
                    type="email"
                    value={newEmpPersonalEmail}
                    onChange={(e) => setNewEmpPersonalEmail(e.target.value)}
                    placeholder="personal@email.com"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">비상 연락처</label>
                  <input
                    type="text"
                    value={newEmpEmergencyPhone}
                    onChange={(e) => setNewEmpEmergencyPhone(e.target.value)}
                    placeholder="010-9999-8888"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">주소</label>
                  <input
                    type="text"
                    value={newEmpAddress}
                    onChange={(e) => setNewEmpAddress(e.target.value)}
                    placeholder="자택 주소 입력"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">최종 학력</label>
                  <input
                    type="text"
                    value={newEmpEducation}
                    onChange={(e) => setNewEmpEducation(e.target.value)}
                    placeholder="예: 대학교 학사"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                  />
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== E. 관리자 전용 임직원 정보 편집 모달 (인사/신상 탭) ==================== */}
      {isEditModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex max-h-[90vh] w-[480px] flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-panel p-5 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border pb-2">
              <span className="text-[13px] font-extrabold text-navy">⚙️ {selectedEmp.name} 인사 및 신상 정보 수정</span>
              <button onClick={() => setIsEditModalOpen(false)} className="text-sm font-bold text-ink3 hover:text-ink">
                ✕
              </button>
            </div>

            {/* 편집 모달 서브 탭 */}
            <div className="flex border-b border-border text-[11.5px] font-bold">
              <button
                type="button"
                onClick={() => setEditModalTab('work')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${
                  editModalTab === 'work' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
                }`}
              >
                💼 인사 및 소속 정보
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('personal')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${
                  editModalTab === 'personal' ? 'border-teal text-teal' : 'border-transparent text-ink3 hover:text-ink'
                }`}
              >
                🔒 개인 신상 정보
              </button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              {editModalTab === 'work' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">사번 (수정 불가)</label>
                      <input
                        type="text"
                        value={selectedEmp.employeeNo}
                        disabled
                        className="h-9 w-full rounded-lg border border-border bg-panel-alt/50 px-3 font-mono text-[12px] text-ink3 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">이름 (필수)</label>
                      <input
                        type="text"
                        value={editEmpName}
                        onChange={(e) => setEditEmpName(e.target.value)}
                        required
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">소속 부서</label>
                      <select
                        value={editEmpDept}
                        onChange={(e) => setEditEmpDept(e.target.value)}
                        className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                      >
                        {allDepts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">직급</label>
                      <select
                        value={editEmpPos}
                        onChange={(e) => setEditEmpPos(e.target.value)}
                        className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                      >
                        {allPositions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">직책</label>
                      <select
                        value={editEmpDuty}
                        onChange={(e) => setEditEmpDuty(e.target.value)}
                        className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                      >
                        {allJobTitles.map((j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">재직 상태</label>
                      <select
                        value={editEmpStatus}
                        onChange={(e) => setEditEmpStatus(e.target.value as EmploymentStatus)}
                        className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                      >
                        <option value="ACTIVE">재직</option>
                        <option value="LEAVE">휴직</option>
                        <option value="RETIRED">퇴직</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">입사일</label>
                      <input
                        type="date"
                        value={editEmpHireDate}
                        onChange={(e) => setEditEmpHireDate(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">업무 이메일</label>
                      <input
                        type="email"
                        value={editEmpEmail}
                        onChange={(e) => setEditEmpEmail(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">업무 연락처</label>
                      <input
                        type="text"
                        value={editEmpPhone}
                        onChange={(e) => setEditEmpPhone(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editModalTab === 'personal' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">주민등록번호</label>
                      <input
                        type="text"
                        value={editEmpRrn}
                        onChange={(e) => {
                          setEditEmpRrn(e.target.value);
                          const parsed = parseRrnInfo(e.target.value);
                          if (parsed.gender) setEditEmpGender(parsed.gender);
                          if (parsed.birthDate) setEditEmpBirthDate(parsed.birthDate);
                        }}
                        placeholder="900101-1234567"
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">생년월일</label>
                      <input
                        type="date"
                        value={editEmpBirthDate}
                        onChange={(e) => setEditEmpBirthDate(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">성별</label>
                      <select
                        value={editEmpGender}
                        onChange={(e) => setEditEmpGender(e.target.value)}
                        className="h-9.5 rounded-lg border border-border bg-panel px-2 text-[12px] outline-none focus:border-teal"
                      >
                        <option value="">선택</option>
                        <option value="남성">남성</option>
                        <option value="여성">여성</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">최종 학력</label>
                      <input
                        type="text"
                        value={editEmpEducation}
                        onChange={(e) => setEditEmpEducation(e.target.value)}
                        placeholder="예: 대학교 학사"
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">개인 이메일</label>
                      <input
                        type="email"
                        value={editEmpPersonalEmail}
                        onChange={(e) => setEditEmpPersonalEmail(e.target.value)}
                        placeholder="personal@email.com"
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">비상 연락처</label>
                      <input
                        type="text"
                        value={editEmpEmergencyPhone}
                        onChange={(e) => setEditEmpEmergencyPhone(e.target.value)}
                        placeholder="010-9999-8888"
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 font-mono text-[12px] outline-none focus:border-teal"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-ink2">자택 주소</label>
                    <input
                      type="text"
                      value={editEmpAddress}
                      onChange={(e) => setEditEmpAddress(e.target.value)}
                      placeholder="지번/도로명 주소 입력"
                      className="h-9 w-full rounded-lg border border-border bg-panel px-3 text-[12px] outline-none focus:border-teal"
                    />
                  </div>
                </div>
              )}

              <div className="flex shrink-0 justify-end gap-2 border-t border-border/40 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90"
                >
                  변경사항 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}