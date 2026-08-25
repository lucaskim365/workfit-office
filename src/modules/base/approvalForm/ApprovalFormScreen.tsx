import { useMemo, useState, useEffect, useRef } from 'react';
import {
  useApprovalForms,
  useUpsertApprovalForm,
  useRemoveApprovalForm,
  useApprovalFolders,
  useUpsertApprovalFolder,
  useRemoveApprovalFolder,
} from '@/features/gw/useApprovalForms';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { FIELD_TYPES, RESERVED_BODY_KEY, amountFieldOf, type ApprovalForm, type FormField, type FieldType, type FieldValue, type ApprovalFolder } from '@/domain/approvalForm/schema';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { DynamicField } from '@/modules/gw/approval/formFields';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';

// 결재선 규칙(룰) 관리를 위해 추가된 임포트
import { useRouteRules, useRemoveRouteRule, useUpsertRouteRule } from '@/features/gw/useRouteRules';
import { useJobTitles } from '@/features/jobTitle/useJobTitles';
import { resolveRoute } from '@/domain/approvalRoute/engine';
import {
  RESOLVERS,
  ROUTE_STEP_KINDS,
  type ApprovalRouteRule,
  type Resolver,
  type RouteStep,
} from '@/domain/approvalRoute/schema';
import { DEPT_TYPES } from '@/domain/department/schema';
import { SelectorDialog } from '@/modules/gw/approval/components/DraftRecipientSection';

/**
 * 결재서식 관리 (기준정보) — 문서 서식 CRUD + 필드 빌더 + 미리보기(상신폼/인쇄) + 폴더 기능.
 */
const RESOLVER_LABEL: Record<Resolver, string> = {
  MANAGER: '직속 상급자',
  DEPT_HEAD: '소속 부서장',
  PARENT_DEPT_HEAD: '상위 부서장(level)',
  ROLE_CEO: '대표',
  ROLE_DIVISION_HEAD: '본부장',
  POSITION_AT_LEAST: '직급 이상',
  SPECIFIC_USER: '특정 사용자',
  SPECIFIC_DEPT_HEAD: '특정 부서장',
};
const ARG_HINT: Partial<Record<Resolver, string>> = {
  PARENT_DEPT_HEAD: 'level(예: 1)', POSITION_AT_LEAST: 'rank(예: 3)',
  SPECIFIC_USER: 'userId', SPECIFIC_DEPT_HEAD: 'deptId',
};

const blankRule = (formId: string, docType: string): ApprovalRouteRule => ({
  id: '', name: '', priority: 50, active: true, formId, docType,
  conditionKey: null, conditionValues: [],
  deptScope: { kind: '전체', deptId: null, deptType: null },
  positionFromRank: null, positionToRank: null,
  amountFrom: null, amountTo: null,
  steps: [{ resolver: 'DEPT_HEAD', arg: null, kind: '전결', dedupeSelf: true, optional: false }],
});

const blankField = (): FormField => ({
  key: '', label: '', type: '텍스트', required: false, options: [], placeholder: '', width: 'full', section: '', isAmountKey: false, visibleIf: null, isTabSelector: false, isSecret: false, tabOverrides: {},
});

const blankForm = (folderId: string | null = null): ApprovalForm => ({
  id: '', code: '', name: '', icon: '📄', docTitle: '', closing: '', active: true, order: 99, system: false, folderId,
  recipientDeptId: null, recipientUserId: null, recipientDrafter: false,
  executionDeptId: null, executionUserId: null, preservationPeriod: '5년',
  allowedPositionFromRank: null, allowedPositionToRank: null, allowedDeptIds: [],
  fields: [{ ...blankField(), key: 'body', label: '본문', type: '장문', required: true }],
});

