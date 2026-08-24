import { useState, useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useEmployee } from '@/features/employee/useEmployee';
import type { Employee, EmploymentStatus } from '@/domain/employee/schema';

// 거래처 관련 임포트

import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput } from '@/shared/ui/FilterBar';

import { VENDOR_TYPES, type Vendor } from '@/domain/vendor/schema';
import { useVendors, useSaveVendor } from '@/features/vendor/useVendors';

const VENDOR_TYPE_TONE: Record<Vendor['type'], any> = { 매입: 'info', 매출: 'ok', 외주: 'mute' };
const VENDOR_TYPE_OPTIONS = [{ value: '', label: '전체' }, ...VENDOR_TYPES.map((t) => ({ value: t, label: t }))];
const VENDOR_USE_OPTIONS = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '미사용', label: '미사용' }];

interface OrgNode {
  id: string;
  name: string;
  leaf?: boolean;
  children?: OrgNode[];
}

export default function EmployeeScreen() {
  const { user } = useAuth();
  const {
    employees,
    createEmployee,
    updateEmployee,
    changeStatus
  } = useEmployee();

  // 로그인 사용자 세션 가공 및 권한 식별
  const CURRENT_USER = useMemo(() => {
    return {
      id: user?.id || 'guest',
      name: user?.name ? `${user.name}`.trim() : '게스트',
      roleGroup: user?.roleGroup || 'USER'
    };
  }, [user]);

  const isAdmin = CURRENT_USER.roleGroup === 'ADMIN';

  // 대분류 탭: 'list' (임직원 관리) | 'org' (조직도) | 'vendor' (거래처)
  const [activeTab, setActiveTab] = useState<'list' | 'org' | 'vendor'>('list');

  // 필터 및 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [posFilter, setPosFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 기본 재직자만 보기

  // 상세 보기 및 편집 대상
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 조직도 선택 부서 상태
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // 외부 거래처(Vendor) 관련 상태
  const [vendorDraft, setVendorDraft] = useState({ type: '', use: '', q: '' });
  const [vendorApplied, setVendorApplied] = useState({ type: '', use: '', q: '' });
  const [selectedVendorCode, setSelectedVendorCode] = useState('V-10021');

  const { data: vendorRows = [], isLoading: isVendorLoading } = useVendors(vendorApplied);
  const curVendor = vendorRows.find((v) => v.code === selectedVendorCode) ?? vendorRows[0];

  // React Query Mutations
  const saveVendorMutation = useSaveVendor();


  // 거래처 상세/수정 모달 관련 상태
  const [isVendorDetailModalOpen, setIsVendorDetailModalOpen] = useState(false);
  const [isVendorEditMode, setIsVendorEditMode] = useState(false);
  const [isVendorCreateModalOpen, setIsVendorCreateModalOpen] = useState(false);

  // 거래처 폼 편집 입력 상태
  const [editVendorName, setEditVendorName] = useState('');
  const [editVendorCeo, setEditVendorCeo] = useState('');
  const [editVendorBizNo, setEditVendorBizNo] = useState('');
  const [editVendorType, setEditVendorType] = useState<'매입' | '매출' | '외주'>('매입');
  const [editVendorManager, setEditVendorManager] = useState('');
  const [editVendorUse, setEditVendorUse] = useState<'사용' | '미사용'>('사용');
  const [editVendorAddr, setEditVendorAddr] = useState('');

  // 거래처 신규 등록 입력 상태
  const [newVendorCode, setNewVendorCode] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCeo, setNewVendorCeo] = useState('');
  const [newVendorBizNo, setNewVendorBizNo] = useState('');
  const [newVendorType, setNewVendorType] = useState<'매입' | '매출' | '외주'>('매입');
  const [newVendorManager, setNewVendorManager] = useState('');
  const [newVendorUse, setNewVendorUse] = useState<'사용' | '미사용'>('사용');
  const [newVendorAddr, setNewVendorAddr] = useState('');

  // 거래처 핸들러 함수들
  const openVendorDetailModal = (vendor: Vendor) => {
    setSelectedVendorCode(vendor.code);
    setEditVendorName(vendor.name);
    setEditVendorCeo(vendor.ceo || '');
    setEditVendorBizNo(vendor.bizNo || '');
    setEditVendorType(vendor.type);
    setEditVendorManager(vendor.manager || '');
    setEditVendorUse(vendor.use);
    setEditVendorAddr(vendor.addr || '');
    setIsVendorEditMode(false);
    setIsVendorDetailModalOpen(true);
  };

  const handleUpdateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorCode || !curVendor) return;

    saveVendorMutation.mutate({
      ...curVendor,
      name: editVendorName.trim(),
      ceo: editVendorCeo.trim(),
      bizNo: editVendorBizNo.trim(),
      type: editVendorType,
      manager: editVendorManager.trim(),
      use: editVendorUse,
      addr: editVendorAddr.trim(),
    }, {
      onSuccess: () => {
        alert('거래처 정보가 수정되었습니다.');
        setIsVendorEditMode(false);
        setIsVendorDetailModalOpen(false);
      },
      onError: (err: any) => {
        alert(err.message || '저장에 실패했습니다.');
      }
    });
  };

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorCode.trim() || !newVendorName.trim()) return;

    saveVendorMutation.mutate({
      code: newVendorCode.trim(),
      name: newVendorName.trim(),
      ceo: newVendorCeo.trim(),
      bizNo: newVendorBizNo.trim(),
      type: newVendorType,
      manager: newVendorManager.trim(),
      use: newVendorUse,
      addr: newVendorAddr.trim(),
    }, {
      onSuccess: () => {
        alert('신규 거래처가 등록되었습니다.');
        setNewVendorCode('');
        setNewVendorName('');
        setNewVendorCeo('');
        setNewVendorBizNo('');
        setNewVendorType('매입');
        setNewVendorManager('');
        setNewVendorUse('사용');
        setNewVendorAddr('');
        setIsVendorCreateModalOpen(false);
      },
      onError: (err: any) => {
        alert(err.message || '등록에 실패했습니다.');
      }
    });
  };

  // 신규 등록 폼 상태
  const [newEmpNo, setNewEmpNo] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpDept, setNewEmpDept] = useState('인사지원팀');
  const [newEmpPos, setNewEmpPos] = useState('사원');
  const [newEmpDuty, setNewEmpDuty] = useState('팀원');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpHireDate, setNewEmpHireDate] = useState('');
  const [newEmpRrn, setNewEmpRrn] = useState('');
  const [newEmpAddress, setNewEmpAddress] = useState('');
  const [newEmpPersonalEmail, setNewEmpPersonalEmail] = useState('');
  const [newEmpEmergencyPhone, setNewEmpEmergencyPhone] = useState('');
  const [newEmpEducation, setNewEmpEducation] = useState('');

  // 정보 수정 폼 상태
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpDept, setEditEmpDept] = useState('');
  const [editEmpPos, setEditEmpPos] = useState('');
  const [editEmpDuty, setEditEmpDuty] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPhone, setEditEmpPhone] = useState('');
  const [editEmpHireDate, setEditEmpHireDate] = useState('');
  const [editEmpStatus, setEditEmpStatus] = useState<EmploymentStatus>('ACTIVE');
  const [editEmpRrn, setEditEmpRrn] = useState('');
  const [editEmpAddress, setEditEmpAddress] = useState('');
  const [editEmpPersonalEmail, setEditEmpPersonalEmail] = useState('');
  const [editEmpEmergencyPhone, setEditEmpEmergencyPhone] = useState('');
  const [editEmpEducation, setEditEmpEducation] = useState('');

  // 상세 보기 Drawer 내의 탭 상태 ('work': 인사/소속 | 'personal': 개인/신상)
  const [detailTab, setDetailTab] = useState<'work' | 'personal'>('work');
  // 주민번호 표시 토글
  const [showRrn, setShowRrn] = useState(false);

  // 조직도 노드 접힘 상태 관리
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  // 고유 소속 부서 목록 추출 (필터 및 콤보박스용)
  const allDepts = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach((e) => { if (e.dept) depts.add(e.dept); });
    return Array.from(depts);
  }, [employees]);

  // 고유 직급 목록 추출
  const allPositions = useMemo(() => {
    const positions = new Set<string>();
    employees.forEach((e) => { if (e.position) positions.add(e.position); });
    return Array.from(positions);
  }, [employees]);

  // 선택된 상세 사원 객체
  const selectedEmp = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // 필터링된 임직원 리스트 (임직원 관리 탭용)
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchDept = deptFilter === 'all' || e.dept === deptFilter;
      const matchPos = posFilter === 'all' || e.position === posFilter;
      const matchStatus = statusFilter === 'all' || e.employmentStatus === statusFilter;

      const q = searchQuery.trim().toLowerCase();
      const matchQuery = !q ||
        e.name.toLowerCase().includes(q) ||
        e.employeeNo.includes(q) ||
        (e.email && e.email.toLowerCase().includes(q));

      return matchDept && matchPos && matchStatus && matchQuery;
    });
  }, [employees, deptFilter, posFilter, statusFilter, searchQuery]);

  // 조직도용 가상 부서 트리 구조 정의 (인명관리.md 9절 기반 계층 모델)
  const orgTree: OrgNode[] = useMemo(() => {
    return [
      {
        id: 'hq',
        name: '워크핏 주식회사',
        children: [
          {
            id: 'mgmt',
            name: '경영지원본부',
            children: [
              { id: 'hr', name: '인사지원팀', leaf: true },
              { id: 'finance', name: '재무관리팀', leaf: true },
              { id: 'legal', name: '법무지원팀', leaf: true }
            ]
          },
          {
            id: 'dev',
            name: '기술본부',
            children: [
              { id: 'ax', name: 'AX개발본부', leaf: true },
              { id: 'mkt', name: '마케팅전략팀', leaf: true }
            ]
          },
          {
            id: 'exec',
            name: '임원실',
            leaf: true
          }
        ]
      }
    ];
  }, []);

  // 특정 부서(또는 소속 팀)에 매핑된 재직 임직원 리스트 (조직도 탭용: 퇴직자 배제)
  const getActiveDeptEmployees = (deptName: string) => {
    return employees.filter(
      (e) => e.dept === deptName && e.employmentStatus !== 'RETIRED'
    );
  };

  // 주민번호를 통한 성별 및 생년월일 자동 유추 헬퍼
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
    else if (['5', '6'].includes(genderDigit)) yearPrefix = '19'; // 외국인 등 폴백

    const birthDate = `${yearPrefix}${birthPart.substring(0, 2)}-${birthPart.substring(2, 4)}-${birthPart.substring(4, 6)}`;
    return { gender, birthDate };
  };

  // 1. 임직원 등록 제출
  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpNo.trim() || !newEmpName.trim()) return;

    // 사번 중복 검사
    const duplicate = employees.some((emp) => emp.employeeNo === newEmpNo.trim());
    if (duplicate) {
      alert(`이미 등록된 사번(${newEmpNo.trim()})입니다. 다시 확인해 주세요.`);
      return;
    }

    const { gender, birthDate } = parseRrnInfo(newEmpRrn);

    const created = createEmployee({
      employeeNo: newEmpNo.trim(),
      name: newEmpName.trim(),
      dept: newEmpDept,
      position: newEmpPos,
      duty: newEmpDuty,
      email: newEmpEmail.trim(),
      phone: newEmpPhone.trim(),
      hireDate: newEmpHireDate,
      employmentStatus: 'ACTIVE',
      rrn: newEmpRrn.trim(),
      address: newEmpAddress.trim(),
      personalEmail: newEmpPersonalEmail.trim(),
      emergencyPhone: newEmpEmergencyPhone.trim(),
      education: newEmpEducation.trim(),
      gender,
      birthDate
    });

    if (created) {
      // 폼 초기화
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
    }
  };

  // 2. 임직원 정보 편집 모달 활성화 및 초기값 바인딩
  const openEditModal = (emp: Employee) => {
    setEditEmpName(emp.name);
    setEditEmpDept(emp.dept);
    setEditEmpPos(emp.position);
    setEditEmpDuty(emp.duty);
    setEditEmpEmail(emp.email || '');
    setEditEmpPhone(emp.phone || '');
    setEditEmpHireDate(emp.hireDate || '');
    setEditEmpStatus(emp.employmentStatus);
    setEditEmpRrn(emp.rrn || '');
    setEditEmpAddress(emp.address || '');
    setEditEmpPersonalEmail(emp.personalEmail || '');
    setEditEmpEmergencyPhone(emp.emergencyPhone || '');
    setEditEmpEducation(emp.education || '');
    setIsEditModalOpen(true);
  };

  // 3. 임직원 정보 편집 저장 제출
  const handleUpdateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !editEmpName.trim()) return;

    const { gender, birthDate } = parseRrnInfo(editEmpRrn);

    updateEmployee(selectedEmpId, {
      name: editEmpName.trim(),
      dept: editEmpDept,
      position: editEmpPos,
      duty: editEmpDuty,
      email: editEmpEmail.trim(),
      phone: editEmpPhone.trim(),
      hireDate: editEmpHireDate,
      employmentStatus: editEmpStatus,
      rrn: editEmpRrn.trim(),
      address: editEmpAddress.trim(),
      personalEmail: editEmpPersonalEmail.trim(),
      emergencyPhone: editEmpEmergencyPhone.trim(),
      education: editEmpEducation.trim(),
      gender,
      birthDate
    });

    setIsEditModalOpen(false);
  };

  // 4. 퇴직 처리 (물리적 삭제 방지 원칙에 따라 RETIRED 상태 변경)
  const handleRetireEmployee = (id: string) => {
    if (confirm('임직원 정보 보안 지침에 따라 데이터를 물리 삭제하지 않고 퇴직(RETIRED) 상태로 즉시 변경 처리합니다. 진행하시겠습니까?')) {
      changeStatus(id, 'RETIRED');
      alert('퇴직 처리가 완료되어 재직 목록 및 조직도 검색에서 제외됩니다.');
    }
  };

  const toggleDeptCollapse = (deptId: string) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId]
    }));
  };

  return (
    <div className="flex h-full w-full gap-5 bg-panel p-6 text-[12.5px] text-ink relative overflow-hidden">

      {/* ── 좌측 탭 전환 사이드바 ── */}
      <aside className="w-[200px] shrink-0 flex flex-col gap-5 rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-extrabold text-navy flex items-center gap-1.5">
              <span>👤</span>
              <span>인명관리</span>
            </h2>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setActiveTab('list');
                setSelectedEmpId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${activeTab === 'list'
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
                setSelectedEmpId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${activeTab === 'org'
                ? 'bg-teal text-white shadow-xs'
                : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                }`}
            >
              <span>🏢</span>
              <span>회사 조직도</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('vendor');
                setSelectedEmpId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${activeTab === 'vendor'
                ? 'bg-teal text-white shadow-xs'
                : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                }`}
            >
              <span>🤝</span>
              <span>외부 거래처 주소록</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 영역 ── */}
      <main className="flex-1 flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 shadow-sm overflow-hidden">

        {/* ==================== A. 임직원 관리 탭 ==================== */}
        {activeTab === 'list' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* 상단 타이틀 및 액션바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 shrink-0">
              <div>
                <h1 className="text-base font-extrabold text-ink">임직원 목록</h1>
                <p className="text-[11px] text-ink3 mt-0.5">사내 직원의 직급, 직책, 재직 현황 기준정보를 파악하고 검색합니다.</p>
              </div>

              <div className="flex items-center gap-2">
                {/* 검색 바 */}
                <div className="relative w-48">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="이름, 사번, 이메일 검색"
                    className="h-8.5 w-full rounded-lg border border-border bg-panel px-3 pr-7 text-[11px] outline-none focus:border-teal"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink3 text-[10px] pointer-events-none">🔍</span>
                </div>

                {/* 관리자 임직원 등록 버튼 */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setNewEmpNo('');
                      setNewEmpName('');
                      setNewEmpEmail('');
                      setNewEmpPhone('');
                      setNewEmpHireDate(new Date().toISOString().split('T')[0]);
                      setIsCreateModalOpen(true);
                    }}
                    className="rounded-lg bg-teal px-3.5 py-1.5 font-bold text-white shadow-xs hover:opacity-90 transition-opacity text-[11.5px]"
                  >
                    ＋ 임직원 등록
                  </button>
                )}
              </div>
            </div>

            {/* 다중 필터링 바 */}
            <div className="flex flex-wrap items-center gap-3 bg-panel-alt/20 p-3 rounded-xl shrink-0 text-[11px]">
              {/* 부서 필터 */}
              <div className="flex items-center gap-1.5">
                <span className="text-ink3 font-bold">소속 부서:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-7.5 rounded-md border border-border bg-panel px-1.5 outline-none text-[11px]"
                >
                  <option value="all">전체</option>
                  {allDepts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* 직급 필터 */}
              <div className="flex items-center gap-1.5">
                <span className="text-ink3 font-bold">직급:</span>
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="h-7.5 rounded-md border border-border bg-panel px-1.5 outline-none text-[11px]"
                >
                  <option value="all">전체</option>
                  {allPositions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 재직상태 필터 */}
              <div className="flex items-center gap-1.5">
                <span className="text-ink3 font-bold">재직 구분:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-7.5 rounded-md border border-border bg-panel px-1.5 outline-none text-[11px]"
                >
                  <option value="all">전체</option>
                  <option value="ACTIVE">재직</option>
                  <option value="LEAVE">휴직</option>
                  <option value="RETIRED">퇴직</option>
                </select>
              </div>
            </div>

            {/* 테이블 목록 */}
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-panel">
              <table className="w-full border-collapse text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/50 font-bold text-ink2">
                    <th className="p-3 w-12 text-center">사진</th>
                    <th className="p-3 w-20">사번</th>
                    <th className="p-3">이름</th>
                    <th className="p-3 w-24">부서</th>
                    <th className="p-3 w-16">직급</th>
                    <th className="p-3 w-16">직책</th>
                    <th className="p-3 w-40">이메일</th>
                    <th className="p-3 w-28">연락처</th>
                    <th className="p-3 w-16 text-center">재직상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((e) => {
                      const isSelected = e.id === selectedEmpId;
                      return (
                        <tr
                          key={e.id}
                          onClick={() => setSelectedEmpId(e.id)}
                          className={`border-b border-border hover:bg-panel-alt/30 cursor-pointer transition-colors ${isSelected ? 'bg-teal-soft/10 font-semibold' : ''
                            }`}
                        >
                          <td className="p-3 text-center">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-soft text-[11px] font-bold text-teal mx-auto">
                              {e.name[0]}
                            </span>
                          </td>
                          <td className="p-3 text-ink2 font-mono">{e.employeeNo}</td>
                          <td className="p-3 text-ink font-semibold">{e.name}</td>
                          <td className="p-3 text-ink2">{e.dept}</td>
                          <td className="p-3 text-ink2">{e.position}</td>
                          <td className="p-3 text-ink3">{e.duty}</td>
                          <td className="p-3 text-ink2 truncate font-mono">{e.email || '-'}</td>
                          <td className="p-3 text-ink3 font-mono">{e.phone || '-'}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${e.employmentStatus === 'ACTIVE'
                              ? 'bg-teal-soft/20 border-teal/20 text-teal'
                              : e.employmentStatus === 'LEAVE'
                                ? 'bg-amber-soft border-amber/20 text-amber'
                                : 'bg-panel-alt border-border text-ink3'
                              }`}>
                              {e.employmentStatus === 'ACTIVE' ? '재직' : e.employmentStatus === 'LEAVE' ? '휴직' : '퇴직'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-ink3">검색 조건에 일치하는 임직원이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== B. 회사 조직도 탭 ==================== */}
        {activeTab === 'org' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div>
              <h1 className="text-base font-extrabold text-ink">조직도 트리</h1>
              <p className="text-[11px] text-ink3 mt-0.5">회사 계층별 부서 트리와 소속 재직 직원 명단을 실시간으로 탐색합니다.</p>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 border border-border rounded-xl bg-panel overflow-hidden p-4">
              {/* 좌측 부서 트리 박스 */}
              <div className="border-r border-border pr-4 overflow-y-auto space-y-3">
                <h3 className="font-extrabold text-ink text-xs flex items-center gap-1">
                  <span>🏢</span>
                  <span>부서 목록</span>
                </h3>

                {/* 재귀 트리 렌더러 함수 */}
                <div className="select-none pl-1 space-y-1 text-[12px] font-bold">
                  {orgTree.map(function renderNode(node: OrgNode) {
                    const isCollapsed = collapsedDepts[node.id] || false;
                    const isLeaf = node.leaf || false;
                    const children = node.children || [];
                    const activeMembers = isLeaf ? getActiveDeptEmployees(node.name) : [];

                    return (
                      <div key={node.id} className="flex flex-col mt-0.5">
                        <div
                          onClick={() => {
                            if (!isLeaf) {
                              toggleDeptCollapse(node.id);
                            } else {
                              setSelectedDept(node.name);
                            }
                          }}
                          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${isLeaf
                            ? `hover:bg-teal-soft/10 text-ink ${selectedDept === node.name ? 'bg-teal-soft/15 text-teal font-extrabold' : ''}`
                            : 'hover:bg-black/5 text-ink2'
                            }`}
                        >
                          {!isLeaf && (
                            <span className="text-[10px] text-ink3 w-3 h-3 grid place-items-center">
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                          )}
                          <span>{isLeaf ? '📄' : '📁'}</span>
                          <span>{node.name}</span>
                          {isLeaf && (
                            <span className="text-[10px] text-teal font-extrabold ml-1">
                              ({activeMembers.length})
                            </span>
                          )}
                        </div>

                        {!isCollapsed && children.length > 0 && (
                          <div className="pl-4.5 border-l border-border/60 ml-2.5 my-0.5 gap-0.5 flex flex-col">
                            {children.map(renderNode)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 우측 소속 사원 리스트 박스 */}
              <div className="overflow-y-auto space-y-4">
                <h3 className="font-extrabold text-ink text-xs flex items-center gap-1.5 border-b border-border pb-2.5">
                  <span>👥</span>
                  <div className="flex items-center gap-1.5">
                    <span>부서 재직자 검색 명단 {selectedDept !== 'all' && `(${selectedDept})`}</span>
                  </div>
                  {selectedDept !== 'all' && (
                    <button
                      onClick={() => setSelectedDept('all')}
                      className="text-[10px] text-teal hover:underline font-bold bg-transparent border-none p-0 cursor-pointer"
                    >
                      전체 보기
                    </button>
                  )}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {employees
                    .filter((e) => e.employmentStatus !== 'RETIRED' && (selectedDept === 'all' || e.dept === selectedDept)) // 조직도에서는 퇴직자 무조건 자동 제외 원칙
                    .map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => setSelectedEmpId(emp.id)}
                        className="rounded-xl border border-border bg-panel p-3.5 flex items-center gap-3.5 hover:border-teal/30 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-soft text-[12px] font-bold text-teal">
                          {emp.name[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink truncate text-[12px]">{emp.name}</div>
                          <div className="text-[10px] text-ink3 mt-0.5 flex items-center gap-1.5 truncate">
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

        {/* ==================== F. 외부 거래처 주소록 탭 ==================== */}
        {activeTab === 'vendor' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-end justify-between border-b border-border pb-3 shrink-0">
              <div>
                <h1 className="text-base font-extrabold text-ink">외부 거래처 주소록</h1>
                <p className="text-[11px] text-ink3 mt-0.5">협력사 및 대외 거래처의 연락처 및 기본 정보를 파악하고 관리합니다.</p>
              </div>
              <ActionBar actions={[{ preset: 'add', label: '거래처 추가', onClick: () => setIsVendorCreateModalOpen(true) }, 'upload', 'download']} />
            </div>

            <FilterBar onSearch={() => setVendorApplied(vendorDraft)}>
              <FilterField label="거래 구분">
                <Select value={vendorDraft.type} onChange={(v) => setVendorDraft({ ...vendorDraft, type: v })} options={VENDOR_TYPE_OPTIONS} width={100} />
              </FilterField>
              <FilterField label="사용여부">
                <Select value={vendorDraft.use} onChange={(v) => setVendorDraft({ ...vendorDraft, use: v })} options={VENDOR_USE_OPTIONS} width={100} />
              </FilterField>
              <FilterField label="검색">
                <TextInput value={vendorDraft.q} onChange={(v) => setVendorDraft({ ...vendorDraft, q: v })} placeholder="거래처코드 / 거래처명" width={200} onEnter={() => setVendorApplied(vendorDraft)} />
              </FilterField>
            </FilterBar>

            <div className="flex-1 overflow-auto rounded-lg border border-border bg-panel">
              <table className="w-full border-collapse text-[11.5px] text-left">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/50 font-bold text-ink2">
                    {['거래처코드', '거래처명', '사업자번호', '대표자', '구분', '상태'].map((h, i) => (
                      <th key={h} className={`p-3 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 5 ? 'text-center' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isVendorLoading && (
                    <tr><td colSpan={6} className="p-8 text-center text-ink3">불러오는 중…</td></tr>
                  )}
                  {!isVendorLoading && vendorRows.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-ink3">조회된 거래처가 없습니다.</td></tr>
                  )}
                  {vendorRows.map((v) => {
                    return (
                      <tr 
                        key={v.code} 
                        onClick={() => openVendorDetailModal(v)} 
                        className="cursor-pointer border-b border-border transition-colors hover:bg-panel-alt/30"
                      >
                        <td className="p-3 font-bold text-teal font-mono">
                          {v.code}
                        </td>
                        <td className="p-3 font-semibold text-ink">{v.name}</td>
                        <td className="p-3 font-mono text-ink2">{v.bizNo || '-'}</td>
                        <td className="p-3 text-ink2">{v.ceo || '-'}</td>
                        <td className="p-3"><Pill tone={VENDOR_TYPE_TONE[v.type]}>{v.type}</Pill></td>
                        <td className="p-3 text-center"><Pill tone={v.use === '사용' ? 'ok' : 'mute'}>{v.use}</Pill></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 1) 거래처 상세 보기 및 수정 모달 */}
            {isVendorDetailModalOpen && curVendor && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-panel border border-border w-[440px] rounded-xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center border-b border-border pb-2 shrink-0">
                    <span className="font-extrabold text-navy text-[13px]">
                      {isVendorEditMode ? `⚙️ ${curVendor.name} 거래처 정보 수정` : `🤝 ${curVendor.name} 거래처 상세 정보`}
                    </span>
                    <button 
                      onClick={() => {
                        setIsVendorDetailModalOpen(false);
                        setIsVendorEditMode(false);
                      }} 
                      className="text-ink3 hover:text-ink font-bold text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleUpdateVendor} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래처코드</label>
                        <input
                          type="text"
                          value={curVendor.code}
                          disabled
                          className="h-9 w-full rounded-lg border border-border bg-panel-alt/50 px-3 outline-none text-ink3 font-mono text-[12px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래처명 (필수)</label>
                        <input
                          type="text"
                          value={editVendorName}
                          onChange={(e) => setEditVendorName(e.target.value)}
                          required
                          disabled={!isVendorEditMode}
                          className={`h-9 w-full rounded-lg border border-border px-3 outline-none focus:border-teal text-[12px] ${
                            !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">사업자번호</label>
                      <input
                        type="text"
                        value={editVendorBizNo}
                        onChange={(e) => setEditVendorBizNo(e.target.value)}
                        disabled={!isVendorEditMode}
                        placeholder="123-45-67890"
                        className={`h-9 w-full rounded-lg border border-border px-3 outline-none focus:border-teal font-mono text-[12px] ${
                          !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">대표자명</label>
                        <input
                          type="text"
                          value={editVendorCeo}
                          onChange={(e) => setEditVendorCeo(e.target.value)}
                          disabled={!isVendorEditMode}
                          className={`h-9 w-full rounded-lg border border-border px-3 outline-none focus:border-teal text-[12px] ${
                            !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                          }`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래 구분</label>
                        <select
                          value={editVendorType}
                          onChange={(e) => setEditVendorType(e.target.value as '매입' | '매출' | '외주')}
                          disabled={!isVendorEditMode}
                          className={`h-9.5 rounded-lg border border-border px-2 outline-none focus:border-teal text-[12px] ${
                            !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                          }`}
                        >
                          <option value="매입">매입</option>
                          <option value="매출">매출</option>
                          <option value="외주">외주</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">담당자</label>
                        <input
                          type="text"
                          value={editVendorManager}
                          onChange={(e) => setEditVendorManager(e.target.value)}
                          disabled={!isVendorEditMode}
                          className={`h-9 w-full rounded-lg border border-border px-3 outline-none focus:border-teal text-[12px] ${
                            !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                          }`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">사용 여부</label>
                        <select
                          value={editVendorUse}
                          onChange={(e) => setEditVendorUse(e.target.value as '사용' | '미사용')}
                          disabled={!isVendorEditMode}
                          className={`h-9.5 rounded-lg border border-border px-2 outline-none focus:border-teal text-[12px] ${
                            !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                          }`}
                        >
                          <option value="사용">사용</option>
                          <option value="미사용">미사용</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">주소</label>
                      <textarea
                        value={editVendorAddr}
                        onChange={(e) => setEditVendorAddr(e.target.value)}
                        disabled={!isVendorEditMode}
                        rows={2}
                        className={`w-full rounded-lg border border-border px-3 py-1.5 outline-none focus:border-teal text-[12px] ${
                          !isVendorEditMode ? 'bg-panel-alt/30 text-ink' : 'bg-panel text-ink'
                        }`}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
                      {isVendorEditMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsVendorEditMode(false)}
                            className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt text-[11.5px]"
                          >
                            취소
                          </button>
                          <button
                            type="submit"
                            className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90 text-[11.5px]"
                          >
                            저장 완료
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsVendorDetailModalOpen(false);
                            }}
                            className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt text-[11.5px]"
                          >
                            닫기
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsVendorEditMode(true)}
                            className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90 text-[11.5px]"
                          >
                            정보 수정
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2) 거래처 신규 등록 모달 */}
            {isVendorCreateModalOpen && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                <div className="bg-panel border border-border w-[440px] rounded-xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center border-b border-border pb-2 shrink-0">
                    <span className="font-extrabold text-navy text-[13px]">🤝 신규 거래처 등록</span>
                    <button onClick={() => setIsVendorCreateModalOpen(false)} className="text-ink3 hover:text-ink font-bold text-sm">✕</button>
                  </div>

                  <form onSubmit={handleCreateVendor} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래처코드 (필수)</label>
                        <input
                          type="text"
                          value={newVendorCode}
                          onChange={(e) => setNewVendorCode(e.target.value)}
                          placeholder="예: V-10050"
                          required
                          className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래처명 (필수)</label>
                        <input
                          type="text"
                          value={newVendorName}
                          onChange={(e) => setNewVendorName(e.target.value)}
                          required
                          className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">사업자번호</label>
                      <input
                        type="text"
                        value={newVendorBizNo}
                        onChange={(e) => setNewVendorBizNo(e.target.value)}
                        placeholder="123-45-67890"
                        className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">대표자명</label>
                        <input
                          type="text"
                          value={newVendorCeo}
                          onChange={(e) => setNewVendorCeo(e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">거래 구분</label>
                        <select
                          value={newVendorType}
                          onChange={(e) => setNewVendorType(e.target.value as '매입' | '매출' | '외주')}
                          className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                        >
                          <option value="매입">매입</option>
                          <option value="매출">매출</option>
                          <option value="외주">외주</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">담당자</label>
                        <input
                          type="text"
                          value={newVendorManager}
                          onChange={(e) => setNewVendorManager(e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-bold text-ink2">사용 여부</label>
                        <select
                          value={newVendorUse}
                          onChange={(e) => setNewVendorUse(e.target.value as '사용' | '미사용')}
                          className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                        >
                          <option value="사용">사용</option>
                          <option value="미사용">미사용</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-ink2">주소</label>
                      <textarea
                        value={newVendorAddr}
                        onChange={(e) => setNewVendorAddr(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-border bg-panel px-3 py-1.5 outline-none focus:border-teal text-[12px]"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsVendorCreateModalOpen(false)}
                        className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt text-[11.5px]"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90 text-[11.5px]"
                      >
                        등록 완료
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ==================== C. 임직원 상세 모달 패널 ==================== */}
      {selectedEmpId && selectedEmp && (
        <>
          {/* 백드롭 오버레이 */}
          <div
            onClick={() => setSelectedEmpId(null)}
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-0 m-auto h-[560px] w-[720px] max-w-[95vw] max-h-[90vh] shadow-2xl z-50 bg-panel border border-border rounded-3xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* 좌측 프로필 카드 영역 */}
            <div className="w-[240px] shrink-0 bg-gradient-to-b from-teal-soft/10 to-panel-alt/5 border-r border-border p-6 flex flex-col items-center justify-between select-none">
              <div className="w-full flex flex-col items-center mt-4">
                {/* 대형 프로필 이니셜 아바타 */}
                <div className="grid h-22 w-22 place-items-center rounded-full bg-teal text-white text-3xl font-black shadow-md border-3 border-panel">
                  {selectedEmp.name[0]}
                </div>
                
                {/* 임직원 핵심 성명/사번/직위 정보 */}
                <div className="text-base font-extrabold text-ink mt-4 text-center">
                  {selectedEmp.name}
                </div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-panel-alt text-ink2 font-mono mt-1.5">
                  {selectedEmp.employeeNo}
                </div>

                <div className="mt-5 text-center space-y-1">
                  <div className="text-xs font-bold text-teal">{selectedEmp.dept}</div>
                  <div className="text-[11px] font-semibold text-ink3">
                    {selectedEmp.position} {selectedEmp.duty && `· ${selectedEmp.duty}`}
                  </div>
                </div>
              </div>

              {/* 하단 입사 정보 안내 표시 */}
              <div className="w-full text-center py-2.5 px-3 rounded-xl bg-panel-alt/20 border border-border/40 text-[10.5px] text-ink3 leading-relaxed">
                📅 {selectedEmp.hireDate || '-'} 입사
              </div>
            </div>

            {/* 우측 상세정보 탭 및 필드 영역 */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-panel">
              {/* 모달 닫기 헤더 */}
              <div className="p-3.5 border-b border-border bg-panel-alt/5 flex items-center justify-end shrink-0">
                <button
                  onClick={() => setSelectedEmpId(null)}
                  className="text-ink3 hover:text-ink font-bold text-sm px-2 py-1 rounded hover:bg-panel-alt transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 모달 탭 셀렉터 */}
              <div className="flex border-b border-border shrink-0 text-[11.5px] font-bold bg-panel-alt/5">
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

              {/* 모달 스크롤 본문 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-[12px]">
                
                {/* 1) 인사 및 소속 정보 탭 */}
                {detailTab === 'work' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-3.5">
                      <div>
                        <span className="text-ink3 text-[11px] block">재직 상태</span>
                        <span className={`font-bold mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] border ${
                          selectedEmp.employmentStatus === 'ACTIVE'
                            ? 'bg-teal-soft/20 border-teal/20 text-teal'
                            : selectedEmp.employmentStatus === 'LEAVE'
                            ? 'bg-amber-soft border-amber/20 text-amber'
                            : 'bg-panel-alt border-border text-ink3'
                        }`}>
                          {selectedEmp.employmentStatus === 'ACTIVE' ? '재직 중' : selectedEmp.employmentStatus === 'LEAVE' ? '휴직' : '퇴직자'}
                        </span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">입사일</span>
                        <span className="font-semibold text-ink mt-1 block font-mono">{selectedEmp.hireDate || '-'}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">사번</span>
                        <span className="font-semibold text-ink mt-1 block font-mono">{selectedEmp.employeeNo}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">소속 부서</span>
                        <span className="font-semibold text-ink mt-1 block">{selectedEmp.dept}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">직급 / 직책</span>
                        <span className="font-semibold text-ink mt-1 block">{selectedEmp.position} {selectedEmp.duty && `(${selectedEmp.duty})`}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">업무 이메일</span>
                        <span className="font-semibold text-ink mt-1 block font-mono break-all">{selectedEmp.email || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-ink3 text-[11px] block">업무 연락처</span>
                        <span className="font-semibold text-ink mt-1 block font-mono">{selectedEmp.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2) 개인 신상 정보 탭 */}
                {detailTab === 'personal' && (
                  <div className="space-y-4">
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10.5px] text-amber-800 leading-relaxed font-bold">
                      🔒 본 정보는 주민등록번호, 주소 등 민감한 개인 신상정보를 포함하고 있으므로 열람 및 취급에 주의를 요합니다. (인사담당자 전용 화면)
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-3.5">
                      <div>
                        <span className="text-ink3 text-[11px] block">생년월일</span>
                        <span className="font-semibold text-ink mt-1 block font-mono">{selectedEmp.birthDate || '-'}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">성별</span>
                        <span className="font-semibold text-ink mt-1 block">{selectedEmp.gender || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-ink3 text-[11px] block">주민등록번호</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-semibold text-ink font-mono tracking-wider">
                            {showRrn 
                              ? (selectedEmp.rrn || '-') 
                              : (selectedEmp.rrn ? `${selectedEmp.rrn.split('-')[0]}-${selectedEmp.rrn.split('-')[1]?.charAt(0) || ''}******` : '-')}
                          </span>
                          {selectedEmp.rrn && (
                            <button
                              type="button"
                              onClick={() => setShowRrn(!showRrn)}
                              className="text-[10px] text-teal hover:underline font-bold bg-transparent border-none p-0 inline cursor-pointer"
                            >
                              {showRrn ? '🙈 숨기기' : '👁️ 전체보기'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="col-span-2">
                        <span className="text-ink3 text-[11px] block">주소</span>
                        <span className="font-semibold text-ink mt-1 block leading-relaxed">{selectedEmp.address || '-'}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">개인 이메일</span>
                        <span className="font-semibold text-ink mt-1 block font-mono break-all">{selectedEmp.personalEmail || '-'}</span>
                      </div>

                      <div>
                        <span className="text-ink3 text-[11px] block">비상 연락처</span>
                        <span className="font-semibold text-ink mt-1 block font-mono">{selectedEmp.emergencyPhone || '-'}</span>
                      </div>

                      <div className="col-span-2">
                        <span className="text-ink3 text-[11px] block">최종 학력</span>
                        <span className="font-semibold text-ink mt-1 block">{selectedEmp.education || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 모달 하단 관리 버튼 */}
              {isAdmin && selectedEmp.employmentStatus !== 'RETIRED' && (
                <div className="p-4 border-t border-border bg-panel-alt/10 flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedEmp)}
                    className="flex-1 rounded-lg bg-teal text-white py-2 font-bold hover:opacity-90 transition-opacity text-[11.5px]"
                  >
                    ⚙️ 정보 수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRetireEmployee(selectedEmp.id)}
                    className="flex-1 rounded-lg border border-red/20 text-red bg-red-soft/10 py-2 font-bold hover:bg-red-soft/20 transition-colors text-[11.5px]"
                  >
                    ⚠️ 퇴직 처리
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== D. 관리자 전용 신규 임직원 등록 모달 ==================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-panel border border-border w-[440px] rounded-xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-2 shrink-0">
              <span className="font-extrabold text-navy text-[13px]">👤 신규 임직원 등록</span>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-ink3 hover:text-ink font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">사번 (필수)</label>
                  <input
                    type="text"
                    value={newEmpNo}
                    onChange={(e) => setNewEmpNo(e.target.value)}
                    placeholder="사번 고유 식별코드"
                    required
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">이름 (필수)</label>
                  <input
                    type="text"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    placeholder="직원 이름"
                    required
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">소속 부서 (필수)</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="인사지원팀">인사지원팀</option>
                    <option value="재무관리팀">재무관리팀</option>
                    <option value="법무지원팀">법무지원팀</option>
                    <option value="AX개발본부">AX개발본부</option>
                    <option value="마케팅전략팀">마케팅전략팀</option>
                    <option value="임원실">임원실</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직급 (필수)</label>
                  <select
                    value={newEmpPos}
                    onChange={(e) => setNewEmpPos(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="사원">사원</option>
                    <option value="주임">주임</option>
                    <option value="대리">대리</option>
                    <option value="과장">과장</option>
                    <option value="차장">차장</option>
                    <option value="부장">부장</option>
                    <option value="상무">상무</option>
                    <option value="대표이사">대표이사</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직책</label>
                  <select
                    value={newEmpDuty}
                    onChange={(e) => setNewEmpDuty(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="팀원">팀원</option>
                    <option value="파트장">파트장</option>
                    <option value="팀장">팀장</option>
                    <option value="본부장">본부장</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">이메일 주소</label>
                <input
                  type="email"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  placeholder="name@workfit.co.kr"
                  className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">연락처</label>
                  <input
                    type="text"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">입사일</label>
                  <input
                    type="date"
                    value={newEmpHireDate}
                    onChange={(e) => setNewEmpHireDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                  />
                </div>
              </div>

              {/* 인사 신상정보 상세 추가 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">주민등록번호 (필수)</label>
                  <input
                    type="text"
                    value={newEmpRrn}
                    onChange={(e) => setNewEmpRrn(e.target.value)}
                    placeholder="900412-1056432"
                    required
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">최종 학력</label>
                  <input
                    type="text"
                    value={newEmpEducation}
                    onChange={(e) => setNewEmpEducation(e.target.value)}
                    placeholder="대학교 학사 졸업 등"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
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
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">비상 연락처</label>
                  <input
                    type="text"
                    value={newEmpEmergencyPhone}
                    onChange={(e) => setNewEmpEmergencyPhone(e.target.value)}
                    placeholder="010-9999-8888"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">주소</label>
                <input
                  type="text"
                  value={newEmpAddress}
                  onChange={(e) => setNewEmpAddress(e.target.value)}
                  placeholder="지번/도로명 주소 입력"
                  className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== E. 관리자 전용 임직원 정보 편집 모달 ==================== */}
      {isEditModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-panel border border-border w-[440px] rounded-xl p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-2 shrink-0">
              <span className="font-extrabold text-navy text-[13px]">⚙️ {selectedEmp.name} 사원 정보 수정</span>
              <button onClick={() => setIsEditModalOpen(false)} className="text-ink3 hover:text-ink font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">사번 (수정 불가)</label>
                  <input
                    type="text"
                    value={selectedEmp.employeeNo}
                    disabled
                    className="h-9 w-full rounded-lg border border-border bg-panel-alt/50 px-3 outline-none text-ink3 font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">이름 (필수)</label>
                  <input
                    type="text"
                    value={editEmpName}
                    onChange={(e) => setEditEmpName(e.target.value)}
                    required
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">소속 부서</label>
                  <select
                    value={editEmpDept}
                    onChange={(e) => setEditEmpDept(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="인사지원팀">인사지원팀</option>
                    <option value="재무관리팀">재무관리팀</option>
                    <option value="법무지원팀">법무지원팀</option>
                    <option value="AX개발본부">AX개발본부</option>
                    <option value="마케팅전략팀">마케팅전략팀</option>
                    <option value="임원실">임원실</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직급</label>
                  <select
                    value={editEmpPos}
                    onChange={(e) => setEditEmpPos(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="사원">사원</option>
                    <option value="주임">주임</option>
                    <option value="대리">대리</option>
                    <option value="과장">과장</option>
                    <option value="차장">차장</option>
                    <option value="부장">부장</option>
                    <option value="상무">상무</option>
                    <option value="대표이사">대표이사</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">직책</label>
                  <select
                    value={editEmpDuty}
                    onChange={(e) => setEditEmpDuty(e.target.value)}
                    className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                  >
                    <option value="팀원">팀원</option>
                    <option value="파트장">파트장</option>
                    <option value="팀장">팀장</option>
                    <option value="본부장">본부장</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">재직 상태</label>
                <select
                  value={editEmpStatus}
                  onChange={(e) => setEditEmpStatus(e.target.value as EmploymentStatus)}
                  className="h-9.5 rounded-lg border border-border bg-panel px-2 outline-none focus:border-teal text-[12px]"
                >
                  <option value="ACTIVE">재직</option>
                  <option value="LEAVE">휴직</option>
                  <option value="RETIRED">퇴직</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">이메일 주소</label>
                <input
                  type="email"
                  value={editEmpEmail}
                  onChange={(e) => setEditEmpEmail(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">연락처</label>
                  <input
                    type="text"
                    value={editEmpPhone}
                    onChange={(e) => setEditEmpPhone(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">입사일</label>
                  <input
                    type="date"
                    value={editEmpHireDate}
                    onChange={(e) => setEditEmpHireDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                  />
                </div>
              </div>

              {/* 신상정보 편집 추가 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">주민등록번호</label>
                  <input
                    type="text"
                    value={editEmpRrn}
                    onChange={(e) => setEditEmpRrn(e.target.value)}
                    placeholder="900412-1056432"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">최종 학력</label>
                  <input
                    type="text"
                    value={editEmpEducation}
                    onChange={(e) => setEditEmpEducation(e.target.value)}
                    placeholder="대학교 학사 졸업 등"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
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
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-ink2">비상 연락처</label>
                  <input
                    type="text"
                    value={editEmpEmergencyPhone}
                    onChange={(e) => setEditEmpEmergencyPhone(e.target.value)}
                    placeholder="010-9999-8888"
                    className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal font-mono text-[12px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">주소</label>
                <input
                  type="text"
                  value={editEmpAddress}
                  onChange={(e) => setEditEmpAddress(e.target.value)}
                  placeholder="지번/도로명 주소 입력"
                  className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[12px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90"
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