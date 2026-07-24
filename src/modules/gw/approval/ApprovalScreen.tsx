import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import { useOrgTree } from '@/features/gw/useOrgTree';
import {
  useApprovalBoxes,
  useApprovalDoc,
  useDecideStep,
  useRecallApproval,
  useSubmitApproval,
  useDeleteToTrash,
  useRestoreFromTrash,
  usePermanentlyDelete,
} from '@/features/gw/useApprovals';
import { activeSteps, currentApproverIds } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { DecisionBadge, DOC_TYPE_ICON, fmtDateTime, GwHead, KIND_TONE, StatusBadge, won } from '@/modules/gw/_gw';
import { ApprovalDraftModal } from '@/modules/gw/approval/ApprovalDraftModal';
import { ApprovalDocumentView } from '@/modules/gw/approval/ApprovalDocumentView';
import { ApprovalExecutionPanel } from '@/modules/gw/approval/ApprovalExecutionPanel';

/**
 * 전자결재 결재함(§7.2) — 좌 함 탭(대기·상신·완료·참조·임시) + 중 목록 + 우 상세.
 * 상세는 결재선 진행 타임라인 + 내 차례면 승인/반려/보류 액션, 기안자면 회수/재상신/편집.
 * 모든 전이는 features 훅(엔진 위임) → 성공 시 캐시 무효화로 함·배지 자동 갱신.
 */
const BOX_LABEL: Record<ApprovalBox, string> = {
  대기: '결재함',
  상신: '상신함',
  반려: '반려함',
  임시: '임시저장함',
  수신: '수신함',
  참조: '참조함',
  시행: '시행함',
  완료: '완료함',
  삭제: '휴지통',
};



