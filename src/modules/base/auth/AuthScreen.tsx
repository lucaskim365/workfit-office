import { useState, useMemo } from 'react';
import { Card } from '@/shared/ui/Card';
import {
  SYSTEM_SCREENS,
  PERM_CATEGORIES,
  type RoleGroup,
  type PermCategoryId,
  type ActionPermission,
} from '@/domain/roleGroup/schema';
import { useRoleGroups, useSaveRoleGroup, useDeleteRoleGroup } from '@/features/roleGroup/useRoleGroups';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { SelectorDialog } from '@/modules/gw/approval/components/DraftRecipientSection';
import { ROLE_GROUP_SEED, getDefaultPermissionsForGroup } from '@/data/seeds/roleGroup.seed';

const DEFAULT_ACTIONS: ActionPermission = {
  access: false,
  create: false,
  update: false,
  delete: false,
};

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-border text-teal focus:ring-teal cursor-pointer disabled:opacity-40"
    />
  );
}

export default function AuthScreen() {
  const org = useOrgTree();
  const { data: rawGroups = [] } = useRoleGroups() as { data: RoleGroup[] | undefined };
  const saveGroup = useSaveRoleGroup();
  const deleteGroup = useDeleteRoleGroup();

  const effectiveGroups = useMemo(() => {
    const list = (rawGroups && rawGroups.length > 0) ? rawGroups : ROLE_GROUP_SEED;
    const map = new Map<string, RoleGroup>();
    list.forEach((g) => {
      const codeKey = g.code.toUpperCase();
      const hasPerms = g.menuPermissions && Object.keys(g.menuPermissions).length > 0;
      const formatted: RoleGroup = {
        ...g,
        menuPermissions: hasPerms ? g.menuPermissions : getDefaultPermissionsForGroup(g.code, g.name),
      };
      if (!map.has(codeKey)) {
        map.set(codeKey, formatted);
      }
    });
    return Array.from(map.values());
  }, [rawGroups]);

  const [selectedCode, setSelectedCode] = useState('ADMIN');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'matrix'>('matrix');
  const [selectedCat, setSelectedCat] = useState<PermCategoryId | 'ALL'>('ALL');
  const [msg, setMsg] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // 현재 편집 중인 단일 draft 상태
  const [currentDraft, setCurrentDraft] = useState<RoleGroup | null>(null);

  // 팝업 선택기 상태
  const [pickerOpen, setPickerOpen] = useState(false);

  // 선택된 그룹이 변경되거나 최초 로드 시 draft 동기화
  const selectedGroup: RoleGroup = useMemo(() => {
    if (isCreatingNew && currentDraft) {
      return currentDraft;
    }
    if (currentDraft && currentDraft.code === selectedCode) {
      return currentDraft;
    }
    const found = effectiveGroups.find((g) => g.code === selectedCode) || effectiveGroups[0];
    const hasPerms = found?.menuPermissions && Object.keys(found.menuPermissions).length > 0;
    const base = found ? {
      ...found,
      menuPermissions: hasPerms ? found.menuPermissions : getDefaultPermissionsForGroup(found.code, found.name),
    } : {
      id: 'ADMIN',
      code: 'ADMIN',
      name: '관리자',
      desc: '',
      use: true,
      isSystem: true,
      userIds: [],
      deptIds: ['D240'],
      positionRanks: [],
      menuPermissions: getDefaultPermissionsForGroup('ADMIN', '관리자'),
      members: [],
      permissions: [],
    };
    return base;
  }, [currentDraft, selectedCode, effectiveGroups, isCreatingNew]);

  const updateSelectedGroup = (patch: Partial<RoleGroup>) => {
    setCurrentDraft((prev) => ({ ...(prev || selectedGroup), ...patch }));
  };

  const updatePermission = (screenId: string, patch: Partial<ActionPermission>) => {
    const s = SYSTEM_SCREENS.find((sc) => sc.id === screenId || sc.url === screenId);
    const key = s?.id || screenId;
    const currentMap = { ...(selectedGroup.menuPermissions || {}) };
    const existing = currentMap[key] || { ...DEFAULT_ACTIONS };
    currentMap[key] = { ...existing, ...patch };
    updateSelectedGroup({ menuPermissions: currentMap });
  };

  const setCategoryAll = (catId: PermCategoryId, checked: boolean) => {
    const currentMap = { ...(selectedGroup.menuPermissions || {}) };
    SYSTEM_SCREENS.filter((s) => s.category === catId).forEach((s) => {
      const supported = s.supportedActions || ['access', 'create', 'update', 'delete'];
      currentMap[s.id] = {
        access: supported.includes('access') ? checked : false,
        create: supported.includes('create') ? checked : false,
        update: supported.includes('update') ? checked : false,
        delete: supported.includes('delete') ? checked : false,
      };
    });
    updateSelectedGroup({ menuPermissions: currentMap });
  };

  const setRowAll = (screenId: string, checked: boolean) => {
    const s = SYSTEM_SCREENS.find((sc) => sc.id === screenId || sc.url === screenId);
    const key = s?.id || screenId;
    const supported = s?.supportedActions || ['access', 'create', 'update', 'delete'];
    const currentMap = { ...(selectedGroup.menuPermissions || {}) };
    currentMap[key] = {
      access: supported.includes('access') ? checked : false,
      create: supported.includes('create') ? checked : false,
      update: supported.includes('update') ? checked : false,
      delete: supported.includes('delete') ? checked : false,
    };
    updateSelectedGroup({ menuPermissions: currentMap });
  };

  const handleCreateNewGroup = () => {
    const newGroup: RoleGroup = {
      id: '',
      code: '',
      name: '',
      desc: '',
      use: true,
      isSystem: false,
      userIds: [],
      deptIds: [],
      positionRanks: [],
      menuPermissions: {},
      members: [],
      permissions: [],
    };
    setIsCreatingNew(true);
    setCurrentDraft(newGroup);
    setSelectedCode('');
    setMsg('새 권한 그룹 생성 모드입니다. 그룹명과 고유 영문 코드를 입력한 후 저장하세요.');
  };

  const handleSave = () => {
    if (!selectedGroup) return;
    const trimmedCode = selectedGroup.code.trim().toUpperCase();
    const trimmedName = selectedGroup.name.trim();

    if (!trimmedCode) {
      alert('역할 그룹 코드를 입력해주세요. (예: FINANCE, HR_LEAD)');
      return;
    }
    if (!trimmedName) {
      alert('역할 그룹명을 입력해주세요.');
      return;
    }

    if (isCreatingNew) {
      const isDuplicate = effectiveGroups.some(
        (g) => g.code.toUpperCase() === trimmedCode
      );
      if (isDuplicate) {
        alert(`이미 존재하는 그룹 코드(${trimmedCode})입니다. 다른 코드를 입력해주세요.`);
        return;
      }
    }

    const payloadToSave: RoleGroup = {
      ...selectedGroup,
      id: trimmedCode,
      code: trimmedCode,
      name: trimmedName,
    };

    saveGroup.mutate(payloadToSave, {
      onSuccess: () => {
        setIsCreatingNew(false);
        setCurrentDraft(null);
        setSelectedCode(trimmedCode);
        setMsg(`[${trimmedName}] 그룹 권한이 안전하게 저장되었습니다.`);
        setTimeout(() => setMsg(''), 3000);
      },
      onError: (err) => {
        setMsg(`저장 실패: ${String(err)}`);
      },
    });
  };

  const handleDeleteGroup = () => {
    if (!selectedGroup) return;
    if (selectedGroup.isSystem || selectedGroup.code === 'ADMIN' || selectedGroup.code === 'USER') {
      alert('시스템 기본 그룹은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`[${selectedGroup.name} (${selectedGroup.code})] 그룹을 완전히 삭제하시겠습니까?`)) {
      return;
    }
    deleteGroup.mutate(selectedGroup.code, {
      onSuccess: () => {
        setIsCreatingNew(false);
        setCurrentDraft(null);
        setSelectedCode('ADMIN');
        setMsg(`[${selectedGroup.name}] 그룹이 성공적으로 삭제되었습니다.`);
        setTimeout(() => setMsg(''), 3000);
      },
      onError: (err) => {
        setMsg(`삭제 실패: ${String(err)}`);
      },
    });
  };

  const filteredGroups: RoleGroup[] = useMemo(() => {
    const map = new Map<string, RoleGroup>();
    effectiveGroups.forEach((g) => {
      map.set(g.code.toUpperCase(), g);
    });
    if (isCreatingNew && currentDraft) {
      map.set('__CREATING_NEW__', {
        ...currentDraft,
        code: currentDraft.code || 'NEW',
        name: currentDraft.name || '(새 그룹 작성 중)',
      });
    }
    const list = Array.from(map.values());
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((g: RoleGroup) => g.code.toLowerCase().includes(q) || g.name.toLowerCase().includes(q));
  }, [effectiveGroups, isCreatingNew, currentDraft, search]);

  const visibleScreens = useMemo(() => {
    if (selectedCat === 'ALL') return SYSTEM_SCREENS;
    return SYSTEM_SCREENS.filter((s) => s.category === selectedCat);
  }, [selectedCat]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 상단 타이틀 바 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">그룹권한관리</h1>
          <p className="mt-0.5 text-xs text-ink3">
            역할 그룹별로 전체 35개 화면의 접근 권한 및 세부 액션(작성·수정·삭제·엑셀·관리)을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="text-[12px] font-bold text-teal">{msg}</span>}
          {!isCreatingNew && selectedGroup && !selectedGroup.isSystem && selectedGroup.code !== 'ADMIN' && selectedGroup.code !== 'USER' && (
            <button
              type="button"
              onClick={handleDeleteGroup}
              disabled={deleteGroup.isPending}
              className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-[12px] font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
            >
              {deleteGroup.isPending ? '삭제 중…' : '그룹 삭제'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCreateNewGroup}
            className="rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-panel-alt transition-colors cursor-pointer"
          >
            + 새 권한 그룹
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveGroup.isPending}
            className="rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white hover:bg-teal-dark transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saveGroup.isPending ? '저장 중…' : '변경사항 저장'}
          </button>
        </div>
      </div>

      {/* 2-Panel 레이아웃 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[320px_1fr]">
        {/* [좌측 패널] 권한 그룹 목록 */}
        <Card title="역할 그룹 목록" bodyClassName="p-0">
          <div className="border-b border-border p-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="그룹명 또는 코드 검색"
              className="h-8 w-full rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
            />
          </div>
          <div className="max-h-[650px] overflow-y-auto divide-y divide-border">
            {filteredGroups.map((g) => {
              const isTempItem = isCreatingNew && (g.code === 'NEW' || g.name === '(새 그룹 작성 중)' || g === currentDraft);
              const active = isTempItem || (!isCreatingNew && g.code === selectedCode);
              return (
                <button
                  key={isTempItem ? '__CREATING_NEW__' : g.code}
                  type="button"
                  onClick={() => {
                    if (!isTempItem) {
                      setIsCreatingNew(false);
                      setCurrentDraft(null);
                      setSelectedCode(g.code);
                      setMsg('');
                    }
                  }}
                  className={`flex w-full items-start justify-between p-3 text-left transition-colors cursor-pointer ${
                    active ? 'bg-teal-soft/40 border-l-4 border-l-teal' : 'hover:bg-panel-alt'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[12.5px] font-bold truncate ${active ? 'text-teal' : 'text-ink'}`}>
                        {g.name}
                      </span>
                      {g.isSystem ? (
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9.5px] font-bold text-ink3 border border-border">
                          시스템
                        </span>
                      ) : (
                        <span className="rounded bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-600 border border-blue-200 dark:border-blue-800">
                          커스텀
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-ink3 mt-0.5">{g.code}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      g.use ? 'bg-teal-soft text-teal' : 'bg-slate-100 text-ink3'
                    }`}
                  >
                    {g.use ? '사용' : '미사용'}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* [우측 패널] 그룹 상세 및 권한 매트릭스 */}
        {selectedGroup ? (
          <div className="space-y-3.5">
            {/* 서브 탭 헤더 */}
            <div className="flex items-center justify-between border-b border-border bg-panel px-4 pt-3 rounded-t-xl">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('matrix')}
                  className={`pb-2.5 px-3 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'matrix'
                      ? 'border-teal text-teal font-extrabold'
                      : 'border-transparent text-ink3 hover:text-ink'
                  }`}
                >
                  화면 및 기능 권한 매트릭스
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('members')}
                  className={`pb-2.5 px-3 text-[13px] font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'members'
                      ? 'border-teal text-teal font-extrabold'
                      : 'border-transparent text-ink3 hover:text-ink'
                  }`}
                >
                  기본 정보 & 대상자 설정 ({selectedGroup.userIds?.length ?? 0}명 / {selectedGroup.deptIds?.length ?? 0}개 부서)
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroup.use}
                  onChange={(e) => updateSelectedGroup({ use: e.target.checked })}
                  className="rounded border-border text-teal focus:ring-teal"
                />
                그룹 활성화(사용)
              </label>
            </div>

            {/* 탭 1: 기본 정보 & 대상자 설정 */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                {selectedGroup.code === 'ADMIN' && (
                  <div className="rounded-lg bg-teal-soft/50 border border-teal/20 p-3 text-[12px] text-teal-dark font-medium flex items-center justify-between">
                    <div>
                      <span className="font-bold mr-1.5">[시스템 고정]</span>
                      최고 관리자 권한은 <strong>데이터플랫폼 개발팀(D240)</strong> 부서에 시스템 기본으로 고정 배정되어 있습니다.
                    </div>
                  </div>
                )}
                {selectedGroup.code === 'USER' && (
                  <div className="rounded-lg bg-panel-alt border border-border p-3 text-[12px] text-ink2 font-medium flex items-center justify-between">
                    <div>
                      <span className="font-bold mr-1.5">[시스템 기본]</span>
                      전사 모든 임직원이 기본 포함되는 그룹입니다. 대상자는 고정되어 있으며, 권한 매트릭스를 통해 기본 권한 범위를 조정할 수 있습니다.
                    </div>
                  </div>
                )}

                <Card title="1. 그룹 기본 정보">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-ink3 mb-1">역할 그룹명</label>
                      <input
                        disabled={!isCreatingNew && (selectedGroup.code === 'ADMIN' || selectedGroup.code === 'USER')}
                        value={selectedGroup.name}
                        onChange={(e) => updateSelectedGroup({ name: e.target.value })}
                        placeholder="예: 재무담당자"
                        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12px] text-ink outline-none focus:border-teal disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink3 mb-1">
                        역할 그룹 코드 {isCreatingNew ? (
                          <span className="text-[10px] font-normal text-teal">(영문 대문자/숫자/_ 만 가능)</span>
                        ) : (
                          <span className="text-[10px] font-normal text-ink3">(고유 식별자 · 변경 불가)</span>
                        )}
                      </label>
                      <input
                        disabled={!isCreatingNew}
                        value={selectedGroup.code}
                        onChange={(e) => {
                          if (isCreatingNew) {
                            const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
                            updateSelectedGroup({ code: upper, id: upper });
                          }
                        }}
                        placeholder="예: FINANCE, HR_LEAD"
                        className={`w-full rounded-lg border border-border-hi px-3 py-1.5 text-[12px] font-mono font-semibold outline-none ${
                          isCreatingNew
                            ? 'bg-panel text-ink focus:border-teal'
                            : 'bg-panel-alt/60 text-ink2 cursor-not-allowed opacity-80'
                        }`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-ink3 mb-1">설명</label>
                      <textarea
                        rows={2}
                        disabled={selectedGroup.code === 'ADMIN'}
                        value={selectedGroup.desc}
                        onChange={(e) => updateSelectedGroup({ desc: e.target.value })}
                        placeholder="해당 권한 그룹의 용도 및 담당 역할을 입력하세요."
                        className="w-full rounded-lg border border-border-hi bg-panel p-2.5 text-[12px] text-ink outline-none focus:border-teal disabled:opacity-60"
                      />
                    </div>
                  </div>
                </Card>

                <Card
                  title="2. 대상자 바인딩 (소속 사원 / 부서 / 직급)"
                  action={
                    selectedGroup.code !== 'ADMIN' && selectedGroup.code !== 'USER' ? (
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="rounded bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-dark transition-colors cursor-pointer"
                      >
                        + 사원/부서 추가
                      </button>
                    ) : undefined
                  }
                >
                  <div className="space-y-4">
                    {/* 지정 사원 */}
                    <div>
                      <div className="text-[11.5px] font-bold text-ink mb-1.5">
                        지정 사원 ({selectedGroup.userIds?.length ?? 0}명)
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-dashed border-border bg-panel-alt/30">
                        {selectedGroup.code === 'ADMIN' ? (
                          <span className="text-[11px] text-ink3 my-auto">지정 부서(데이터플랫폼 개발팀) 소속 임직원 전체에게 자동 상속됩니다.</span>
                        ) : selectedGroup.code === 'USER' ? (
                          <span className="text-[11px] text-ink3 my-auto">전사 모든 임직원이 기본 포함됩니다.</span>
                        ) : (selectedGroup.userIds ?? []).length === 0 ? (
                          <span className="text-[11px] text-ink3 my-auto">지정된 개별 사원이 없습니다.</span>
                        ) : (
                          selectedGroup.userIds?.map((uid) => {
                            const u = org.userById(uid);
                            return (
                              <span
                                key={uid}
                                className="inline-flex items-center gap-1 rounded-md bg-teal-soft px-2 py-1 text-[11px] font-bold text-teal border border-teal/20"
                              >
                                <span>[사원]</span>
                                <span>{u ? `${u.name} (${u.dept}, ${u.position})` : uid}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedGroup({
                                      userIds: selectedGroup.userIds?.filter((id) => id !== uid),
                                    })
                                  }
                                  className="ml-1 hover:text-red-500 font-bold cursor-pointer text-[11px]"
                                >
                                  ✕
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 지정 부서 */}
                    <div>
                      <div className="text-[11.5px] font-bold text-ink mb-1.5">
                        지정 부서 ({selectedGroup.deptIds?.length ?? 0}개 부서)
                      </div>
                      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-dashed border-border bg-panel-alt/30">
                        {(selectedGroup.deptIds ?? []).length === 0 ? (
                          <span className="text-[11px] text-ink3 my-auto">지정된 부서가 없습니다.</span>
                        ) : (
                          selectedGroup.deptIds?.map((did) => {
                            // 부서 ID(did)를 기준으로 org.depts에서 이름 동적 조회
                            const d = org.depts.find((dept) => dept.id === did);
                            const deptName = d?.name || (did === 'D240' ? '데이터플랫폼 개발팀' : did);
                            const isLockedDept = selectedGroup.code === 'ADMIN' && did === 'D240';

                            return (
                              <span
                                key={did}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-soft px-2 py-1 text-[11px] font-bold text-navy border border-blue-200"
                              >
                                <span>[부서]</span>
                                <span>{deptName}</span>
                                {!isLockedDept && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSelectedGroup({
                                        deptIds: selectedGroup.deptIds?.filter((id) => id !== did),
                                      })
                                    }
                                    className="ml-1 hover:text-red-500 font-bold cursor-pointer text-[11px]"
                                  >
                                    ✕
                                  </button>
                                )}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* 직급 서열 바인딩 */}
                    <div>
                      <div className="text-[11.5px] font-bold text-ink mb-1.5">직급 서열 범위 자동 포함</div>
                      <div className="flex flex-wrap gap-2 p-2.5 rounded-lg border border-border bg-panel">
                        {org.positions
                          .slice()
                          .sort((a: any, b: any) => a.rank - b.rank)
                          .map((p: any) => {
                            const checked = selectedGroup.code === 'ADMIN'
                              ? false
                              : (selectedGroup.positionRanks?.includes(p.rank) ?? false);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-center gap-1.5 text-[11.5px] font-medium text-ink2 mr-2 ${
                                  selectedGroup.code === 'ADMIN' || selectedGroup.code === 'USER'
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer'
                                }`}
                              >
                                <Checkbox
                                  disabled={selectedGroup.code === 'ADMIN' || selectedGroup.code === 'USER'}
                                  checked={checked}
                                  onChange={(c) => {
                                    const current = selectedGroup.positionRanks ?? [];
                                    const next = c ? [...current, p.rank] : current.filter((r) => r !== p.rank);
                                    updateSelectedGroup({ positionRanks: next });
                                  }}
                                />
                                <span>{p.name}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* 탭 2: 메뉴 & 기능 권한 매트릭스 */}
            {activeTab === 'matrix' && (
              <Card
                title={`전체 화면 권한 매트릭스 (${visibleScreens.length}개 화면)`}
                action={
                  selectedGroup.code !== 'ADMIN' ? (
                    <div className="flex items-center gap-1">
                      {selectedCat !== 'ALL' && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCategoryAll(selectedCat, true)}
                            className="rounded border border-border px-2 py-1 text-[11px] font-bold text-teal hover:bg-teal-soft transition-colors cursor-pointer"
                          >
                            카테고리 허용
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryAll(selectedCat, false)}
                            className="rounded border border-border px-2 py-1 text-[11px] font-bold text-ink3 hover:bg-panel-alt transition-colors cursor-pointer"
                          >
                            카테고리 해제
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextMap = { ...(selectedGroup.menuPermissions || {}) };
                          SYSTEM_SCREENS.forEach((s) => {
                            nextMap[s.id] = {
                              access: true,
                              create: true,
                              update: true,
                              delete: true,
                            };
                          });
                          updateSelectedGroup({ menuPermissions: nextMap });
                        }}
                        className="rounded border border-border px-2 py-1 text-[11px] font-bold text-teal hover:bg-teal-soft transition-colors cursor-pointer"
                      >
                        전체 허용
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedGroup({ menuPermissions: {} })}
                        className="rounded border border-border px-2 py-1 text-[11px] font-bold text-ink3 hover:bg-panel-alt transition-colors cursor-pointer"
                      >
                        전체 초기화
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-teal bg-teal-soft px-2 py-0.5 rounded">
                      상시 전체 허용 (고정)
                    </span>
                  )
                }
                bodyClassName="p-0"
              >
                {selectedGroup.code === 'ADMIN' && (
                  <div className="bg-teal-soft/40 border-b border-teal/20 px-3 py-2 text-[11.5px] text-teal-dark font-medium">
                    최고 관리자 그룹은 시스템 전역의 모든 메뉴 및 기능에 대한 전체 접근 권한이 상시 보장됩니다.
                  </div>
                )}

                {/* 카테고리 필터 탭 */}
                <div className="flex flex-wrap items-center gap-1 border-b border-border bg-panel-alt/40 p-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCat('ALL')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                      selectedCat === 'ALL' ? 'bg-teal text-white' : 'text-ink3 hover:bg-panel'
                    }`}
                  >
                    전체 모듈 ({SYSTEM_SCREENS.length})
                  </button>
                  {PERM_CATEGORIES.map((cat) => {
                    const count = SYSTEM_SCREENS.filter((s) => s.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCat(cat.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                          selectedCat === cat.id ? 'bg-teal text-white' : 'text-ink3 hover:bg-panel'
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* 매트릭스 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-border bg-panel-alt/70 text-ink2 font-bold text-[11px]">
                        <th className="px-3 py-2 w-32">모듈 구분</th>
                        <th className="px-3 py-2">화면명 (URL)</th>
                        <th className="px-2 py-2 text-center w-16">접근</th>
                        <th className="px-2 py-2 text-center w-20">작성/수정</th>
                        <th className="px-2 py-2 text-center w-16">삭제</th>
                        <th className="px-3 py-2 text-center w-20">행 일괄</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleScreens.map((s) => {
                        const supported = s.supportedActions || ['access', 'create', 'update', 'delete'];
                        const perm = selectedGroup.code === 'ADMIN'
                          ? { access: true, create: true, update: true, delete: true }
                          : (selectedGroup.menuPermissions?.[s.id] ||
                             selectedGroup.menuPermissions?.[s.url] || { ...DEFAULT_ACTIONS });
                        const isAllChecked = supported.every((act) => perm[act]);
                        const catLabel = PERM_CATEGORIES.find((c) => c.id === s.category)?.name || s.category;
                        const isAdmin = selectedGroup.code === 'ADMIN';
                        const isWriteSupported = supported.includes('create') || supported.includes('update');
                        const isWriteChecked = perm.create || perm.update;

                        return (
                          <tr key={s.id} className="hover:bg-panel-alt/50 transition-colors">
                            <td className="px-3 py-2 font-semibold text-ink3">{catLabel}</td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-ink">{s.name}</div>
                              <div className="text-[10px] font-mono text-ink3">{s.url}</div>
                            </td>
                            <td className="px-2 py-2 text-center">
                              {supported.includes('access') ? (
                                <Checkbox
                                  disabled={isAdmin}
                                  checked={perm.access}
                                  onChange={(c) => updatePermission(s.id, { access: c })}
                                />
                              ) : (
                                <span className="text-ink4 font-mono text-[11px] select-none">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {isWriteSupported ? (
                                <Checkbox
                                  disabled={isAdmin}
                                  checked={isWriteChecked}
                                  onChange={(c) => updatePermission(s.id, { create: c, update: c })}
                                />
                              ) : (
                                <span className="text-ink4 font-mono text-[11px] select-none">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {supported.includes('delete') ? (
                                <Checkbox
                                  disabled={isAdmin}
                                  checked={perm.delete}
                                  onChange={(c) => updatePermission(s.id, { delete: c })}
                                />
                              ) : (
                                <span className="text-ink4 font-mono text-[11px] select-none">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                disabled={isAdmin}
                                onClick={() => setRowAll(s.id, !isAllChecked)}
                                className={`rounded px-2 py-0.5 text-[10.5px] font-bold transition-colors ${
                                  isAdmin
                                    ? 'opacity-40 cursor-not-allowed text-ink3'
                                    : isAllChecked
                                    ? 'bg-teal-soft text-teal hover:bg-teal-soft/80'
                                    : 'border border-border text-ink3 hover:bg-panel-alt'
                                }`}
                              >
                                {isAllChecked ? '전체 해제' : '전체 선택'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>

      {/* 사원/부서 선택 모달 다이얼로그 */}
      {pickerOpen && (
        <SelectorDialog
          title="권한 그룹 대상자 추가"
          org={org}
          singleSelect={false}
          onConfirm={(items: any[]) => {
            const addedUserIds = items.filter((x) => x.type === 'user').map((x) => x.id);
            const addedDeptIds = items.filter((x) => x.type === 'dept').map((x) => x.id);

            const currentUserIds = selectedGroup?.userIds ?? [];
            const currentDeptIds = selectedGroup?.deptIds ?? [];

            const nextUsers = Array.from(new Set([...currentUserIds, ...addedUserIds]));
            const nextDepts = Array.from(new Set([...currentDeptIds, ...addedDeptIds]));

            updateSelectedGroup({ userIds: nextUsers, deptIds: nextDepts });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