export default function ApprovalFormScreen() {
  const { data: forms = [] } = useApprovalForms();
  const { data: folders = [] } = useApprovalFolders();
  const upsert = useUpsertApprovalForm();
  const remove = useRemoveApprovalForm();

  const upsertFolder = useUpsertApprovalFolder();
  const removeFolder = useRemoveApprovalFolder();

  const [sel, setSel] = useState<ApprovalForm | null>(null);
  const [msg, setMsg] = useState('');

  // 현재 선택된 폴더 필터 (null 이면 전체, 'root' 이면 루트 미지정 서식들)
  const [selFolderId, setSelFolderId] = useState<string | null>(null);

  // 폴더 & 서식 통합 트리뷰의 각 폴더별 열림/닫힘 아코디언 상태
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    root: true, // 루트(미지정) 폴더는 기본적으로 열어둡니다.
  });
  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // 폴더 컨텍스트 메뉴 상태
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; folder: ApprovalFolder } | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setFolderMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const save = async () => {
    if (!sel) return;
    if (!sel.code.trim()) return setMsg('코드를 입력하세요.');
    if (!sel.name.trim()) return setMsg('서식명을 입력하세요.');
    await upsert.mutateAsync({ ...sel, id: sel.code.trim() });
    setMsg('저장되었습니다 — 상신·인쇄에 즉시 반영됩니다.');
    setSel(null);
  };
  const del = async (form: ApprovalForm) => {
    if (form.system) return;
    await remove.mutateAsync(form.id);
    if (sel?.id === form.id) setSel(null);
  };
  const duplicate = (form: ApprovalForm) => {
    setSel({ ...form, id: '', code: `${form.code}_사본`, name: `${form.name} 사본`, system: false, order: 99 });
    setMsg('');
  };

  // 폴더 추가
  const addFolder = async () => {
    const name = prompt('새 폴더 이름을 입력하세요:');
    if (!name || !name.trim()) return;
    const id = `fld-${Date.now()}`;
    await upsertFolder.mutateAsync({ id, name: name.trim(), order: folders.length + 1 });
  };

  // 폴더 이름 변경
  const renameFolder = async (folder: ApprovalFolder) => {
    const name = prompt('변경할 폴더 이름을 입력하세요:', folder.name);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    await upsertFolder.mutateAsync({ ...folder, name: name.trim() });
  };

  // 폴더 삭제 (내부 서식은 루트로 구출)
  const delFolder = async (folder: ApprovalFolder) => {
    if (!confirm(`'${folder.name}' 폴더를 삭제하시겠습니까?\n내부에 속해있던 서식은 최상위 루트로 이동됩니다.`)) return;
    await removeFolder.mutateAsync(folder.id);
    if (selFolderId === folder.id) setSelFolderId(null);
  };

  // 폴더 드래그 앤 드롭 정렬 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // 로컬 폴더 순서 상태 (드래그앤드롭 즉시 렌더용)
  const [localFolders, setLocalFolders] = useState<ApprovalFolder[]>([]);

  useEffect(() => {
    if (draggedIdx === null && JSON.stringify(localFolders) !== JSON.stringify(folders)) {
      setLocalFolders(folders);
    }
  }, [folders, draggedIdx, localFolders]);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    // 로컬 데이터 순서를 교환하여 화면을 실시간으로 다시 렌더링
    const nextFolders = [...localFolders];
    const draggedItem = nextFolders[draggedIdx];
    nextFolders.splice(draggedIdx, 1);
    nextFolders.splice(targetIdx, 0, draggedItem);
    
    setLocalFolders(nextFolders);
    setDraggedIdx(targetIdx);
  };

  const handleDragEnd = async () => {
    if (draggedIdx === null) return;
    setDraggedIdx(null);

    // 정렬 완료된 localFolders 기준으로 order 속성을 매핑하여 DB 일괄 업데이트
    for (let i = 0; i < localFolders.length; i++) {
      const f = localFolders[i];
      const nextOrder = i + 1;
      if (f.order !== nextOrder) {
        await upsertFolder.mutateAsync({ ...f, order: nextOrder });
      }
    }
  };

  return (
    <div className="flex flex-col gap-3.5 relative">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">결재서식 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 결재서식 관리 · 전자결재 문서 양식(유형·필드·격식) 디자인</p>
        </div>
        <button onClick={() => { setSel(blankForm(selFolderId && selFolderId !== 'root' ? selFolderId : null)); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 서식 추가</button>
      </div>

      <div className="grid grid-cols-[280px_1fr] items-start gap-3.5">
        {/* 폴더 & 서식 통합 트리뷰 패널 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-panel">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-[11.5px] font-bold text-ink2">
            <span>폴더 & 서식 목록</span>
            <button type="button" onClick={addFolder} className="text-[10px] text-teal hover:underline font-bold">+ 폴더 추가</button>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto max-h-[75vh]">
            
            {/* 1. 루트(미지정) 폴더 */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleFolder('root')}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-[9px] text-ink3 w-3 select-none">{openFolders['root'] ? '▼' : '▶'}</span>
                  <span>📁 루트 (미지정)</span>
                </span>
                <span className="text-[10.5px] opacity-60 font-normal">{forms.filter(f => !f.folderId).length}</span>
              </button>
              {openFolders['root'] && (
                <div className="pl-4 border-l border-border/60 ml-3.5 my-1 space-y-0.5">
                  {forms.filter(f => !f.folderId).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSel(f); setMsg(''); }}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                        sel?.id === f.id ? 'bg-teal-soft font-bold text-teal' : 'text-ink hover:bg-panel-alt'
                      }`}
                    >
                      <span className="text-[14px]">{f.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px]">
                        {f.name}
                        {f.system && <span className="ml-1 rounded bg-ink3/10 px-1 py-0.5 text-[8.5px] font-bold text-ink3">기본</span>}
                        {!f.active && <span className="ml-1 text-[9px] text-red-500 font-bold">중지</span>}
                      </span>
                    </button>
                  ))}
                  {forms.filter(f => !f.folderId).length === 0 && (
                    <div className="py-2 pl-2 text-[10.5px] text-ink3">등록된 서식이 없습니다.</div>
                  )}
                </div>
              )}
            </div>

            <div className="my-1 border-t border-border-hi" />

            {/* 2. 각 폴더 트리 */}
            {localFolders.map((f, idx) => {
              const folderForms = forms.filter(form => form.folderId === f.id);
              const isOpen = !!openFolders[f.id];
              return (
                <div key={f.id} className="space-y-0.5">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleFolder(f.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const zoom = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--font-scale') || '1.1875') || 1;
                      setFolderMenu({ x: e.clientX / zoom, y: e.clientY / zoom, folder: f });
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-bold cursor-grab active:cursor-grabbing transition-all ${
                      draggedIdx === idx ? 'opacity-30 border border-dashed border-teal scale-95' : 'text-ink2 hover:bg-panel-alt'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-[9px] text-ink3 w-3 select-none">{isOpen ? '▼' : '▶'}</span>
                      <span className="truncate">📁 {f.name}</span>
                    </span>
                    <span className="text-[10.5px] opacity-60 font-normal">{folderForms.length}</span>
                  </button>
                  {isOpen && (
                    <div className="pl-4 border-l border-border/60 ml-3.5 my-1 space-y-0.5">
                      {folderForms.map((formItem) => (
                        <button
                          key={formItem.id}
                          type="button"
                          onClick={() => { setSel(formItem); setMsg(''); }}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                            sel?.id === formItem.id ? 'bg-teal-soft font-bold text-teal' : 'text-ink hover:bg-panel-alt'
                          }`}
                        >
                          <span className="text-[14px]">{formItem.icon}</span>
                          <span className="min-w-0 flex-1 truncate text-[12px]">
                            {formItem.name}
                            {formItem.system && <span className="ml-1 rounded bg-ink3/10 px-1 py-0.5 text-[8.5px] font-bold text-ink3">기본</span>}
                            {!formItem.active && <span className="ml-1 text-[9px] text-red-500 font-bold">중지</span>}
                          </span>
                        </button>
                      ))}
                      {folderForms.length === 0 && (
                        <div className="py-2 pl-2 text-[10.5px] text-ink3">등록된 서식이 없습니다.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 편집기 + 미리보기 */}
        <div className="rounded-xl border border-border bg-panel p-4">
          {sel ? (
            <FormEditor form={sel} folders={folders} onChange={setSel} onSave={save} onCancel={() => setSel(null)}
              onDelete={!sel.id ? undefined : () => del(sel)} onDuplicate={sel.id ? () => duplicate(sel) : undefined}
              saving={upsert.isPending} msg={msg} />
          ) : (
            <div className="py-20 text-center text-[12px] text-ink3">좌측에서 서식을 선택하거나 추가하세요.</div>
          )}
        </div>
      </div>

      {/* 폴더 컨텍스트 우클릭 메뉴 */}
      {folderMenu && (
        <div
          ref={folderMenuRef}
          className="fixed z-[100] w-32 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-lg"
          style={{ top: folderMenu.y, left: folderMenu.x }}
        >
          <button
            onClick={() => renameFolder(folderMenu.folder)}
            className="block w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-panel-alt transition-colors"
          >
            ✏️ 이름 변경
          </button>
          <button
            onClick={() => delFolder(folderMenu.folder)}
            className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-panel-alt transition-colors"
          >
            🗑️ 폴더 삭제
          </button>
        </div>
      )}
    </div>
  );
}

