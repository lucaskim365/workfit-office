import { Fragment, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRouteEngine } from '@/features/gw/useRouteEngine';

import { STEP_KINDS, type ApprovalStep, type StepKind } from '@/domain/approvalDoc/schema';
import type { User } from '@/domain/user/schema';
import { KIND_TONE } from '@/modules/gw/_gw';

/**
 * 결재선 빌더(§7.3) — 3방식 병행: ① 자동 상신선(상급자 체인) ② 전결규정 적용
 * ③ 수동(피커로 추가·구분 지정·순서·병렬 묶기). 어느 방식이든 동일 steps[]로 수렴.
 * 완전 제어형: 내부 상태 없이 props(steps)에서 편집표현을 도출해 병렬 태그 드리프트를 방지.
 */

/** 편집표현 — 병렬그룹/단독 노드 편집 표현 */
interface EditStep {
  approverId: string;
  kind: StepKind;
  linkedPrev: boolean;
  groupId?: string | null; // 독립 병렬 그룹 ID (예: 'G1', 'G2')
}

function toEdit(steps: ApprovalStep[]): EditStep[] {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  return sorted.map((s, i) => ({
    approverId: s.approverId,
    kind: s.kind,
    linkedPrev: i > 0 && !!s.parallelGroup && s.parallelGroup === sorted[i - 1].parallelGroup,
    groupId: s.parallelGroup ?? null,
  }));
}

/** 편집표현 → steps[]: seq=순번, 명시적 groupId가 있거나 linkedPrev일 때만 병렬그룹 부여 */
function toSteps(edits: EditStep[]): ApprovalStep[] {
  return edits.map((e, i) => {
    let runStart = i;
    while (runStart > 0 && edits[runStart].linkedPrev) runStart--;

    // 명시적으로 groupId가 지정되어 있거나, 앞/뒤와 linkedPrev로 묶인 경우에만 병렬 그룹 처리
    const isLinkedParallel = edits[i].linkedPrev || (i + 1 < edits.length && edits[i + 1].linkedPrev);
    const finalGroupId = e.groupId ? e.groupId : isLinkedParallel ? `G${runStart + 1}` : null;
    
    return {
      seq: i + 1,
      parallelGroup: finalGroupId,
      executionType: finalGroupId ? ('parallel' as const) : ('sequential' as const),
      kind: e.kind,
      approverId: e.approverId,
      delegatedFromId: null,
      decision: '대기' as const,
      decidedAt: null,
      comment: '',
    };
  });
}

