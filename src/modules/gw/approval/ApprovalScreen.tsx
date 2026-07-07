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
} from '@/features/gw/useApprovals';
import { activeSteps, currentApproverIds } from '@/domain/approvalDoc/engine';
import { APPROVAL_BOXES, type ApprovalBox, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import { DecisionBadge, DOC_TYPE_ICON, fmtDateTime, GwHead, KIND_TONE, StatusBadge, won } from '@/modules/gw/_gw';
import { ApprovalDraftModal } from '@/modules/gw/approval/ApprovalDraftModal';

/**
 * 전자결재 결재함(§7.2) — 좌 함 탭(대기·상신·완료·참조·임시) + 중 목록 + 우 상세.
 * 상세는 결재선 진행 타임라인 + 내 차례면 승인/반려/보류 액션, 기안자면 회수/재상신/편집.
 * 모든 전이는 features 훅(엔진 위임) → 성공 시 캐시 무효화로 함·배지 자동 갱신.
 */
const BOX_LABEL: Record<ApprovalBox, string> = {
  대기: '받은 결재',
  상신: '상신함',
  완료: '완료함',
  참조: '참조함',
  임시: '임시저장',
};

export default function ApprovalScreen() {
  const { user } = useAuth();
  const me = user?.id ?? '';
  const { byBox, counts, isLoading } = useApprovalBoxes(me);
  const [params, setParams] = useSearchParams();
  const [box, setBox] = useState<ApprovalBox>('대기');
  const [selId, setSelId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ edit?: ApprovalDoc | null } | null>(null);

  const list = byBox[box] ?? [];
  const selDoc = useApprovalDoc(selId);

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

  // 함 전환/목록 변화 시 선택 보정(현재 함에 없으면 첫 항목).
  useEffect(() => {
    if (list.length === 0) { setSelId(null); return; }
    if (!list.some((d) => d.id === selId)) setSelId(list[0].id);
  }, [box, list, selId]);

  if (!user) return <div className="p-10 text-center text-[13px] text-ink3">로그인이 필요합니다.</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <GwHead
        icon="🖋️"
        name="전자결재"
        right={
          <button
            onClick={() => setModal({})}
            className="rounded-lg bg-teal px-3.5 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
          >
            + 새 상신
          </button>
        }
      />

      <div className="mt-5 grid grid-cols-[150px_300px_1fr] gap-4">
        {/* 좌: 함 탭 */}
        <div className="rounded-xl border border-border bg-panel p-2">
          {APPROVAL_BOXES.map((b) => (
            <button
              key={b}
              onClick={() => setBox(b)}
              className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12.5px] ${box === b ? 'bg-teal-soft font-bold text-teal' : 'text-ink2 hover:bg-panel-alt'}`}
            >
              <span>{BOX_LABEL[b]}</span>
              {(counts[b] ?? 0) > 0 && (
                <span className={`grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold ${b === '대기' ? 'bg-amber text-white' : box === b ? 'bg-teal text-white' : 'bg-ink3/15 text-ink2'}`}>
                  {counts[b]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 중: 목록 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
          <div className="border-b border-border px-3.5 py-2.5 text-[12px] font-bold text-ink2">{BOX_LABEL[box]} <span className="text-ink3">· {list.length}</span></div>
          <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
            {isLoading && <div className="py-10 text-center text-[12px] text-ink3">불러오는 중…</div>}
            {!isLoading && list.length === 0 && <div className="py-14 text-center text-[12px] text-ink3">문서가 없습니다.</div>}
            {list.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelId(d.id)}
                className={`flex w-full flex-col gap-1 border-b border-border px-3.5 py-2.5 text-left ${selId === d.id ? 'bg-teal-soft/60' : 'hover:bg-panel-alt'}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px]">{DOC_TYPE_ICON[d.docType]}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{d.title}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="flex items-center justify-between text-[10.5px] text-ink3">
                  <span className="truncate">{d.docNo} · {org_nameFallback(d)}</span>
                  <span>{fmtDateTime(d.submittedAt ?? d.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우: 상세 */}
        <div className="overflow-hidden rounded-xl border border-border bg-panel">
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
  const [reject, setReject] = useState<{ seq: number; comment: string } | null>(null);
  const [err, setErr] = useState('');

  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const busy = decide.isPending || submitM.isPending || recallM.isPending;

  // 내 차례(활성 결재자)의 seq.
  const mySeq = useMemo(() => activeSteps(doc).find((s) => s.approverId === me)?.seq ?? null, [doc, me]);
  const iAmDrafter = doc.drafterId === me;
  const canRecall = iAmDrafter && doc.status === '진행중' && !doc.steps.some((s) => s.kind !== '참조' && s.decision === '승인');
  const canResubmit = iAmDrafter && (doc.status === '반려' || doc.status === '회수');
  const canEditDraft = iAmDrafter && doc.status === '임시저장';

  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.'); }
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
              <span className="text-[16px]">{DOC_TYPE_ICON[doc.docType]}</span>
              <h2 className="truncate text-[15.5px] font-bold text-ink">{doc.title}</h2>
              <StatusBadge status={doc.status} />
            </div>
            <div className="mt-1 text-[11px] text-ink3">
              {doc.docNo} · {doc.docType} · 기안 {nameOf(doc.drafterId)}({doc.drafterDept}) · {fmtDateTime(doc.submittedAt ?? doc.createdAt)}
            </div>
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
        {/* 본문 */}
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-panel-alt px-4 py-3 text-[12.5px] leading-relaxed text-ink2">
          {doc.body || <span className="text-ink3">본문 없음</span>}
        </div>

        {/* 결재선 타임라인 */}
        <div className="mt-4">
          <div className="mb-2 text-[11.5px] font-bold text-ink2">결재선</div>
          <div className="space-y-1.5">
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
                    {s.comment && <div className="mt-0.5 truncate text-[10.5px] text-ink3">💬 {s.comment}</div>}
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
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">상신</button>
          </>
        )}
        {canResubmit && (
          <>
            <button onClick={() => onEdit(doc)} disabled={busy} className="rounded-lg border border-border-hi px-3.5 py-2 text-[12.5px] font-bold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50">편집</button>
            <button onClick={() => run(() => submitM.mutateAsync({ id: doc.id, userId: me }))} disabled={busy} className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50">재상신</button>
          </>
        )}
        {mySeq == null && !canRecall && !canEditDraft && !canResubmit && (
          <span className="text-[11px] text-ink3">
            {doc.status === '완료' ? '결재가 완료된 문서입니다.' : doc.status === '진행중' ? '다른 결재자의 차례입니다.' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
