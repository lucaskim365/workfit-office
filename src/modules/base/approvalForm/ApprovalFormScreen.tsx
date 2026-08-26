import React, { useState, useEffect, useRef } from 'react';
import {
  useApprovalForms,
  useUpsertApprovalForm,
  useRemoveApprovalForm,
  useApprovalFolders,
  useUpsertApprovalFolder,
  useRemoveApprovalFolder,
} from '@/features/gw/useApprovalForms';
import { useOrgTree } from '@/features/gw/useOrgTree';
import type { ApprovalForm, ApprovalFolder } from '@/domain/approvalForm/schema';
import { blankForm } from './utils';
import { ApprovalFormEditor } from './components/ApprovalFormEditor';

export default function ApprovalFormScreen() {
  const { data: forms = [] } = useApprovalForms();
  const { data: folders = [] } = useApprovalFolders();
  const upsert = useUpsertApprovalForm();
  const remove = useRemoveApprovalForm();

  const upsertFolder = useUpsertApprovalFolder();
  const removeFolder = useRemoveApprovalFolder();

  const org = useOrgTree();

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
        <button
          onClick={() => {
            setSel(blankForm(selFolderId && selFolderId !== 'root' ? selFolderId : null));
            setMsg('');
          }}
          className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 cursor-pointer"
        >
          + 서식 추가
        </button>
      </div>

      <div className="grid grid-cols-[280px_1fr] items-start gap-3.5">
        {/* 폴더 & 서식 통합 트리뷰 패널 */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-panel">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-[11.5px] font-bold text-ink2">
            <span>폴더 & 서식 목록</span>
            <button
              type="button"
              onClick={addFolder}
              className="text-[10px] text-teal hover:underline font-bold cursor-pointer"
            >
              + 폴더 추가
            </button>
          </div>
          <div className="p-2 space-y-1 overflow-y-auto max-h-[75vh]">
            
            {/* 1. 루트(미지정) 폴더 */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleFolder('root')}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[12px] font-bold text-ink2 hover:bg-panel-alt transition-colors cursor-pointer"
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
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer ${
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
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer ${
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
            <ApprovalFormEditor
              form={sel}
              folders={folders}
              org={org}
              onChange={setSel}
              onSave={save}
              onCancel={() => setSel(null)}
              onDelete={!sel.id ? undefined : () => del(sel)}
              onDuplicate={sel.id ? () => duplicate(sel) : undefined}
              saving={upsert.isPending}
              msg={msg}
            />
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
            className="block w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-panel-alt transition-colors cursor-pointer"
          >
            ✏️ 이름 변경
          </button>
          <button
            onClick={() => delFolder(folderMenu.folder)}
            className="block w-full px-3 py-2 text-left text-[12px] text-danger hover:bg-panel-alt transition-colors cursor-pointer"
          >
            🗑️ 폴더 삭제
          </button>
        </div>
      )}
    </div>
  );
}
