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

/**
 * 결재서식 관리 (기준정보) — 문서 서식 CRUD + 필드 빌더 + 미리보기(상신폼/인쇄) + 폴더 기능.
 */

const blankField = (): FormField => ({
  key: '', label: '', type: '텍스트', required: false, options: [], placeholder: '', width: 'full', section: '', isAmountKey: false, visibleIf: null, isTabSelector: false,
});

const blankForm = (folderId: string | null = null): ApprovalForm => ({
  id: '', code: '', name: '', icon: '📄', docTitle: '', closing: '', active: true, order: 99, system: false, folderId,
  fields: [{ ...blankField(), key: 'body', label: '본문', type: '장문', required: true }],
});

export default function ApprovalFormScreen() {
  const { data: forms = [], isLoading } = useApprovalForms();
  const { data: folders = [] } = useApprovalFolders();
  const upsert = useUpsertApprovalForm();
  const remove = useRemoveApprovalForm();

  const upsertFolder = useUpsertApprovalFolder();
  const removeFolder = useRemoveApprovalFolder();

  const [sel, setSel] = useState<ApprovalForm | null>(null);
  const [msg, setMsg] = useState('');

  // 현재 선택된 폴더 필터 (null 이면 전체, 'root' 이면 루트 미지정 서식들)
  const [selFolderId, setSelFolderId] = useState<string | null>(null);

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

  // 폴더별 필터링된 서식 리스트
  const filteredForms = useMemo(() => {
    if (selFolderId === null) return forms;
    if (selFolderId === 'root') return forms.filter((f) => !f.folderId);
    return forms.filter((f) => f.folderId === selFolderId);
  }, [forms, selFolderId]);

  return (
    <div className="flex flex-col gap-3.5 relative">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">결재서식 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 결재서식 관리 · 전자결재 문서 양식(유형·필드·격식) 디자인</p>
        </div>
        <button onClick={() => { setSel(blankForm(selFolderId && selFolderId !== 'root' ? selFolderId : null)); setMsg(''); }} className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90">+ 서식 추가</button>
      </div>

      <div className="grid grid-cols-[200px_280px_1fr] items-start gap-3.5">
        {/* 폴더 목록 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-panel">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11.5px] font-bold text-ink2">
            <span>폴더 분류</span>
            <button onClick={addFolder} className="text-[10px] text-teal hover:underline">+ 폴더</button>
          </div>
          <div className="p-1.5 space-y-0.5">
            <button
              onClick={() => setSelFolderId(null)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] ${selFolderId === null ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
            >
              <span>📁 전체 서식</span>
              <span className="text-[10.5px] opacity-60">{forms.length}</span>
            </button>
            <button
              onClick={() => setSelFolderId('root')}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] ${selFolderId === 'root' ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
            >
              <span>📁 루트(미지정)</span>
              <span className="text-[10.5px] opacity-60">{forms.filter(f => !f.folderId).length}</span>
            </button>
            <div className="my-1 border-t border-border-hi" />
            {localFolders.map((f, idx) => (
              <button
                key={f.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelFolderId(f.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setFolderMenu({ x: e.clientX, y: e.clientY, folder: f });
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] cursor-grab active:cursor-grabbing transition-all ${
                  selFolderId === f.id ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'
                } ${draggedIdx === idx ? 'opacity-30 border border-dashed border-teal scale-95' : ''}`}
              >
                <span className="truncate">📁 {f.name}</span>
                <span className="text-[10.5px] opacity-60">
                  {forms.filter((form) => form.folderId === f.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 서식 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-3.5 py-2.5 text-[11.5px] font-bold text-ink2">서식 목록 <span className="text-ink3">· {filteredForms.length}</span></div>
          {isLoading && <div className="py-8 text-center text-[12px] text-ink3">불러오는 중…</div>}
          {!isLoading && filteredForms.length === 0 && <div className="py-12 text-center text-[12.5px] text-ink3">서식이 없습니다.</div>}
          {filteredForms.map((f) => (
            <button key={f.id} onClick={() => { setSel(f); setMsg(''); }} className={`flex w-full items-center gap-2 border-b border-border px-3.5 py-2.5 text-left ${sel?.id === f.id ? 'bg-teal-soft/60' : 'hover:bg-panel-alt'}`}>
              <span className="text-[16px]">{f.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-semibold text-ink">{f.name}</span>
                  {f.system && <span className="rounded bg-ink3/15 px-1 text-[9px] font-bold text-ink3">기본</span>}
                  {!f.active && <span className="text-[9.5px] text-ink3">중지</span>}
                </span>
                <span className="block text-[10.5px] text-ink3">{f.code} · {f.fields.length}필드</span>
              </span>
            </button>
          ))}
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
  const [selTab, setSelTab] = useState('공통');
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
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-bold text-ink">{form.id ? `서식 편집 · ${form.code}` : '새 서식'}</div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> 사용</label>
      </div>

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

      {/* 필드 빌더 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-bold text-ink2">입력 필드</div>
        </div>

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
                    : 'bg-panel-alt text-ink2 hover:bg-border/40'
                }`}
              >
                {tab === '공통' ? '🏢 공통 양식' : `📌 ${tab}`}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {form.fields
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => {
              if (selTab === '공통') return !f.visibleIf;
              // 선택지 탭: 공통 필드 + 해당 탭 전용 필드 모두 표시
              return !f.visibleIf || f.visibleIf === `${tabSelectorField?.key}:${selTab}`;
            })
            .map(({ f, i }) => {
              const isCommonInTab = selTab !== '공통' && !f.visibleIf;
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-2 py-1.5 ${
                    isCommonInTab
                      ? 'border-border/50 bg-panel/60 opacity-80'
                      : 'border-border bg-panel-alt'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">{i + 1}</span>
                    {isCommonInTab && (
                      <span className="rounded bg-border px-1 py-0.5 text-[9px] font-bold text-ink3">공통</span>
                    )}
                    <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="라벨" className="w-28 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none" />
                    <input value={f.key} onChange={(e) => setField(i, { key: e.target.value })} placeholder="key" className="w-20 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-mono text-ink outline-none" />
                    <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none">
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={f.width} onChange={(e) => setField(i, { width: e.target.value as 'half' | 'full' })} className="rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none">
                      <option value="full">전체</option><option value="half">2열</option>
                    </select>
                    <input value={f.section} onChange={(e) => setField(i, { section: e.target.value })} placeholder="섹션" className="w-16 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] text-ink outline-none" />
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
                    {f.type === '금액' && <label className="flex items-center gap-0.5 text-[10px] text-ink3"><input type="checkbox" checked={f.isAmountKey} onChange={(e) => setField(i, { isAmountKey: e.target.checked })} className="h-3 w-3" />금액키</label>}
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
                      <button onClick={() => moveField(i, -1)} className="text-[9px] text-ink3 hover:text-ink">▲</button>
                      <button onClick={() => moveField(i, 1)} className="text-[9px] text-ink3 hover:text-ink">▼</button>
                      <button onClick={() => delField(i)} className="text-[12px] text-ink3 hover:text-red-500">✕</button>
                    </div>
                  </div>
                  {(f.type === '선택' || f.type === '다중선택') && (
                    <OptionsInput value={f.options} onChange={(parsed) => setField(i, { options: parsed })} />
                  )}
                </div>
              );
            })}
        </div>
        <button onClick={addField} className="mt-1.5 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal">+ 필드 추가</button>
        <p className="mt-1 text-[10.5px] text-ink3">예약 key <b>body</b>(장문)=문서 본문 · 금액 필드에 <b>금액키</b> 지정 시 결재선 금액매칭에 사용.</p>
      </div>

      <FormPreview form={form} />

      {msg && <p className="text-[11.5px] font-semibold text-teal">{msg}</p>}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          {onDelete && <button onClick={onDelete} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-500/5">삭제</button>}
          {onDuplicate && <button onClick={onDuplicate} className="rounded-lg px-3 py-2 text-[12px] font-semibold text-ink2 hover:bg-panel-alt">복제</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">저장</button>
        </div>
      </div>
    </div>
  );
}

/** 미리보기 — 상신 폼 / 인쇄 문서 2탭. */
function FormPreview({ form }: { form: ApprovalForm }) {
  const org = useOrgTree();
  const [tab, setTab] = useState<'폼' | '인쇄'>('폼');
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const setVals = (patch: Record<string, FieldValue>) => setValues((prev) => ({ ...prev, ...patch }));
  const amountField = amountFieldOf(form);

  const sampleDoc = useMemo<ApprovalDoc>(() => {
    const u = org.users;
    const drafter = u[u.length - 1] ?? u[0];

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
      drafterId: drafter?.id ?? '', drafterDept: drafter?.dept ?? '', status: '진행중',
      steps: u.slice(0, 3).map((x, i) => ({ seq: i + 1, parallelGroup: null, kind: i === 2 ? '전결' : '결재', approverId: x.id, delegatedFromId: null, decision: i === 0 ? '승인' : '대기', decidedAt: null, comment: '' })),
      amount: amountField ? 3_000_000 : null, body: values[RESERVED_BODY_KEY] ? String(values[RESERVED_BODY_KEY]) : '(본문 미리보기)',
      form: leave as any,
      fieldValues: values,
      attachments: [],
      currentSeq: 1, createdAt: null, submittedAt: '2026-07-07T00:00:00.000Z', completedAt: null,
    };
  }, [form, org.users, values, amountField]);

  return (
    <div className="rounded-lg border border-teal/40 bg-teal-soft/20 p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold text-teal">🔎 미리보기</span>
        {(['폼', '인쇄'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 text-[11px] font-semibold ${tab === t ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}>{t === '폼' ? '상신 폼' : '인쇄 문서'}</button>
        ))}
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

              const hasBodyField = form.fields.some((f) => f.key === 'body');
              if (!hasBodyField) {
                nodes.push(
                  <div key="default-body-preview" className="col-span-2 mt-3">
                    <div className="mb-1 text-[11px] font-bold text-ink2">본문</div>
                    <textarea disabled placeholder="내용을 입력하세요" rows={4} className={`${inp} resize-none leading-relaxed opacity-70`} />
                  </div>
                );
              }

              return nodes;
            })()}
          </div>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto rounded-lg bg-white p-2">
          <ApprovalDocumentView doc={sampleDoc} formOverride={form} />
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