export default function ApprovalScreen() {
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { byBox, counts, isLoading } = useApprovalBoxes(me);
  const [params, setParams] = useSearchParams();
  const [box, setBox] = useState<ApprovalBox>('대기');

  const myActivePendingCount = useMemo(() => {
    const list = byBox['대기'] ?? [];
    return list.filter((d) => currentApproverIds(d).includes(me)).length;
  }, [byBox, me]);

  const [selId, setSelId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ edit?: ApprovalDoc | null } | null>(null);
  const [doneFilter, setDoneFilter] = useState<'all' | 'draft' | 'approved'>('all');
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'progress'>('all');

  const list = byBox[box] ?? [];
  const selDoc = useApprovalDoc(selId);

  // 완료함 및 결재함 필터링 적용
  const filteredList = useMemo(() => {
    if (box === '완료') {
      if (doneFilter === 'draft') return list.filter((d) => d.drafterId === me);
      if (doneFilter === 'approved') {
        return list.filter((d) => d.steps.some((s) => s.approverId === me && s.decision === '승인'));
      }
      return list;
    }
    if (box === '대기') {
      if (todoFilter === 'pending') {
        return list.filter((d) => currentApproverIds(d).includes(me));
      }
      if (todoFilter === 'progress') {
        return list.filter((d) => !currentApproverIds(d).includes(me));
      }
      return list;
    }
    return list;
  }, [box, list, doneFilter, todoFilter, me]);

  // 딥링크(?doc=ID) → 해당 문서를 품은 함으로 이동 + 선택.
  useEffect(() => {
    const docId = params.get('doc');
    if (!docId) return;
    for (const b of APPROVAL_BOXES) {
      if ((byBox[b] ?? []).some((d) => d.id === docId)) {
        setBox(b);
        setSelId(docId);
        break;
      }
    }
    params.delete('doc');
    setParams(params, { replace: true });
  }, [params, byBox, setParams]);

  // 함 전환/목록/필터 변화 시 선택 보정(현재 필터링된 목록에 없으면 첫 항목).
  useEffect(() => {
    if (filteredList.length === 0) { setSelId(null); return; }
    if (!filteredList.some((d) => d.id === selId)) setSelId(filteredList[0].id);
  }, [box, filteredList, selId]);

  if (!user) return <div className="p-10 text-center text-[13px] text-ink3">로그인이 필요합니다.</div>;

  return (
    <div className="w-full px-6">
      <GwHead
        icon="🖋️"
        name="전자결재"
      />

      <div className="mt-5 grid grid-cols-[160px_260px_1fr] gap-4 h-[calc(100vh-160px)] items-stretch overflow-hidden">
        {/* 좌: 함 탭 */}
        <div className="rounded-xl border border-border bg-panel p-2 flex flex-col gap-3 h-full overflow-y-auto shrink-0">
          <button
            onClick={() => setModal({})}
            className="w-full rounded-lg bg-teal py-2 text-[12.5px] font-bold text-white hover:opacity-90 transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            + 새 상신
          </button>
          <button
            onClick={() => setBox('임시')}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${box === '임시' ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
          >
            <span>{BOX_LABEL['임시']}</span>
            {(counts['임시'] ?? 0) > 0 && (
              <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${box === '임시' ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2'}`}>
                {counts['임시']}
              </span>
            )}
          </button>
          <div className="h-px bg-border my-1" />
          {[
            { title: '결재할 문서', boxes: ['대기'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '내가 올린 문서', boxes: ['상신', '반려'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '공유 문서', boxes: ['수신', '참조', '시행'] as const, titleBg: 'bg-panel-alt text-ink2' },
            { title: '관리', boxes: ['완료', '삭제'] as const, titleBg: 'bg-panel-alt text-ink2' },
          ].map((g) => (
            <div key={g.title} className="flex flex-col gap-1.5">
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${g.titleBg}`}>
                {g.title}
              </div>
              <div className="space-y-0.5">
                {g.boxes.map((b) => {
                  const executionCount = (byBox['시행'] ?? []).filter(
                    (d) => d.execution?.status === '대기중' || d.execution?.status === '처리중'
                  ).length;

                  const hasBadge = b === '대기' 
                    ? (byBox['대기'] ?? []).length > 0
                    : b === '시행'
                    ? executionCount > 0
                    : (counts[b] ?? 0) > 0;
                  
                  const badgeCount = b === '대기'
                    ? (myActivePendingCount > 0 ? myActivePendingCount : (byBox['대기'] ?? []).length)
                    : b === '시행'
                    ? executionCount
                    : counts[b];

                  const badgeClass = b === '대기'
                    ? (myActivePendingCount > 0 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-ink3/15 text-ink2')
                    : (box === b ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2');

                  return (
                    <button
                      key={b}
                      onClick={() => setBox(b)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${box === b ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
                    >
                      <span>{BOX_LABEL[b]}</span>
                      {hasBadge && (
                        <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${badgeClass}`}>
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 중: 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel h-full flex flex-col shrink-0">
          <div className="border-b border-border px-3.5 py-2.5 flex items-center justify-between text-[12px] font-bold text-ink2">
            <span>{BOX_LABEL[box]} <span className="text-ink3">· {filteredList.length}</span></span>
          </div>
          {box === '대기' && (
            <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
              {(['all', 'pending', 'progress'] as const).map((f) => {
                const label = f === 'all' ? '전체' : f === 'pending' ? '결재대기중' : '진행중';
                return (
                  <button
                    key={f}
                    onClick={() => setTodoFilter(f)}
                    className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${
                      todoFilter === f
                        ? 'bg-teal text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {box === '완료' && (
            <div className="flex border-b border-border bg-panel-alt/50 p-1.5 gap-1.5">
              {(['all', 'draft', 'approved'] as const).map((f) => {
                const label = f === 'all' ? '전체' : f === 'draft' ? '기안한 문서' : '결재한 문서';
                return (
                  <button
                    key={f}
                    onClick={() => setDoneFilter(f)}
                    className={`flex-1 rounded-lg py-1.5 text-[10.5px] font-bold transition-all ${
                      doneFilter === f
                        ? 'bg-teal text-white shadow-sm'
                        : 'text-ink3 hover:bg-panel-alt hover:text-ink2'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="py-10 text-center text-[12px] text-ink3">불러오는 중…</div>}
            {!isLoading && filteredList.length === 0 && <div className="py-14 text-center text-[12px] text-ink3">문서가 없습니다.</div>}
            {filteredList.map((d) => {
              const isRecentCompleted = d.status === '완료' && d.completedAt && (Date.now() - new Date(d.completedAt).getTime() < 24 * 60 * 60 * 1000);
              const isMyTurn = d.status === '진행중' && currentApproverIds(d).includes(me);
              return (
                <button
                  key={d.id}
                  onClick={() => setSelId(d.id)}
                  className={`relative flex w-full flex-col gap-1 border-b border-border px-3.5 py-2.5 text-left transition-all ${
                    selId === d.id 
                      ? 'bg-teal-soft/60' 
                      : isRecentCompleted 
                        ? 'bg-teal-soft/10 hover:bg-teal-soft/20' 
                        : 'hover:bg-panel-alt'
                  } ${isRecentCompleted ? 'border-l-4 border-l-teal' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px]">{DOC_TYPE_ICON[d.docType] ?? '📄'}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{d.title}</span>
                    {isRecentCompleted && (
                      <span className="flex items-center gap-1 bg-teal/10 text-teal text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal"></span>
                        최근 완료
                      </span>
                    )}
                    {isMyTurn ? (
                      <StatusBadge status="진행중" label="결재대기중" className="bg-amber/15 text-amber" />
                    ) : (
                      <StatusBadge status={d.status} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-ink3">
                    <span className="truncate">{d.docNo} · {org_nameFallback(d)}</span>
                    <span>{fmtDateTime(d.submittedAt ?? d.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 우: 상세 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel h-full">
          {selDoc ? (
            <DocDetail doc={selDoc} me={me} onEdit={(d) => setModal({ edit: d })} />
          ) : (
            <div className="grid h-full place-items-center py-20 text-[12px] text-ink3">문서를 선택하세요.</div>
          )}
        </div>
      </div>

      {modal && <ApprovalDraftModal me={user} editDoc={modal.edit ?? null} onClose={() => setModal(null)} />}
    </div>
  );
}

/** 목록 보조 표기(기안자명은 상세에서 org 로 해석 — 목록은 부서 비정규화 사용). */
function org_nameFallback(d: ApprovalDoc): string {
  return d.drafterDept || '기안';
}

function DocDetail({ doc, me, onEdit }: { doc: ApprovalDoc; me: string; onEdit: (d: ApprovalDoc) => void }) {
  const org = useOrgTree();
  const decide = useDecideStep();
  const submitM = useSubmitApproval();
  const recallM = useRecallApproval();
  const deleteM = useDeleteToTrash();
  const restoreM = useRestoreFromTrash();
  const permDeleteM = usePermanentlyDelete();
  const [reject, setReject] = useState<{ seq: number; comment: string } | null>(null);
  const [err, setErr] = useState('');

  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const busy = decide.isPending || submitM.isPending || recallM.isPending || deleteM.isPending || restoreM.isPending || permDeleteM.isPending;

  // 내 차례(활성 결재자)의 seq.
  const mySeq = useMemo(() => activeSteps(doc).find((s) => s.approverId === me)?.seq ?? null, [doc, me]);
  const iAmDrafter = doc.drafterId === me;
  const canRecall = iAmDrafter && doc.status === '진행중' && !doc.steps.some((s) => s.kind !== '참조' && s.decision === '승인');
  const canResubmit = iAmDrafter && (doc.status === '반려' || doc.status === '회수');
  const canEditDraft = iAmDrafter && doc.status === '임시저장';
  const isInTrash = iAmDrafter && doc.status === '삭제';

  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.'); }
  };

  const toTrash = () => {
    if (window.confirm('이 임시저장 문서를 휴지통으로 보내시겠습니까?')) {
      run(() => deleteM.mutateAsync(doc.id));
    }
  };
  const restoreTrash = () => run(() => restoreM.mutateAsync(doc.id));
  const permDelete = () => {
    if (window.confirm('이 문서를 영구 삭제하시겠습니까? 복구할 수 없습니다.')) {
      run(() => permDeleteM.mutateAsync(doc.id));
    }
  };

  const approve = () => mySeq != null && run(() => decide.mutateAsync({ id: doc.id, seq: mySeq, userId: me, decision: '승인' }));
  const hold = () => mySeq != null && run(() => decide.mutateAsync({ id: doc.id, seq: mySeq, userId: me, decision: '보류' }));
  const doReject = () => {
    if (!reject) return;
    if (!reject.comment.trim()) { setErr('반려 사유를 입력하세요.'); return; }
    run(() => decide.mutateAsync({ id: doc.id, seq: reject.seq, userId: me, decision: '반려', comment: reject.comment }))
      .then(() => setReject(null));
  };

  const activeIds = currentApproverIds(doc);

  return (
    <div className="flex h-full flex-col">
      {/* 상세 헤더 */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px]">{DOC_TYPE_ICON[doc.docType] ?? '📄'}</span>
              <h2 className="truncate text-[15.5px] font-bold text-ink">{doc.title}</h2>
              {doc.status === '진행중' && currentApproverIds(doc).includes(me) ? (
                <StatusBadge status="진행중" label="결재대기중" className="bg-amber/15 text-amber" />
              ) : (
                <StatusBadge status={doc.status} />
              )}
            </div>
            <div className="mt-1 text-[11px] text-ink3">
              {doc.docNo} · {doc.docType} · 기안 {nameOf(doc.drafterId)}({doc.drafterDept}) · {fmtDateTime(doc.submittedAt ?? doc.createdAt)}
            </div>
          </div>
          {/* 인쇄 버튼 */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => window.print()}
              title="결재 문서 인쇄"
              className="rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[11px] font-semibold text-ink2 hover:border-teal hover:text-teal"
            >
              🖨 인쇄
            </button>
          </div>
        </div>
        {(doc.amount != null || doc.form) && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11.5px]">
            {doc.amount != null && <span className="rounded-md bg-panel-alt px-2 py-1 font-semibold text-ink2">금액 {won(doc.amount)}</span>}
            {doc.form && (
              <span className="rounded-md bg-panel-alt px-2 py-1 font-semibold text-ink2">
                {doc.form.leaveType} · {doc.form.startDate}~{doc.form.endDate} · {doc.form.days}일
              </span>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {doc.status === '반려' && (() => {
          const rejectStep = doc.steps.find((s) => s.decision === '반려');
          const rejectUser = rejectStep ? org.userById(rejectStep.approverId) : null;
          const rejectUserName = rejectUser ? `${rejectUser.name} ${rejectUser.position}` : rejectStep?.approverId ?? '알 수 없음';
          return (
            <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-[12px] text-ink animate-fade-in">
              <div className="flex items-center gap-1.5 font-bold text-danger mb-1.5">
                <span>⚠</span>
                <span>반려 정보</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 text-ink2">
                <div>• 반려자: <span className="font-semibold text-ink">{rejectUserName}</span></div>
                <div>• 반려일시: <span className="font-semibold text-ink">{rejectStep?.decidedAt ? fmtDateTime(rejectStep.decidedAt) : '—'}</span></div>
                <div className="col-span-2 mt-1 bg-white/60 dark:bg-black/10 rounded-lg p-2.5 border border-border/40">
                  <div className="text-[11px] text-ink3 font-semibold mb-1">반려 사유</div>
                  <div className="italic text-ink leading-relaxed">“{rejectStep?.comment || '반려 사유 없음'}”</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 상단: 결재선 타임라인 */}
        <div className="mb-5">
          <div className="mb-2 text-[11.5px] font-bold text-ink2">결재선</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[...doc.steps].sort((a, b) => a.seq - b.seq).map((s) => {
              const isActive = activeIds.includes(s.approverId) && (s.decision === '대기' || s.decision === '보류') && s.kind !== '참조';
              return (
                <div key={s.seq} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${isActive ? 'border-teal bg-teal-soft/50' : 'border-border bg-panel'}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-panel-alt text-[10px] font-bold text-ink2">{s.seq}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-ink">{nameOf(s.approverId)}</span>
                      <span className={`text-[10px] font-bold ${KIND_TONE[s.kind]}`}>{s.kind}</span>
                      {s.parallelGroup && <span className="rounded bg-blue/10 px-1 text-[9px] font-bold text-blue">병렬</span>}
                      {s.delegatedFromId && <span className="text-[9.5px] text-amber">대결(원 {nameOf(s.delegatedFromId)})</span>}
                    </div>
                    {s.comment && <div className="mt-0.5 truncate text-[10.5px] text-ink3" title={s.comment}>💬 {s.comment}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <DecisionBadge decision={s.decision} />
                    {s.decidedAt && <span className="text-[9px] text-ink3">{fmtDateTime(s.decidedAt)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 시행 정보 및 제어 영역 */}
        {doc.execution && (
          <ApprovalExecutionPanel doc={doc} userId={me} />
        )}

        {/* 하단: 결재 문서 */}
        <div className="border-t border-border pt-5">
          <div className="mb-3 text-[11.5px] font-bold text-ink2">결재 문서</div>
          <div className="rounded-xl border border-border bg-white dark:bg-zinc-900 overflow-hidden shadow-sm p-4">
            <ApprovalDocumentView doc={doc} />
          </div>
        </div>

        {err && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] font-semibold text-red-500">{err}</p>}

        {/* 반려 사유 입력 */}
        {reject && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
            <div className="mb-1.5 text-[11.5px] font-bold text-red-500">반려 사유</div>
            <textarea
              value={reject.comment}
              onChange={(e) => setReject({ ...reject, comment: e.target.value })}
              rows={2}
              autoFocus
              placeholder="반려 사유를 입력하세요(필수)"
              className="w-full resize-none rounded-lg border border-border-hi bg-panel px-3 py-2 text-[12px] text-ink outline-none focus:border-red-500"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setReject(null)} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink3 hover:bg-panel-alt">취소</button>
              <button onClick={doReject} disabled={busy} className="rounded-lg bg-red-500 px-3.5 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50">반려 확정</button>
            </div>
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
        {mySeq != null && !reject && (
          <>
            <button onClick={() => setReject({ seq: mySeq, comment: '' })} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">반려</button>
            <button onClick={hold} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-ink3 disabled:opacity-50">보류</button>
            <button onClick={approve} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">승인</button>
          </>
        )}
        {canRecall && <button onClick={() => run(() => recallM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-amber hover:text-amber disabled:opacity-50">회수</button>}
        {canEditDraft && (
          <>
            <button onClick={toTrash} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">삭제</button>
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">상신</button>
          </>
        )}
        {isInTrash && (
          <>
            <button onClick={permDelete} disabled={busy} className="rounded-lg border border-red-500/50 px-3.5 py-2 text-[12.5px] font-bold text-red-500 hover:bg-red-500/5 disabled:opacity-50">영구삭제</button>
            <button onClick={restoreTrash} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">복구</button>
          </>
        )}
        {canResubmit && (
          <>
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">재상신</button>
          </>
        )}
        {mySeq == null && !canRecall && !canEditDraft && !canResubmit && !isInTrash && (
          <span className="text-[11px] text-ink3">
            {doc.status === '완료' ? '결재가 완료된 문서입니다.' : doc.status === '진행중' ? '다른 결재자의 차례입니다.' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