export function ApprovalLineBuilder({
  steps,
  onChange,
  drafterId,
  docType,
  amount,
  docData,
  bottomSlot,
  isAgreementEnabled = false,
}: {
  steps: ApprovalStep[];
  onChange: (steps: ApprovalStep[]) => void;
  drafterId: string;
  docType: string;
  amount: number | null;
  docData?: Record<string, any> | null;
  bottomSlot?: React.ReactNode;
  isAgreementEnabled?: boolean;
}) {
  const { data: users = [] } = useUsers();
  const org = useOrgTree();
  const route = useRouteEngine();

  // 빈 병렬 그룹 ID 목록 (사용자가 생성한 빈 병렬 그룹 박스 유지용)
  const [emptyGroupIds, setEmptyGroupIds] = useState<string[]>([]);

  // 피커 상태
  const [picker, setPicker] = useState<
    | { mode: 'add' }
    | { mode: 'replace'; index: number }
    | { mode: 'add-to-group'; groupIndex: number; targetGroupId?: string }
    | null
  >(null);

  const edits = useMemo(() => toEdit(steps), [steps]);

  const allowedKinds = useMemo(() => {
    return STEP_KINDS.filter((k) => k !== '합의' || isAgreementEnabled);
  }, [isAgreementEnabled]);

  const allowedParallelKinds = useMemo(() => {
    return STEP_KINDS.filter((k) => k !== '전결' && (k !== '합의' || isAgreementEnabled));
  }, [isAgreementEnabled]);

  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const deptPosOf = (id: string) => {
    const u = org.userById(id);
    return u ? `${u.dept} · ${u.position}` : '';
  };

  const emit = (next: EditStep[]) => onChange(toSteps(next));

  const setKind = (i: number, kind: StepKind) => emit(edits.map((e, idx) => (idx === i ? { ...e, kind } : e)));
  
  /** 특정 결재자 삭제 처리 (그룹 구조 붕괴 방지) */
  const remove = (i: number) => {
    const target = edits[i];
    const next = edits.filter((_, idx) => idx !== i);
    
    // 만약 삭제 대상이 그룹의 첫 멤버(linkedPrev: false이고 groupId가 있음)였고, 뒤에 연달아 같은 groupId를 가진 멤버가 있다면
    if (!target.linkedPrev && target.groupId && next.length > i && next[i].groupId === target.groupId) {
      // 뒤 멤버가 그룹의 리더 역할을 이어받음
      next[i] = { ...next[i], linkedPrev: false };
    }
    
    if (next.length > 0) {
      next[0] = { ...next[0], linkedPrev: false };
    }
    emit(next);
  };
  
  /** 단독 노드 단위 이동 */
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= edits.length) return;
    const next = [...edits];
    [next[i], next[j]] = [next[j], next[i]];
    next[0] = { ...next[0], linkedPrev: false };
    emit(next);
  };

  /** 병렬 그룹 전체 위치 이동 (위/아래, 빈 그룹 포함) */
  const moveGroup = (renderGroupsList: any[], groupIdx: number, dir: -1 | 1) => {
    const targetGroupIdx = groupIdx + dir;
    if (targetGroupIdx < 0 || targetGroupIdx >= renderGroupsList.length) return;

    const newRenderGroups = [...renderGroupsList];
    [newRenderGroups[groupIdx], newRenderGroups[targetGroupIdx]] = [newRenderGroups[targetGroupIdx], newRenderGroups[groupIdx]];

    // 1) emptyGroupIds 배열의 순서도 새로운 renderGroups 순서대로 재정렬
    const newEmptyGroupIds: string[] = [];
    const nextEdits: EditStep[] = [];

    newRenderGroups.forEach((g) => {
      if (g.items.length === 0) {
        newEmptyGroupIds.push(g.id);
      } else {
        g.items.forEach((item: any, idx: number) => {
          nextEdits.push({
            ...item.edit,
            linkedPrev: idx > 0,
            groupId: g.isParallel ? (g.id.startsWith('empty-') ? `G${Date.now()}` : g.id) : null,
          });
        });
      }
    });

    if (nextEdits.length > 0) {
      nextEdits[0].linkedPrev = false;
    }
    setEmptyGroupIds(newEmptyGroupIds);
    emit(nextEdits);
  };

  /** 결재 피커에서 인원 단일 또는 다중 선택 시 처리 */
  const pick = (userIds: string | string[]) => {
    if (!picker) return;
    const selectedIds = Array.isArray(userIds) ? userIds : [userIds];
    if (selectedIds.length === 0) return;

    if (picker.mode === 'add') {
      // 일반 결재자(순차) 추가
      const newItems = selectedIds.map((id) => ({ approverId: id, kind: '결재' as StepKind, linkedPrev: false, groupId: null }));
      emit([...edits, ...newItems]);
    } else if (picker.mode === 'replace') {
      // 특정 노드 교체
      emit(edits.map((e, idx) => (idx === picker.index ? { ...e, approverId: selectedIds[0] } : e)));
    } else if (picker.mode === 'add-to-group') {
      const targetIdx = picker.groupIndex;
      if (targetIdx === -1 && picker.targetGroupId) {
        // 빈 병렬 그룹에 멤버 추가
        const generatedPgId = `G_${Date.now()}`;
        const newItems = selectedIds.map((id, idx) => ({
          approverId: id,
          kind: '결재' as StepKind,
          linkedPrev: idx > 0,
          groupId: generatedPgId, // 독립 병렬그룹 ID 부여 (1명이어도 보존)
        }));
        emit([...edits, ...newItems]);
        setEmptyGroupIds((prev) => prev.filter((id) => id !== picker.targetGroupId));
      } else {
        // 기존 병렬 그룹에 멤버 추가
        let lastGroupIdx = targetIdx;
        const targetGroupId = edits[targetIdx]?.groupId || `G_${Date.now()}`;
        while (lastGroupIdx + 1 < edits.length && edits[lastGroupIdx + 1].linkedPrev) {
          lastGroupIdx++;
        }
        const newItems = selectedIds.map((id) => ({
          approverId: id,
          kind: '결재' as StepKind,
          linkedPrev: true,
          groupId: targetGroupId,
        }));
        const next = [...edits];
        next.splice(lastGroupIdx + 1, 0, ...newItems);
        emit(next);
      }
    }
    setPicker(null);
  };

  /** 빈 병렬 그룹 생성 */
  const createEmptyParallelGroup = () => {
    const newGroupId = `empty-pg-${Date.now()}`;
    setEmptyGroupIds((prev) => [...prev, newGroupId]);
  };

  /** 빈 병렬 그룹 삭제 */
  const removeEmptyGroup = (groupId: string) => {
    setEmptyGroupIds((prev) => prev.filter((id) => id !== groupId));
  };

  const fillAuto = () => {
    const built = route.build({ drafterId, docType, amount, docData });
    onChange(built.length ? built : steps);
  };

  const dupWarn = useMemo(() => {
    const ids = edits.map((e) => e.approverId);
    return ids.includes(drafterId) || new Set(ids).size !== ids.length;
  }, [edits, drafterId]);

  // edits를 그룹 단위로 묶어서 UI 렌더링용 구조 생성 (독립 groupId 및 linkedPrev 기재 방식)
  const renderGroups = useMemo(() => {
    const groups: { id: string; isParallel: boolean; items: { edit: EditStep; originalIndex: number }[] }[] = [];
    edits.forEach((edit, index) => {
      // 명시적인 groupId가 존재하는 병렬 노드이거나 이전과 연결된 경우
      if (edit.groupId) {
        const existingGroup = groups.find((g) => g.id === edit.groupId);
        if (existingGroup) {
          existingGroup.items.push({ edit, originalIndex: index });
        } else {
          groups.push({
            id: edit.groupId,
            isParallel: true,
            items: [{ edit, originalIndex: index }],
          });
        }
      } else if (edit.linkedPrev && groups.length > 0) {
        const currentGroup = groups[groups.length - 1];
        currentGroup.isParallel = true;
        currentGroup.items.push({ edit, originalIndex: index });
      } else {
        groups.push({
          id: `seq-${index}`,
          isParallel: false,
          items: [{ edit, originalIndex: index }],
        });
      }
    });

    // 빈 병렬 그룹 추가
    emptyGroupIds.forEach((egId) => {
      groups.push({
        id: egId,
        isParallel: true,
        items: [],
      });
    });

    return groups;
  }, [edits, emptyGroupIds]);

  return (
    <div>
      {/* 상단 3방식 툴바 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={fillAuto}
          disabled={route.isLoading}
          title="기안자 부서·직급·금액에 맞는 결재선을 룰 엔진으로 자동 생성"
          className="rounded-lg border border-teal/30 bg-teal-soft/40 px-2.5 py-1 text-[11px] font-semibold text-teal hover:bg-teal-soft transition-colors disabled:opacity-50"
        >
          ⚡ 자동 결재선(룰)
        </button>
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setEmptyGroupIds([]);
          }}
          className="rounded-lg border border-border-hi bg-panel-alt px-2.5 py-1 text-[11px] font-semibold text-ink3 hover:text-red-500 hover:border-red-300 transition-colors"
        >
          비우기
        </button>
        <span className="ml-auto text-[10.5px] text-ink3">{edits.length}명 ({renderGroups.length}단계)</span>
      </div>

      {/* 결재선 노드 리스트 (그룹 단위 렌더링) — Timeline Stepper 구조 */}
      <div>
        {renderGroups.map((group, groupIdx) => {
          const firstItemIdx = group.items.length > 0 ? group.items[0].originalIndex : -1;
          const isLast = groupIdx === renderGroups.length - 1;

                    // 병렬 그룹 박스 UI (2명 이상이거나, 처음부터 병렬그룹으로 지정된 경우)
          if (group.isParallel) {
            const memberCount = group.items.length;
            return (
              <Fragment key={group.id}>
                <div className="rounded-lg border border-sky-200 bg-sky-50/20 p-2.5 hover:border-sky-300 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 select-none">
                      {groupIdx + 1}
                    </span>

                    {/* 병렬 결재자 목록 (세로 디렉토리 구조) */}
                    <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                      {memberCount === 0 ? (
                        <div className="flex flex-1 items-center justify-center py-2 text-center text-[11px] font-semibold text-ink3">
                          빈 병렬 그룹입니다. 아래의 결재자 추가 버튼을 누르세요.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 w-full">
                          {group.items.map(({ edit, originalIndex }) => (
                            <div
                              key={originalIndex}
                              className="group relative flex items-center gap-2 rounded-md border border-border-hi bg-panel px-3 py-1.5 hover:border-teal transition-all min-w-0"
                            >
                              <span className="text-teal/50 font-bold select-none shrink-0 text-[11px]">—</span>
                              <button
                                type="button"
                                onClick={() => setPicker({ mode: 'replace', index: originalIndex })}
                                className="flex-1 text-left min-w-0"
                              >
                                <span className="text-[12px] font-semibold text-ink hover:text-teal transition-colors">
                                  {nameOf(edit.approverId)}
                                </span>
                                <span className="ml-1.5 text-[10px] text-ink3">
                                  {deptPosOf(edit.approverId)}
                                </span>
                              </button>
                              <select
                                value={edit.kind === '전결' ? '결재' : edit.kind}
                                onChange={(ev) => setKind(originalIndex, ev.target.value as StepKind)}
                                className={'shrink-0 rounded border border-border-hi bg-panel px-1.5 py-0.5 text-[10px] font-semibold outline-none ' + KIND_TONE[edit.kind === '전결' ? '결재' : edit.kind]}
                              >
                                {allowedParallelKinds.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  remove(originalIndex);
                                }}
                                title="결재자 삭제"
                                className="text-ink3 hover:text-rose-500 text-[13px] p-0.5 transition-colors shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 병렬 그룹 내 + 추가 버튼 */}
                      <button
                        type="button"
                        onClick={() => setPicker({ mode: 'add-to-group', groupIndex: firstItemIdx, targetGroupId: group.id })}
                        title="병렬 그룹에 결재자 추가"
                        className="flex items-center justify-center gap-1.5 rounded border border-dashed border-teal/40 bg-panel py-1.5 text-[11px] font-bold text-teal hover:bg-teal-soft/40 hover:border-teal/60 transition-all w-full"
                      >
                        <span className="text-[12px] font-extrabold">+</span>
                        <span>병렬 결재자 추가</span>
                      </button>
                    </div>

                    {/* 병렬 그룹 위치 변경 버튼 (▲/▼) */}
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => moveGroup(renderGroups, groupIdx, -1)}
                        title="병렬 그룹 위로 이동"
                        className="text-[9px] leading-none text-ink3 hover:text-ink"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGroup(renderGroups, groupIdx, 1)}
                        title="병렬 그룹 아래로 이동"
                        className="text-[9px] leading-none text-ink3 hover:text-ink"
                      >
                        ▼
                      </button>
                    </div>

                    {/* 병렬 그룹 전체 삭제 (x) 버튼 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (group.items.length === 0) {
                          removeEmptyGroup(group.id);
                        } else {
                          // 그룹 내 모든 멤버 일괄 삭제
                          const indicesToRemove = group.items.map((it) => it.originalIndex);
                          const nextEdits = edits.filter((_, idx) => !indicesToRemove.includes(idx));
                          if (nextEdits.length > 0) nextEdits[0].linkedPrev = false;
                          emit(nextEdits);
                        }
                      }}
                      title="병렬 그룹 삭제"
                      className="shrink-0 text-[13px] text-ink3 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {/* Timeline 커넥터 - 노드 사이 세로 실선 */}
                {!isLast && (
                  <div className="flex" style={{ paddingLeft: '11px' }}>
                    <div className="w-0.5 h-2.5 bg-border-hi" />
                  </div>
                )}
              </Fragment>
            );
          }

          // 순차 결재자 단독 바 레이아웃 (원래 WorkFit 기존 디자인 톤 및 삭제/이동 버튼 원복)
          const { edit, originalIndex } = group.items[0];
          return (
            <Fragment key={originalIndex}>
            <div
              className="rounded-lg border border-border bg-panel-alt px-2.5 py-2 hover:border-teal/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">
                  {groupIdx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPicker({ mode: 'replace', index: originalIndex })}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="truncate text-[12px] font-semibold text-ink">{nameOf(edit.approverId)}</span>
                  <span className="ml-1 text-[10px] text-ink3">{deptPosOf(edit.approverId)}</span>
                </button>
                <select
                  value={edit.kind}
                  onChange={(ev) => setKind(originalIndex, ev.target.value as StepKind)}
                  className={`shrink-0 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-semibold outline-none ${KIND_TONE[edit.kind]}`}
                >
                  {allowedKinds.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(originalIndex, -1)} className="text-[9px] leading-none text-ink3 hover:text-ink">▲</button>
                  <button type="button" onClick={() => move(originalIndex, 1)} className="text-[9px] leading-none text-ink3 hover:text-ink">▼</button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(originalIndex)}
                  title="결재자 삭제"
                  className="shrink-0 text-[13px] text-ink3 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>
              {/* Timeline 커넥터: 노드 사이 세로 실선 */}
              {!isLast && (
                <div className="flex" style={{ paddingLeft: '11px' }}>
                  <div className="w-0.5 h-2.5 bg-border-hi" />
                </div>
              )}
            </Fragment>
          );
        })}

        {edits.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-[11px] text-ink3">
            결재선이 비어 있습니다. 결재자 추가 또는 병렬 그룹 추가로 구성하세요.
          </div>
        )}
      </div>

      {/* 하단 버튼 2개: 일반 결재자 추가 / 병렬 그룹 추가 */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicker({ mode: 'add' })}
          className="flex-1 rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal transition-colors"
        >
          + 결재자 추가 (순차)
        </button>
        <button
          type="button"
          onClick={() => createEmptyParallelGroup()}
          className="flex-1 rounded-lg border border-dashed border-sky-300 bg-sky-50/50 py-1.5 text-[11.5px] font-bold text-sky-700 hover:bg-sky-100 transition-colors"
        >
          + 병렬 그룹 추가
        </button>
      </div>

      {dupWarn && (
        <p className="mt-1.5 text-[10.5px] text-amber">⚠ 기안자 본인 또는 중복 결재자가 포함돼 있습니다.</p>
      )}

      {/* 결재자 추가 버튼 바로 하단: 수신/시행 등 외부 slot */}
      {bottomSlot && <div className="mt-3">{bottomSlot}</div>}

      {/* 결재자 피커 팝오버 (Portal 적용하여 부모 쌓임 맥락 탈출) */}
      {picker && createPortal(
        <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/30 p-4" onClick={() => setPicker(null)}>
          <div className="max-h-[75vh] w-full max-w-md overflow-hidden rounded-2xl bg-panel shadow-2xl flex flex-col" onClick={(ev) => ev.stopPropagation()}>
            <div className="border-b border-border px-4 py-3 text-[13px] font-bold text-ink flex items-center justify-between shrink-0">
              <span>
                {picker.mode === 'add'
                  ? '결재자 추가'
                  : picker.mode === 'replace'
                  ? '결재자 변경'
                  : picker.groupIndex === -1
                  ? '병렬 그룹 결재자 추가 (최소 2명 이상 선택)'
                  : '병렬 그룹에 결재자 추가'}
              </span>
              <button type="button" onClick={() => setPicker(null)} className="text-[16px] text-ink3 hover:text-ink">✕</button>
            </div>
            <UserPickList
              users={users.filter((u) => u.status === '사용')}
              org={org}
              onPick={pick}
              isMultiSelect={picker.mode === 'add-to-group' && picker.groupIndex === -1}
              minSelectCount={picker.mode === 'add-to-group' && picker.groupIndex === -1 ? 2 : 1}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


/** 조직도 트리 및 리스트 탭 전환 사용자 선택 컴포넌트 (단일/다중 선택 지원). */
function UserPickList({
  users,
  org,
  onPick,
  isMultiSelect = false,
  minSelectCount = 1,
}: {
  users: User[];
  org: ReturnType<typeof useOrgTree>;
  onPick: (ids: string | string[]) => void;
  isMultiSelect?: boolean;
  minSelectCount?: number;
}) {
  const [tab, setTab] = useState<'org' | 'list'>('org');
  const [q, setQ] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const kw = q.trim().toLowerCase();
  const list = users.filter((u) => !kw || u.name.toLowerCase().includes(kw) || u.dept.toLowerCase().includes(kw));

  const toggleSelect = (id: string) => {
    if (!isMultiSelect) {
      onPick(id);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleConfirm = () => {
    if (selectedIds.length < minSelectCount) {
      alert(`최소 ${minSelectCount}명 이상의 결재자를 선택하셔야 병렬 그룹이 형성됩니다.`);
      return;
    }
    onPick(selectedIds);
  };

  return (
    <div className="flex max-h-[66vh] flex-col min-h-0 flex-1">
      {/* 탭 & 검색창 */}
      <div className="border-b border-border p-3 space-y-2 shrink-0">
        <div className="flex gap-1 rounded-lg bg-panel-alt p-1">
          <button
            type="button"
            onClick={() => setTab('org')}
            className={`flex-1 rounded-md py-1 text-[11.5px] font-bold transition-all ${
              tab === 'org' ? 'bg-panel text-teal shadow-xs' : 'text-ink3 hover:text-ink'
            }`}
          >
            🌳 조직도
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`flex-1 rounded-md py-1 text-[11.5px] font-bold transition-all ${
              tab === 'list' ? 'bg-panel text-teal shadow-xs' : 'text-ink3 hover:text-ink'
            }`}
          >
            📋 전체 사용자 목록
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·부서 검색..."
          className="w-full rounded-full border border-border-hi bg-panel-alt px-3.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal"
        />
      </div>

      {/* 본문 뷰 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {kw ? (
          /* 검색어 입력 시 검색 결과 리스트 */
          <div className="space-y-0.5">
            {list.map((u) => (
              <UserPickItem key={u.id} user={u} onPick={toggleSelect} isSelected={selectedIds.includes(u.id)} isMulti={isMultiSelect} />
            ))}
            {list.length === 0 && <div className="py-8 text-center text-[11.5px] text-ink3">검색 결과가 없습니다.</div>}
          </div>
        ) : tab === 'org' ? (
          /* 조직도 트리 뷰 */
          <div className="space-y-1">
            {org.roots.map((root) => (
              <OrgTreeNodeItem key={root.dept.id} node={root} onPick={toggleSelect} selectedIds={selectedIds} isMulti={isMultiSelect} />
            ))}
            {org.roots.length === 0 && <div className="py-8 text-center text-[11.5px] text-ink3">조직도 정보가 없습니다.</div>}
          </div>
        ) : (
          /* 전체 사용자 리스트 뷰 */
          <div className="space-y-0.5">
            {list.map((u) => (
              <UserPickItem key={u.id} user={u} onPick={toggleSelect} isSelected={selectedIds.includes(u.id)} isMulti={isMultiSelect} />
            ))}
            {list.length === 0 && <div className="py-8 text-center text-[11.5px] text-ink3">사용자가 없습니다.</div>}
          </div>
        )}
      </div>

      {/* 다중 선택 시 하단 확정 버튼 */}
      {isMultiSelect && (
        <div className="border-t border-border bg-panel-alt p-3 flex items-center justify-between shrink-0">
          <span className="text-[11.5px] font-bold text-ink">
            선택된 결재자: <strong className="text-teal font-extrabold">{selectedIds.length}명</strong>
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white hover:bg-teal-dark transition-colors shadow-xs"
          >
            선택 완료 ({selectedIds.length}명)
          </button>
        </div>
      )}
    </div>
  );
}

/** 조직도 트리의 각 부서 노드 컴포넌트 */
function OrgTreeNodeItem({
  node,
  onPick,
  selectedIds = [],
  isMulti = false,
}: {
  node: import('@/features/gw/useOrgTree').OrgNode;
  onPick: (id: string) => void;
  selectedIds?: string[];
  isMulti?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasContent = node.children.length > 0 || node.members.length > 0;

  return (
    <div className="space-y-0.5 select-none">
      {/* 부서 헤더 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] font-bold text-ink hover:bg-panel-alt transition-colors"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="text-[13px]">🏢</span>
          <span className="truncate">{node.dept.name}</span>
          <span className="text-[10px] text-ink3 font-normal">({node.members.length})</span>
        </span>
        {hasContent && <span className="text-[9px] text-ink3">{open ? '▼' : '▶'}</span>}
      </button>

      {/* 부서원 및 하위 부서 (펼침 상태) */}
      {open && hasContent && (
        <div className="ml-3.5 pl-2 border-l border-border/60 space-y-0.5">
          {/* 부서 소속원들 */}
          {node.members.map((u) => (
            <UserPickItem key={u.id} user={u} onPick={onPick} isSelected={selectedIds.includes(u.id)} isMulti={isMulti} />
          ))}

          {/* 하위 부서들 */}
          {node.children.map((child) => (
            <OrgTreeNodeItem key={child.dept.id} node={child} onPick={onPick} selectedIds={selectedIds} isMulti={isMulti} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 개별 사용자 아이템 컴포넌트 */
function UserPickItem({
  user,
  onPick,
  isSelected = false,
  isMulti = false,
}: {
  user: User;
  onPick: (id: string) => void;
  isSelected?: boolean;
  isMulti?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(user.id)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-all group ${
        isSelected
          ? 'bg-teal-soft/80 text-teal border border-teal/40 font-bold'
          : 'hover:bg-teal-soft/30 hover:text-teal'
      }`}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${
        isSelected ? 'bg-teal text-white' : 'bg-teal-soft text-teal group-hover:bg-teal group-hover:text-white'
      }`}>
        {isSelected ? '✓' : user.name[0]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`truncate text-[12px] ${isSelected ? 'font-bold text-teal' : 'font-semibold text-ink group-hover:text-teal'}`}>
            {user.name}
          </span>
          <span className="text-[10px] text-teal font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {isMulti ? (isSelected ? '해제' : '선택') : '선택 ➔'}
          </span>
        </div>
        <div className="truncate text-[10.5px] text-ink3">{user.dept} · {user.position}</div>
      </div>
    </button>
  );
}