function FormEditor({ form, folders, onChange, onSave, onCancel, onDelete, onDuplicate, saving, msg }: {
  form: ApprovalForm; folders: ApprovalFolder[]; onChange: (f: ApprovalForm) => void; onSave: () => void; onCancel: () => void;
  onDelete?: () => void; onDuplicate?: () => void; saving: boolean; msg: string;
}) {
  const org = useOrgTree();
  const { depts = [], users = [] } = org;
  const [selTab, setSelTab] = useState('공통');

  // 룰 데이터 쿼리 및 뮤테이션 주입
  const { data: rules = [], isLoading: rulesLoading } = useRouteRules();
  const upsertRule = useUpsertRouteRule();
  const removeRule = useRemoveRouteRule();

  const [selRule, setSelRule] = useState<ApprovalRouteRule | null>(null);
  const [ruleMsg, setRuleMsg] = useState('');

  const formRules = useMemo(() => {
    return rules.filter(
      (r) => r.formId === form.id || (r.formId === null && r.docType === form.code)
    ).sort((a, b) => a.priority - b.priority);
  }, [rules, form.id, form.code]);

  // 서식편집 / 서식설정 / 결재규칙 설정을 제어할 대분류 탭 상태
  const [activeMenuTab, setActiveMenuTab] = useState<'edit' | 'settings' | 'rules'>('edit');

  // 실제 사내 직책 데이터 연동 및 정렬
  const { data: jobTitles = [] } = useJobTitles();

  const getJobTitleRank = (name: string) => {
    if (name.includes('대표')) return 1;
    if (name.includes('본부장')) return 2;
    if (name.includes('임원') || name.includes('이사')) return 3;
    if (name.includes('팀장')) return 4;
    if (name.includes('파트장')) return 5;
    return 6;
  };

  const sortedJobs = useMemo(() => {
    return jobTitles
      .map((j) => j.name)
      .filter((v, i, self) => self.indexOf(v) === i)
      .sort((a, b) => getJobTitleRank(a) - getJobTitleRank(b));
  }, [jobTitles]);

  const minJob = useMemo(() => {
    if (!form.allowedJobTitles || form.allowedJobTitles.length === 0) return '';
    const sorted = form.allowedJobTitles.slice().sort((a, b) => getJobTitleRank(b) - getJobTitleRank(a));
    return sorted[0] || '';
  }, [form.allowedJobTitles]);

  const maxJob = useMemo(() => {
    if (!form.allowedJobTitles || form.allowedJobTitles.length === 0) return '';
    const sorted = form.allowedJobTitles.slice().sort((a, b) => getJobTitleRank(a) - getJobTitleRank(b));
    return sorted[0] || '';
  }, [form.allowedJobTitles]);

  const handleJobChange = (minVal: string | null, maxVal: string | null) => {
    if (!minVal && !maxVal) {
      set({ allowedJobTitles: [] });
      return;
    }
    const minRank = minVal ? getJobTitleRank(minVal) : 999;
    const maxRank = maxVal ? getJobTitleRank(maxVal) : -999;
    const allPossible = sortedJobs;
    const filteredJobs = allPossible.filter((j) => {
      const r = getJobTitleRank(j);
      return r >= maxRank && r <= minRank;
    });
    set({ allowedJobTitles: filteredJobs });
  };

  const [limitState, setLimitState] = useState<'ALL' | 'LIMITED'>(() => {
    const hasLimit = (form.allowedDeptIds && form.allowedDeptIds.length > 0) ||
                     (form.allowedUserIds && form.allowedUserIds.length > 0) ||
                     form.allowedPositionFromRank !== null ||
                     form.allowedPositionToRank !== null ||
                     (form.allowedJobTitles && form.allowedJobTitles.length > 0);
    return hasLimit ? 'LIMITED' : 'ALL';
  });

  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [execModalOpen, setExecModalOpen] = useState(false);

  useEffect(() => {
    const hasLimit = (form.allowedDeptIds && form.allowedDeptIds.length > 0) ||
                     (form.allowedUserIds && form.allowedUserIds.length > 0) ||
                     form.allowedPositionFromRank !== null ||
                     form.allowedPositionToRank !== null ||
                     (form.allowedJobTitles && form.allowedJobTitles.length > 0);
    setLimitState(hasLimit ? 'LIMITED' : 'ALL');
  }, [form.id]);

  const saveRule = async () => {
    if (!selRule) return;
    if (!selRule.name.trim()) return setRuleMsg('룰 이름을 입력하세요.');
    
    const nextId = () => `RR-${rules.length + 1}-${Math.max(0, ...rules.map((r) => Number(r.id.split('-')[1]) || 0)) + 1}`;
    
    // 서식과 룰의 정합성을 100% 보장하도록 formId와 docType을 강제 연동하여 저장
    const ruleToSave = {
      ...selRule,
      id: selRule.id || nextId(),
      formId: form.id,
      docType: form.code,
    };
    
    await upsertRule.mutateAsync(ruleToSave);
    setRuleMsg('규칙이 저장되었습니다.');
    setSelRule(null);
  };

  const delRule = async (ruleId: string) => {
    if (!confirm('이 결재 규칙을 삭제하시겠습니까?')) return;
    await removeRule.mutateAsync(ruleId);
    setSelRule(null);
  };

  const tabSelectorField = form.fields.find((f) => f.type === '선택' && f.isTabSelector);

  useEffect(() => {
    if (!tabSelectorField) {
      setSelTab('공통');
    } else if (!tabSelectorField.options.includes(selTab) && selTab !== '공통') {
      setSelTab('공통');
    }
  }, [tabSelectorField, selTab]);

  const set = (patch: Partial<ApprovalForm>) => onChange({ ...form, ...patch });
  const setField = (i: number, patch: Partial<FormField>) => {
    let nextFields = form.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    if (patch.isTabSelector) {
      nextFields = nextFields.map((f, idx) => (idx === i ? f : { ...f, isTabSelector: false }));
    }
    set({ fields: nextFields });
  };
  const addField = () => {
    const visibleIf = selTab === '공통' ? null : `${tabSelectorField?.key}:${selTab}`;
    set({ fields: [...form.fields, { ...blankField(), key: `field${form.fields.length + 1}`, visibleIf }] });
  };
  const delField = (i: number) => set({ fields: form.fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= form.fields.length) return;
    const next = [...form.fields]; [next[i], next[j]] = [next[j], next[i]]; set({ fields: next });
  };

  return (
    <div className="space-y-4">
      {/* 서식 편집 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{form.id ? `서식 편집 · ${form.code}` : '새 서식'}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> 사용</label>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-border mb-2">
        <button
          type="button"
          onClick={() => setActiveMenuTab('edit')}
          className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
            activeMenuTab === 'edit'
              ? 'border-teal text-teal font-extrabold'
              : 'border-transparent text-ink3 hover:text-ink hover:border-border'
          }`}
        >
          📝 서식 편집
        </button>
        <button
          type="button"
          onClick={() => setActiveMenuTab('settings')}
          className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
            activeMenuTab === 'settings'
              ? 'border-teal text-teal font-extrabold'
              : 'border-transparent text-ink3 hover:text-ink hover:border-border'
          }`}
        >
          ⚙️ 서식 설정 (보안·수신처)
        </button>
        {form.id && (
          <button
            type="button"
            onClick={() => setActiveMenuTab('rules')}
            className={`px-4 py-2 text-[12.5px] font-bold border-b-2 transition-all ${
              activeMenuTab === 'rules'
                ? 'border-teal text-teal font-extrabold'
                : 'border-transparent text-ink3 hover:text-ink hover:border-border'
            }`}
          >
            ⚖️ 결재규칙 설정 ({formRules.length})
          </button>
        )}
      </div>

      {/* 탭 내용 분기 */}
      {activeMenuTab === 'edit' && (
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-4 gap-2">
            <F label="아이콘"><input value={form.icon} onChange={(e) => set({ icon: e.target.value })} className={`${inp}`} /></F>
            <F label="서식명"><input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="출장신청서" className={`${inp}`} /></F>
            <F label="코드(문서유형)"><input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="출장" className={`${inp}`} /></F>
            <F label="소속 폴더">
              <select
                value={form.folderId || ''}
                onChange={(e) => set({ folderId: e.target.value || null })}
                className={`${inp}`}
              >
                <option value="">루트 (미지정)</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </F>
            <F label="정렬"><input type="number" value={form.order} onChange={(e) => set({ order: Number(e.target.value) })} className={`${inp}`} /></F>
            <div className="col-span-3"><F label="격식 문서명(인쇄)"><input value={form.docTitle} onChange={(e) => set({ docTitle: e.target.value })} placeholder="출 장 신 청 서" className={`${inp}`} /></F></div>
            <div className="col-span-4"><F label="맺음말(인쇄)"><input value={form.closing} onChange={(e) => set({ closing: e.target.value })} placeholder="위와 같이 신청하오니 재가하여 주시기 바랍니다." className={`${inp}`} /></F></div>
          </div>

          {/* 입력 필드 설정 (상시 펼침) */}
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 text-[12px] font-bold text-ink select-none">
              📋 입력 필드 설정 ({form.fields.length}개)
            </div>

            <div className="mt-3 space-y-3">
              {tabSelectorField && (
                <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-1">
                  {['공통', ...tabSelectorField.options].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSelTab(tab)}
                      className={`rounded-t-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        selTab === tab
                          ? 'bg-teal text-white'
                          : 'text-ink2 hover:bg-panel-alt'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {form.fields
                  .map((f, i) => ({ f, i }))
                  .filter(({ f }) => {
                    if (selTab === '공통') return !f.visibleIf;
                    return f.visibleIf === `${tabSelectorField?.key}:${selTab}`;
                  })
                  .map(({ f, i }) => {
                    const isCommonInTab = f.type === '선택' && f.isTabSelector;
                    return (
                      <div key={i} className="rounded-lg border border-border bg-panel px-3 py-2.5 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={f.key}
                            onChange={(e) => setField(i, { key: e.target.value })}
                            placeholder="필드 key (영문)"
                            className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <input
                            value={f.label}
                            onChange={(e) => setField(i, { label: e.target.value })}
                            placeholder="라벨 (한글)"
                            className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <select
                            value={f.type}
                            onChange={(e) => setField(i, { type: e.target.value as FieldType })}
                            className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            value={f.placeholder}
                            onChange={(e) => setField(i, { placeholder: e.target.value })}
                            placeholder="placeholder / 테이블 스키마 JSON"
                            className="w-32 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          <select
                            value={f.width}
                            onChange={(e) => setField(i, { width: e.target.value as FormField['width'] })}
                            className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                          >
                            <option value="full">100%</option>
                            <option value="half">50%</option>
                          </select>
                          <input
                            value={f.section ?? ''}
                            onChange={(e) => setField(i, { section: e.target.value || '' })}
                            placeholder="섹션명 (선택)"
                            className="w-24 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11.5px] text-ink outline-none"
                          />
                          
                          <label className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer" title="금액결재 규칙 대조 시 사용됩니다.">
                            <input
                              type="checkbox"
                              checked={f.isAmountKey ?? false}
                              onChange={(e) => setField(i, { isAmountKey: e.target.checked })}
                              className="h-3 w-3"
                            />
                            금액키
                          </label>

                          {!isCommonInTab && (
                            <select
                              value={f.visibleIf ?? ''}
                              onChange={(e) => setField(i, { visibleIf: e.target.value || null })}
                              className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                            >
                              <option value="">언제나 노출</option>
                              {form.fields
                                .filter((other) => other.type === '선택' && other.key && other.label)
                                .flatMap((other) =>
                                  other.options.map((opt) => (
                                    <option key={`${other.key}:${opt}`} value={`${other.key}:${opt}`}>
                                      [{other.label}] "{opt}" 일 때
                                    </option>
                                  ))
                                )}
                            </select>
                          )}
                          <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} className="h-3 w-3" />필수</label>
                          <label className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer" title="열람 권한에 따라 텍스트 마스킹 및 블러 처리됩니다.">
                            <input
                              type="checkbox"
                              checked={f.isSecret ?? false}
                              onChange={(e) => setField(i, { isSecret: e.target.checked })}
                              className="h-3 w-3"
                            />
                            보안필드
                          </label>
                          {f.type === '선택' && (
                            <label className="flex items-center gap-0.5 text-[10px] text-ink3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={f.isTabSelector ?? false}
                                onChange={(e) => setField(i, { isTabSelector: e.target.checked })}
                                className="h-3 w-3"
                              />
                              탭분할
                            </label>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            {!isCommonInTab && <button type="button" onClick={() => moveField(i, -1)} className="text-[9px] text-ink3 hover:text-ink">▲</button>}
                            {!isCommonInTab && <button type="button" onClick={() => moveField(i, 1)} className="text-[9px] text-ink3 hover:text-ink">▼</button>}
                            {!isCommonInTab && <button type="button" onClick={() => delField(i)} className="text-[12px] text-ink3 hover:text-red-500">✕</button>}
                          </div>
                        </div>
                        {(f.type === '선택' || f.type === '다중선택') && (
                          <div className="mt-1 w-full">
                            <span className="text-[9.5px] text-ink3">옵션 목록 (쉼표 구분)</span>
                            <OptionsInput value={f.options} onChange={(parsed) => setField(i, { options: parsed })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <button type="button" onClick={addField} className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal">+ 필드 추가</button>
              <p className="mt-1 text-[10.5px] text-ink3">예약 key <b>body</b>(장문)=문서 본문 · 금액 필드에 <b>금액키</b> 지정 시 결재선 금액매칭에 사용.</p>
            </div>
          </div>

          {/* 폼 미리보기 */}
          <FormPreview form={form} onChangeField={setField} />
        </div>
      )}

      {/* 탭 2: 서식 설정 */}
      {activeMenuTab === 'settings' && (
        <div className="space-y-6">
          {/* 🔒 1. 서식 기본 보안정책 설정 */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="text-[13px] font-bold text-ink flex items-center gap-1.5 border-b border-border pb-2.5">
              <span>🔒 1. 서식 기본 보안정책 설정</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="기본 보안 등급">
                <select
                  value={form.securityLevel || '일반'}
                  onChange={(e) => set({ securityLevel: e.target.value as any })}
                  className={`${inp} font-semibold ${
                    form.securityLevel === '극비'
                      ? 'text-red-600 bg-red-500/5'
                      : form.securityLevel === '대외비'
                      ? 'text-amber-600 bg-amber-500/5'
                      : 'text-ink'
                  }`}
                >
                  <option value="일반">일반 문서</option>
                  <option value="대외비">🔒 대외비</option>
                  <option value="극비">⛔ 극비</option>
                </select>
              </F>
              <F label="기본 공개 범위">
                <select
                  value={form.visibility || '부서'}
                  onChange={(e) => set({ visibility: e.target.value as any })}
                  className={`${inp} font-semibold text-ink`}
                >
                  <option value="전사">전사 공개</option>
                  <option value="부서">부서 공개</option>
                  <option value="비공개">비공개</option>
                </select>
              </F>
              <F label="보존연한">
                <select
                  value={form.preservationPeriod || '5년'}
                  onChange={(e) => set({ preservationPeriod: e.target.value })}
                  className={`${inp}`}
                >
                  <option value="1년">1년</option>
                  <option value="3년">3년</option>
                  <option value="5년">5년</option>
                  <option value="10년">10년</option>
                  <option value="영구">영구</option>
                </select>
              </F>
            </div>
            <div className="text-[10.5px] text-ink3 mt-1">서식을 기안할 때 적용될 기본 보안 등급, 부서/전사 공개 범위, 그리고 문서의 법적 보존연한을 설정합니다.</div>
          </div>

          {/* 👥 2. 기안 권한 설정 */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">👥 2. 기안 권한 설정</span>
              <div className="flex items-center gap-4 text-[11.5px] font-semibold text-ink2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="limitState"
                    checked={limitState === 'ALL'}
                    onChange={() => {
                      setLimitState('ALL');
                      set({
                        allowedDeptIds: [],
                        allowedUserIds: [],
                        allowedPositionFromRank: null,
                        allowedPositionToRank: null,
                        allowedJobTitles: []
                      });
                    }}
                    className="text-teal focus:ring-teal h-3.5 w-3.5"
                  />
                  모든 임직원 (기본값)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="limitState"
                    checked={limitState === 'LIMITED'}
                    onChange={() => setLimitState('LIMITED')}
                    className="text-teal focus:ring-teal h-3.5 w-3.5"
                  />
                  지정된 대상만 기안 허용
                </label>
              </div>
            </div>

            {limitState === 'LIMITED' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-3 gap-4">
                  {/* 직급 설정 */}
                  <div className="space-y-3">
                    <div className="text-[11.5px] font-bold text-ink2">기안 가능 직급 범위</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최소 기안직급 (최하위)</label>
                        <select
                          value={form.allowedPositionFromRank ?? ''}
                          onChange={(e) => set({ allowedPositionFromRank: e.target.value === '' ? null : Number(e.target.value) })}
                          className={`${inp} text-center`}
                        >
                          <option value="">제한 없음</option>
                          {org.positions.slice().sort((a, b) => b.rank - a.rank).map((p) => (
                            <option key={p.id} value={p.rank}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-ink3 font-bold mt-4 shrink-0">~</span>
                      <div className="flex-1">
                        <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최대 기안직급 (최상위)</label>
                        <select
                          value={form.allowedPositionToRank ?? ''}
                          onChange={(e) => set({ allowedPositionToRank: e.target.value === '' ? null : Number(e.target.value) })}
                          className={`${inp} text-center`}
                        >
                          <option value="">제한 없음</option>
                          {org.positions.slice().sort((a, b) => a.rank - b.rank).map((p) => (
                            <option key={p.id} value={p.rank}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 직책 설정 */}
                  <div className="space-y-3">
                    <div className="text-[11.5px] font-bold text-ink2">기안 가능 직책 범위</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최소 기안직책 (최하위)</label>
                        <select
                          value={minJob}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            handleJobChange(val, maxJob || null);
                          }}
                          className={`${inp} text-center`}
                        >
                          <option value="">제한 없음</option>
                          {sortedJobs.slice().reverse().map((j) => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-ink3 font-bold mt-4 shrink-0">~</span>
                      <div className="flex-1">
                        <label className="mb-0.5 block text-[10.5px] font-semibold text-ink3 text-center">최대 기안직책 (최상위)</label>
                        <select
                          value={maxJob}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            handleJobChange(minJob || null, val);
                          }}
                          className={`${inp} text-center`}
                        >
                          <option value="">제한 없음</option>
                          {sortedJobs.map((j) => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 부서 설정 */}
                  <div className="space-y-2.5">
                    <div className="text-[11.5px] font-bold text-ink2">기안 가능 부서 지정</div>
                    <div>
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const currentDepts = form.allowedDeptIds ?? [];
                          if (!currentDepts.includes(val)) {
                            set({ allowedDeptIds: [...currentDepts, val] });
                          }
                        }}
                        className={inp}
                      >
                        <option value="">허용 부서 선택 및 추가...</option>
                        {depts
                          .filter((d) => !(form.allowedDeptIds ?? []).includes(d.id))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* 부서 뱃지 리스트 */}
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-lg border border-dashed border-border p-2 bg-panel-alt/30 max-h-[75px] overflow-y-auto">
                      {(form.allowedDeptIds ?? []).map((did) => {
                        const d = depts.find((dept) => dept.id === did);
                        if (!d) return null;
                        return (
                          <span
                            key={did}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-soft text-teal text-[11px] font-semibold border border-teal/15"
                          >
                            <span>📁 {d.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextDepts = (form.allowedDeptIds ?? []).filter((id) => id !== did);
                                set({ allowedDeptIds: nextDepts });
                              }}
                              className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10px]"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                      {(form.allowedDeptIds ?? []).length === 0 && (
                        <div className="text-[10.5px] text-ink3 my-auto pl-1">지정된 허용 부서가 없습니다.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 예외 허용 사용자 지정 */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11.5px] font-bold text-ink2">기안 가능 예외 사용자 지정</div>
                    <div className="w-[240px]">
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const currentList = form.allowedUserIds ?? [];
                          if (!currentList.includes(val)) {
                            set({ allowedUserIds: [...currentList, val] });
                          }
                        }}
                        className={inp}
                      >
                        <option value="">예외 사원 선택 및 추가...</option>
                        {users
                          .filter((u) => u.status === '사용' && !(form.allowedUserIds ?? []).includes(u.id))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.dept} / {u.position})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* 예외 사원 뱃지 리스트 */}
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-lg border border-dashed border-border p-2 bg-panel-alt/30 max-h-[75px] overflow-y-auto">
                    {(form.allowedUserIds ?? []).map((uid) => {
                      const u = users.find((user) => user.id === uid);
                      if (!u) return null;
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal/10 text-teal text-[11px] font-semibold border border-teal/20"
                        >
                          <span>👤 {u.name}</span>
                          <span className="text-[10px] text-teal/70 font-medium">({u.dept} / {u.position})</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextList = (form.allowedUserIds ?? []).filter((id) => id !== uid);
                              set({ allowedUserIds: nextList });
                            }}
                            className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10px]"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                    {(form.allowedUserIds ?? []).length === 0 && (
                      <div className="text-[10.5px] text-ink3 my-auto pl-1">지정된 예외 사용자가 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 📨 3. 기본 수신처 설정 */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">📨 3. 기본 수신처 설정</span>
              <button
                type="button"
                onClick={() => setRecipientModalOpen(true)}
                className="px-2.5 py-1 rounded bg-teal text-white text-[11px] font-bold hover:bg-teal-dark transition-colors cursor-pointer shadow-xs"
              >
                🎯 대상 선택
              </button>
            </div>

            <div className="flex items-center min-h-[38px] rounded-lg border border-dashed border-border p-2.5 bg-panel-alt/30">
              {form.recipientDeptId || form.recipientUserId ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-soft text-teal text-[11.5px] font-bold border border-teal/15 shadow-2xs">
                  {form.recipientDeptId ? (
                    <>📁 {depts.find((d) => d.id === form.recipientDeptId)?.name || '알 수 없는 부서'}</>
                  ) : (
                    <>👤 {users.find((u) => u.id === form.recipientUserId)?.name || '알 수 없는 사원'}</>
                  )}
                  <button
                    type="button"
                    onClick={() => set({ recipientDeptId: null, recipientUserId: null })}
                    className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10.5px]"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <div className="text-[11px] text-ink3 my-auto pl-1">지정된 기본 수신 대상이 없습니다. (지정 안 함)</div>
              )}
            </div>
            <div className="text-[10.5px] text-ink3">문서 결재가 완료된 후 본 문서가 기본적으로 수신 공유되는 대상을 정합니다.</div>
          </div>

          {/* 📢 4. 기본 시행처 설정 */}
          <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">📢 4. 기본 시행처 설정</span>
              <button
                type="button"
                onClick={() => setExecModalOpen(true)}
                className="px-2.5 py-1 rounded bg-teal text-white text-[11px] font-bold hover:bg-teal-dark transition-colors cursor-pointer shadow-xs"
              >
                🎯 대상 선택
              </button>
            </div>

            <div className="flex items-center min-h-[38px] rounded-lg border border-dashed border-border p-2.5 bg-panel-alt/30">
              {form.executionDeptId || form.executionUserId ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-soft text-teal text-[11.5px] font-bold border border-teal/15 shadow-2xs">
                  {form.executionDeptId ? (
                    <>📁 {depts.find((d) => d.id === form.executionDeptId)?.name || '알 수 없는 부서'}</>
                  ) : (
                    <>👤 {users.find((u) => u.id === form.executionUserId)?.name || '알 수 없는 사원'}</>
                  )}
                  <button
                    type="button"
                    onClick={() => set({ executionDeptId: null, executionUserId: null })}
                    className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10.5px]"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <div className="text-[11px] text-ink3 my-auto pl-1">지정된 기본 시행 대상이 없습니다. (지정 안 함)</div>
              )}
            </div>
            <div className="text-[10.5px] text-ink3">결재 완료 후 문서의 구체적인 업무 협조 및 실행/시행 임무가 할당되는 대상 부서 또는 담당자를 지정합니다.</div>
          </div>

          {/* 수신/시행처 지정 SelectorDialog 컴포넌트 마운트 */}
          {recipientModalOpen && (
            <SelectorDialog
              title="기본 수신 대상 설정"
              org={org}
              singleSelect={true}
              onConfirm={(items: any[]) => {
                if (items.length === 0) {
                  set({ recipientDeptId: null, recipientUserId: null });
                } else {
                  const item = items[0];
                  if (item.type === 'dept') {
                    set({ recipientDeptId: item.id, recipientUserId: null });
                  } else {
                    set({ recipientDeptId: null, recipientUserId: item.id });
                  }
                }
              }}
              onClose={() => setRecipientModalOpen(false)}
            />
          )}

          {execModalOpen && (
            <SelectorDialog
              title="기본 시행 대상 설정"
              org={org}
              singleSelect={true}
              onConfirm={(items: any[]) => {
                if (items.length === 0) {
                  set({ executionDeptId: null, executionUserId: null });
                } else {
                  const item = items[0];
                  if (item.type === 'dept') {
                    set({ executionDeptId: item.id, executionUserId: null });
                  } else {
                    set({ executionDeptId: null, executionUserId: item.id });
                  }
                }
              }}
              onClose={() => setExecModalOpen(false)}
            />
          )}
        </div>
      )}

      {/* 탭 3: 결재규칙 설정 */}
      {activeMenuTab === 'rules' && form.id && (
        <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="text-[13px] font-bold text-ink">⚖️ 해당 서식 전용 결재 규칙 설정 ({formRules.length}개)</div>
              <div className="text-[10.5px] text-ink3 mt-0.5">이 서식 기안 시 기안자의 부서·직급 및 결재 조건에 매칭되어 작동할 결재선 규칙 목록입니다.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelRule(blankRule(form.id, form.code));
                setRuleMsg('');
              }}
              className="rounded-lg bg-teal px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90"
            >
              + 규칙 추가
            </button>
          </div>

          {rulesLoading ? (
            <div className="py-8 text-center text-[12px] text-ink3">로딩 중...</div>
          ) : formRules.length === 0 ? (
            <div className="py-12 text-center text-[12px] border border-dashed border-border rounded-xl text-ink3">
              등록된 서식 전용 규칙이 없습니다. 기본 전결 규칙이나 폴백이 적용됩니다.
            </div>
          ) : (
            <div className="space-y-2">
              {formRules.map((r) => {
                const getScopeLabel = (rule: ApprovalRouteRule) =>
                  rule.deptScope.kind === '전체' ? '전체부서'
                    : rule.deptScope.kind === '부서유형' ? `유형=${rule.deptScope.deptType}`
                      : `${rule.deptScope.kind}=${org.depts.find(d => d.id === rule.deptScope.deptId)?.name ?? rule.deptScope.deptId}`;

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3 hover:border-teal/30 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="grid h-6 min-w-6 place-items-center rounded bg-ink3/10 px-1 text-[11px] font-bold text-ink2">
                        {r.priority}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-[13px] text-ink truncate block">{r.name}</span>
                        <span className="text-[11px] text-ink3 mt-0.5 block">
                          적용부서: <span className="text-ink2">{getScopeLabel(r)}</span> · 결재 프로세스: <span className="text-teal font-medium">{r.steps.length}단계</span>
                        </span>
                      </div>
                      {!r.active && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">중지됨</span>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelRule(r);
                          setRuleMsg('');
                        }}
                        className="rounded-lg border border-border-hi bg-panel-alt px-3 py-1.5 text-[11.5px] font-semibold text-ink2 hover:bg-border/30 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => delRule(r.id)}
                        className="rounded-lg border border-border-hi bg-panel-alt px-3 py-1.5 text-[11.5px] font-semibold text-red-500 hover:bg-red-500/5 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 룰 편집 모달 다이얼로그 */}
      {selRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-[640px] max-h-[85vh] overflow-y-auto rounded-xl bg-panel border border-border p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setSelRule(null)}
              className="absolute right-4 top-4 text-ink3 hover:text-ink text-[18px] font-semibold"
            >
              ✕
            </button>
            <RuleEditor
              rule={selRule}
              onChange={setSelRule}
              onSave={saveRule}
              onCancel={() => setSelRule(null)}
              saving={upsertRule.isPending}
              msg={ruleMsg}
              forms={[form]} // 현재 편집 중인 서식 정보만 고정
              org={org}
            />
          </div>
        </div>
      )}

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          {onDelete && <button type="button" onClick={onDelete} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5">삭제</button>}
          {onDuplicate && <button type="button" onClick={onDuplicate} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-ink2 hover:bg-panel-alt">복제</button>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}

/** 미리보기 — 상신 폼 / 인쇄 문서 2탭. */
function FormPreview({ form, onChangeField }: { form: ApprovalForm; onChangeField?: (index: number, patch: Partial<FormField>) => void }) {
  const org = useOrgTree();
  const [tab, setTab] = useState<'폼' | '인쇄'>('폼');
  const [values, setValues] = useState<Record<string, FieldValue>>({});

  useEffect(() => {
    setValues({});
  }, [form.id, form.code]);
  
  const setVals = (patch: Record<string, FieldValue>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    
    // 표 위젯에서 열 추가/이름변경/너비조절 발생 시 서식 템플릿 필드 정의에 반영
    Object.entries(patch).forEach(([key, val]) => {
      const idx = form.fields.findIndex((f) => f.key === key);
      if (idx !== -1 && form.fields[idx].type === '표' && typeof val === 'string' && val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cols)) {
            onChangeField?.(idx, {
              options: parsed.cols,
              placeholder: JSON.stringify({
                cols: parsed.cols,
                colWidths: parsed.colWidths || {},
                tableWidth: parsed.tableWidth || '100%',
                defaultRows: parsed.rows || [],
                merges: parsed.merges || [],
                headerValues: parsed.headerValues || {},
                amountCells: parsed.amountCells || [],
                sumCell: parsed.sumCell || null,
                secretCols: parsed.secretCols || [],
                secretCells: parsed.secretCells || [],
                secretRows: parsed.secretRows || []
              })
            });
          }
        } catch (e) {}
      }
    });
  };

  const amountField = amountFieldOf(form);

  const sampleDoc = useMemo<ApprovalDoc>(() => {
    const u = org.users;
    const dummyDrafter = {
      id: 'dummy_hong',
      name: '홍길동',
      dept: '기획팀',
      position: '대리'
    };

    let leave = null;
    if (form.code === '휴가') {
      leave = {
        leaveType: (values['leaveType'] as string) || '',
        startDate: (values['period'] as string) || '',
        endDate: (values['period__end'] as string) || '',
        days: values['period__days'] ? Number(values['period__days']) : null,
      };
    }

    return {
      id: 'PREVIEW', docNo: 'AP-000000-000', docType: form.code || '서식', title: `${form.name || '서식'} 미리보기`,
      drafterId: dummyDrafter.id, drafterName: dummyDrafter.name, drafterDept: dummyDrafter.dept, drafterDeptId: 'D010', drafterPos: dummyDrafter.position, status: '진행중',
      steps: u.slice(0, 3).map((x, i) => ({ seq: i + 1, parallelGroup: null, executionType: 'sequential', kind: i === 2 ? '전결' : '결재', approverId: x.id, delegatedFromId: null, decision: i === 0 ? '승인' : '대기', decidedAt: null, comment: '' })),
      amount: amountField ? 3_000_000 : null, body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : '(본문 미리보기)',
      form: leave as any,
      fieldValues: values,
      attachments: [],
      recipients: [],
      relatedDocs: [],
      securityLevel: '일반',
      visibility: '부서',
      isPostApproval: false,
      executionsSnapshot: [],
      executionDepts: [],
      currentSeq: 1, createdAt: null, submittedAt: '2026-07-07T00:00:00.000Z', completedAt: null,
    };
  }, [form, org.users, values, amountField]);

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-teal">🔎 미리보기</span>
          {(['폼', '인쇄'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tab === t ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}>{t === '폼' ? '상신 폼' : '인쇄 문서'}</button>
          ))}
        </div>
        {tab === '인쇄' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-teal-soft text-teal border border-teal/20 px-2 py-0.5 text-[10px] font-bold hover:bg-teal hover:text-white transition-colors"
          >
            🖨️ 실제 인쇄 미리보기
          </button>
        )}
      </div>

      {tab === '폼' ? (
        <div className="rounded-lg bg-panel p-3">
          <div className="mb-2 text-[11px] font-bold text-ink2">제목 <span className="font-normal text-ink3">(예시)</span></div>
          <input disabled placeholder="문서 제목" className={`${inp} mb-3 opacity-70`} />
          <div className="grid grid-cols-2 gap-x-4">
            {(() => {
              const nodes: React.ReactNode[] = [];
              let lastSection = '';

              form.fields.forEach((f, i) => {
                if (f.visibleIf) {
                  const parts = f.visibleIf.split(':');
                  if (parts.length === 2) {
                    const [condKey, condVal] = parts;
                    if (String(values[condKey] ?? '') !== condVal) {
                      return;
                    }
                  }
                }

                if (f.section && f.section !== lastSection) {
                  lastSection = f.section;
                  nodes.push(
                    <div key={`sec-${f.section}`} className="col-span-2 mt-2 mb-1.5 text-[11px] font-bold text-teal border-b border-teal/15 pb-0.5">
                      {f.section}
                    </div>
                  );
                }
                const span = f.width === 'half' ? 'col-span-1' : 'col-span-2';
                nodes.push(
                  <div key={f.key || i} className={span}>
                    <div className="mb-1 text-[11px] font-bold text-ink2">{f.label || f.key}{f.required && ' *'}</div>
                    <DynamicField field={f} values={values} set={setVals} org={org} />
                  </div>
                );
              });

              return nodes;
            })()}
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-lg bg-panel-alt/50 p-4 flex justify-center">
          <div className="w-[800px] shrink-0 min-h-[297mm] bg-white p-8 shadow-lg border border-border/60 rounded-sm">
            <ApprovalDocumentView doc={sampleDoc} formOverride={form} isPreview={true} />
          </div>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal';
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[10.5px] font-semibold text-ink3">{label}</span>{children}</label>;
}

function OptionsInput({ value, onChange }: { value: string[]; onChange: (val: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  
  useEffect(() => {
    setText(value.join(', '));
  }, [value]);

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = text.split(',').map((s) => s.trim()).filter(Boolean);
        onChange(parsed);
      }}
      placeholder="옵션(콤마 구분): 영업, 교육, 회의"
      className="mt-1.5 w-full rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
    />
  );
}

function RuleEditor({ rule, onChange, onSave, onCancel, onDelete, saving, msg, forms, org }: {
  rule: ApprovalRouteRule; onChange: (r: ApprovalRouteRule) => void;
  onSave: () => void; onCancel: () => void; onDelete?: () => void; saving: boolean; msg: string;
  forms: ApprovalForm[];
  org: ReturnType<typeof useOrgTree>;
}) {
  const set = (patch: Partial<ApprovalRouteRule>) => onChange({ ...rule, ...patch });
  const setStep = (i: number, patch: Partial<RouteStep>) => set({ steps: rule.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStep = () => set({ steps: [...rule.steps, { resolver: 'DEPT_HEAD', arg: null, kind: '결재', dedupeSelf: true, optional: false }] });
  const delStep = (i: number) => set({ steps: rule.steps.filter((_, idx) => idx !== i) });
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= rule.steps.length) return;
    const next = [...rule.steps];[next[i], next[j]] = [next[j], next[i]]; set({ steps: next });
  };

  const selectedForm = useMemo(() => forms.find((f) => f.code === rule.docType), [forms, rule.docType]);
  const dropdownFields = useMemo(() => {
    return selectedForm?.fields.filter((f) => f.type === '선택') ?? [];
  }, [selectedForm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{rule.id ? `룰 편집 · ${rule.id}` : '새 룰'}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2"><input type="checkbox" checked={rule.active} onChange={(e) => set({ active: e.target.checked })} /> 사용</label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <F label="룰 이름"><input value={rule.name} onChange={(e) => set({ name: e.target.value })} className={inp} /></F>
        <F label="우선순위(작을수록 먼저)"><input type="number" value={rule.priority} onChange={(e) => set({ priority: Number(e.target.value) })} className={inp} /></F>
      </div>

      <div className="rounded-lg border border-border bg-panel-alt p-2.5">
        <div className="mb-2 text-[11px] font-bold text-ink2">적용 조건</div>
        <div className="grid grid-cols-2 gap-2">
          <F label="문서유형">
            <select disabled value={rule.docType} onChange={(e) => set({ docType: e.target.value, conditionKey: null, conditionValues: [] })} className={`${inp} opacity-60`}>
              {forms.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
            </select>
          </F>
          {dropdownFields.length > 0 && (
            <F label="세부 구분 키 (드롭다운 필드)">
              <select
                value={rule.conditionKey ?? ''}
                onChange={(e) => set({ conditionKey: e.target.value || null, conditionValues: [] })}
                className={inp}
              >
                <option value="">(없음)</option>
                {dropdownFields.map((df) => (
                  <option key={df.key} value={df.key}>{df.label}</option>
                ))}
              </select>
            </F>
          )}
          {rule.conditionKey && (
            <div className="col-span-2">
              <F label="세부 구분 값 (다중 선택)">
                <div className="flex flex-wrap gap-1 mt-1 rounded border border-border bg-panel p-2">
                  {(dropdownFields.find((df) => df.key === rule.conditionKey)?.options ?? []).map((opt) => {
                    const checked = rule.conditionValues.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-1 text-[11px] font-medium text-ink2 mr-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextValues = e.target.checked
                              ? [...rule.conditionValues, opt]
                              : rule.conditionValues.filter((v) => v !== opt);
                            set({ conditionValues: nextValues });
                          }}
                          className="rounded border-border"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </F>
            </div>
          )}
          <F label="부서 범위">
            <select value={rule.deptScope.kind} onChange={(e) => set({ deptScope: { ...rule.deptScope, kind: e.target.value as never } })} className={inp}>
              {['전체', '부서', '서브트리', '부서유형'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </F>
          {rule.deptScope.kind === '부서유형' && (
            <F label="부서 유형">
              <select value={rule.deptScope.deptType ?? '본사'} onChange={(e) => set({ deptScope: { ...rule.deptScope, deptType: e.target.value as never } })} className={inp}>
                {DEPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </F>
          )}
          {(rule.deptScope.kind === '부서' || rule.deptScope.kind === '서브트리') && (
            <F label="부서">
              <select
                value={rule.deptScope.deptId ?? ''}
                onChange={(e) => set({ deptScope: { ...rule.deptScope, deptId: e.target.value || null } })}
                className={inp}
              >
                <option value="">(부서 선택)</option>
                {org.depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </F>
          )}
          <F label="기안자 직급 이상">
            <select
              value={rule.positionToRank ?? ''}
              onChange={(e) => set({ positionToRank: e.target.value === '' ? null : Number(e.target.value) })}
              className={inp}
            >
              <option value="">(제한 없음)</option>
              {org.positions.slice().sort((a, b) => a.rank - b.rank).map((p) => (
                <option key={p.id} value={p.rank}>
                  {p.name}
                </option>
              ))}
            </select>
          </F>
          <F label="기안자 직급 이하">
            <select
              value={rule.positionFromRank ?? ''}
              onChange={(e) => set({ positionFromRank: e.target.value === '' ? null : Number(e.target.value) })}
              className={inp}
            >
              <option value="">(제한 없음)</option>
              {org.positions.slice().sort((a, b) => a.rank - b.rank).map((p) => (
                <option key={p.id} value={p.rank}>
                  {p.name}
                </option>
              ))}
            </select>
          </F>
          <F label="금액 이상"><input type="number" value={rule.amountFrom ?? ''} onChange={(e) => set({ amountFrom: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
          <F label="금액 미만"><input type="number" value={rule.amountTo ?? ''} onChange={(e) => set({ amountTo: e.target.value === '' ? null : Number(e.target.value) })} placeholder="무한" className={inp} /></F>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-bold text-ink2">결재 단계(관계형)</div>
        <div className="space-y-1.5">
          {rule.steps.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-2 py-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">{i + 1}</span>
              <select value={s.resolver} onChange={(e) => setStep(i, { resolver: e.target.value as Resolver, arg: null })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none">
                {RESOLVERS.map((r) => <option key={r} value={r}>{RESOLVER_LABEL[r]}</option>)}
              </select>
              {s.resolver === 'SPECIFIC_USER' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-48 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(사용자 선택)</option>
                  {org.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.dept}, {u.position})
                    </option>
                  ))}
                </select>
              ) : s.resolver === 'SPECIFIC_DEPT_HEAD' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-40 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(부서 선택)</option>
                  {org.depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : s.resolver === 'POSITION_AT_LEAST' ? (
                <select
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value || null })}
                  className="w-32 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                >
                  <option value="">(직급 선택)</option>
                  {org.positions.slice().sort((a, b) => a.rank - b.rank).map((p) => (
                    <option key={p.id} value={String(p.rank)}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : ARG_HINT[s.resolver] ? (
                <input
                  value={s.arg ?? ''}
                  onChange={(e) => setStep(i, { arg: e.target.value })}
                  placeholder={ARG_HINT[s.resolver]}
                  className="w-20 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none"
                />
              ) : null}
              <select value={s.kind} onChange={(e) => setStep(i, { kind: e.target.value as RouteStep['kind'] })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-semibold text-ink outline-none">
                {ROUTE_STEP_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={s.dedupeSelf} onChange={(e) => setStep(i, { dedupeSelf: e.target.checked })} className="h-3 w-3" />셀프제외</label>
              <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={s.optional} onChange={(e) => setStep(i, { optional: e.target.checked })} className="h-3 w-3" />선택</label>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => moveStep(i, -1)} className="text-[9px] text-ink3 hover:text-ink">▲</button>
                <button type="button" onClick={() => moveStep(i, 1)} className="text-[9px] text-ink3 hover:text-ink">▼</button>
                <button type="button" onClick={() => delStep(i)} className="text-[12px] text-ink3 hover:text-red-500">✕</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal">+ 단계 추가</button>
      </div>

      <RoutePreview rule={rule} />

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        {onDelete ? <button type="button" onClick={onDelete} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5">룰 삭제</button> : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}

function RoutePreview({ rule }: { rule: ApprovalRouteRule }) {
  const org = useOrgTree();
  const [drafterId, setDrafterId] = useState('');
  const [amount, setAmount] = useState('500000');
  const did = drafterId || org.users[0]?.id || '';

  const result = useMemo(() => {
    const drafter = org.users.find((u) => u.id === did);
    if (!drafter) return null;
    const dt: string = rule.docType === '전체' ? '기안' : rule.docType;
    
    const docData: Record<string, any> = {};
    if (rule.conditionKey && rule.conditionValues && rule.conditionValues.length > 0) {
      docData[rule.conditionKey] = rule.conditionValues[0];
    }

    return resolveRoute({
      drafter,
      docType: dt,
      amount: amount === '' ? null : Number(amount),
      users: org.users,
      depts: org.depts,
      positions: org.positions,
      rules: [rule],
      docData,
    });
  }, [rule, did, amount, org.users, org.depts, org.positions]);

  const nameOf = (id: string) => org.userById(id)?.name ?? id;

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/30 p-2.5">
      <div className="mb-2 text-[11px] font-bold text-teal">🧪 시뮬레이터 — 이 룰이 만드는 결재선</div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={did} onChange={(e) => setDrafterId(e.target.value)} className="rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none">
          {org.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept} · {u.position}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="금액" className="w-24 rounded border border-border-hi bg-panel px-2 py-1 text-[11.5px] text-ink outline-none" />
      </div>
      <div className="mt-2 text-[12px]">
        {result && result.steps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink3">{nameOf(did)}(기안)</span>
            {result.steps.map((s) => (
              <span key={s.seq} className="flex items-center gap-1.5">
                <span className="text-ink3">→</span>
                <span className="rounded-md bg-panel px-2 py-0.5 font-semibold text-ink">{nameOf(s.approverId)} <span className="text-[10px] text-teal">{s.kind}</span></span>
              </span>
            ))}
            <span className="ml-1 text-[10px] text-ink3">({result.rule ? `룰 적용` : '폴백'})</span>
          </div>
        ) : (
          <span className="text-ink3">결재선이 생성되지 않았습니다(조건 미매칭 또는 해석 불가 → 상신 시 다른 룰/폴백 적용).</span>
        )}
      </div>
    </div>
  );
}


