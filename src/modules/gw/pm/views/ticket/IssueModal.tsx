import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { defaultAssignee, liveOf } from '@/domain/pm/rules';
import type { PmTask } from '@/domain/pm/schema';
import { checkIssue, defaultPrio, makeTaskTicket, PM_TICKET_PRIOS, ticketType, type PmTicket, type PmTicketPrio } from '@/domain/pm/ticket';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { ProjectTag, Tag } from '../wbs/parts';
import { TypeTag } from './parts';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';

type People = ReturnType<typeof usePmPeople>;
const sel = 'rounded border border-border-hi bg-panel px-1.5 py-1 text-[12px]';

/**
 * 티켓 발행 창 (openIssue 1791 · submitIssue 1823 · showIssued 1841).
 * 업무 1건당 티켓 1건. 담당 = 업무 첫 담당, 마감 = 업무 종료일, 우선순위 = 마일스톤 높음 · 종료일 지남 긴급.
 * 승인자 기본 = 업무 PM(이름이 그룹웨어 사용자 1명과 맞을 때). 발행 알림(데모의 Slack · 메일 · 앱 알림 체크)은 1차에 없음 — 그룹웨어 알림 연결은 2차 (11/25 결정, 설계 0장 · 3.5).
 */
export function IssueModal({ ids, d, people, mut, shortOf, onClose, onIssued }: {
  ids: string[];
  d: PmDerived;
  people: People;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  onClose: () => void;
  /** 발행 끝 (선택 해제 등) */
  onIssued?: (made: PmTicket[]) => void;
}) {
  const list = ids.map((id) => d.taskMap.get(id)).filter((t): t is PmTask => !!t && !d.taskTicket.has(t.id));
  const [rows, setRows] = useState(() => list.map((t) => ({
    id: t.id,
    assigneeId: defaultAssignee(t),
    prio: defaultPrio(t, d.liveMap.get(t.id) ?? liveOf(t), d.today) as PmTicketPrio,
    due: t.end,
  })));
  const [reviewerId, setReviewer] = useState('');
  const [approverId, setApprover] = useState('');
  const [memo, setMemo] = useState('');
  const [bulkAs, setBulkAs] = useState('');
  const [err, setErr] = useState<string[]>([]);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [made, setMade] = useState<PmTicket[] | null>(null);
  const [, setParams] = useSearchParams();
  const approverOf = (t: PmTask) => people.idByName(t.pmName);
  // 끊긴 발행 뒤 같은 창에서 다시 발행하면 티켓이 또 생김 (결정 (나))
  const lock = usePmPartialLock();

  if (made) return <IssuedModal made={made} people={people} onClose={onClose} onGo={() => { onClose(); setParams({ v: 'task/ticket' }); }} />;
  if (!list.length) {
    return (
      <Modal open onClose={onClose} title="🎫 티켓 발행" footer={<Button onClick={onClose}>닫기</Button>}>
        <p className="text-[12px] text-ink2">발행할 업무가 없습니다. 고른 업무는 이미 티켓이 있습니다.</p>
      </Modal>
    );
  }

  const byK = new Map<string, number>();
  list.forEach((t) => byK.set(t.projectId, (byK.get(t.projectId) ?? 0) + 1));
  const need = rows.filter((r) => !r.assigneeId).length;
  const set = (id: string, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const applyBulk = (all: boolean) => {
    if (!bulkAs) { setErr(['적용할 담당자를 고르세요']); return; }
    setRows((rs) => rs.map((r) => (all || !r.assigneeId ? { ...r, assigneeId: bulkAs } : r)));
    setErr([]);
  };

  const submit = async () => {
    const R = rows.map((r) => ({ task: d.taskMap.get(r.id)!, assigneeId: r.assigneeId, prio: r.prio, due: r.due }));
    const o = { reviewerId, approverId, memo: memo.trim() };
    const e = checkIssue(R, o, new Set(d.taskTicket.keys()), approverOf);
    setBad(new Set(rows.filter((r) => !r.assigneeId || !r.due || !(approverId || approverOf(d.taskMap.get(r.id)!))).map((r) => r.id)));
    if (e.length) { setErr(e); return; }
    const ctx = { today: d.today, me: people.me, approverOf, nameOf: people.nameOf };
    const tickets = R.map((r) => makeTaskTicket('P0-0000', r, o, { ...ctx, live: d.liveMap.get(r.task.id) ?? liveOf(r.task) }));
    try {
      const out = await mut.issueTickets.mutateAsync(tickets);
      onIssued?.(out);
      setMade(out);
    } catch (x) {
      setErr([x instanceof Error ? x.message : String(x)]);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={980}
      title={`🎫 티켓 발행 — ${list.length}건`}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-[11px] text-ink3">발행 후 담당자가 '접수'하면 작업이 시작됩니다</span>
          <span className="flex-1" />
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={mut.issueTickets.isPending || lock}>🎫 {list.length}건 발행</Button>
        </div>
      }
    >
      {lock && <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger" role="alert">{PARTIAL_LOCK_MSG}</div>}
      {err.length > 0 && <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">{err.map((x) => <div key={x}>{x}</div>)}</div>}
      <p className="mb-2 rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] leading-relaxed text-ink2">
        업무 1건당 티켓 1건이 발행됩니다. 담당자는 <b>업무의 첫 담당</b>, 마감일은 업무 종료일, 우선순위는 마일스톤(◆)은 높음 · 종료일 지남은 긴급으로 정해집니다.
        {need > 0 && <b className="text-danger"> 담당이 없는 업무 {need}건은 담당자를 직접 지정해야 합니다.</b>}
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">{[...byK].map(([k, n]) => <Tag key={k} tone="run">{shortOf(k)} · {n}건</Tag>)}</div>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-panel-alt px-3 py-2">
        <b className="text-[11.5px]">담당자 일괄 지정</b>
        <PersonSelect people={people} value={bulkAs} onChange={setBulkAs} blank="— 고르기 —" />
        <Button size="sm" onClick={() => applyBulk(false)}>미지정 업무에만 적용</Button>
        <Button size="sm" onClick={() => applyBulk(true)}>전체에 적용</Button>
      </div>
      <div className="max-h-[46vh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-panel-alt text-left text-[11px] text-ink3">
            <tr><th className="px-2 py-1.5">업무</th><th className="px-2">내용</th><th className="px-2">종류</th><th className="px-2">담당자 *</th><th className="px-2">우선순위</th><th className="px-2">마감일 *</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = d.taskMap.get(r.id)!;
              return (
                <tr key={r.id} className={`border-t border-border align-top ${bad.has(r.id) ? 'bg-danger/10' : ''}`}>
                  <td className="whitespace-nowrap px-2 py-1.5"><ProjectTag>{shortOf(t.projectId)}</ProjectTag> {t.code}{t.milestone ? ' ◆' : ''}</td>
                  <td className="min-w-[220px] px-2 py-1.5">
                    {t.name}
                    <div className="text-[10.5px] text-ink3">{t.stage} · 📄 {t.output || '-'}{t.execMemo ? ` · 실행 주체: ${t.execMemo}` : ''}</div>
                  </td>
                  <td className="px-2 py-1.5"><TypeTag t={ticketType(t.stage)} /></td>
                  <td className="px-2 py-1.5"><PersonSelect people={people} value={r.assigneeId} onChange={(v) => set(r.id, { assigneeId: v })} blank="— 담당자 지정 필요 —" /></td>
                  <td className="px-2 py-1.5">
                    <select className={sel} value={r.prio} onChange={(e) => set(r.id, { prio: e.target.value as PmTicketPrio })}>{PM_TICKET_PRIOS.map((p) => <option key={p}>{p}</option>)}</select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="date" className={sel} value={r.due} onChange={(e) => set(r.id, { due: e.target.value })} />
                    <div className="text-[10.5px] text-ink3">업무 종료 {t.end || '-'}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-[11.5px]">
          <b className="mb-1 block">발행자</b>
          <input className={`${sel} w-full bg-panel-alt`} value={people.labelOf(people.me)} readOnly />
          <small className="text-ink3">로그인한 사람</small>
        </label>
        <label className="text-[11.5px]">
          <b className="mb-1 block">검토자 <span className="font-normal text-ink3">(선택)</span></b>
          <PersonSelect people={people} value={reviewerId} onChange={setReviewer} blank="없음 — 승인자가 바로 검토" full />
          <small className="text-ink3">지정하면 검토자가 먼저 검토 통과 · 반려하고, 그다음 승인자가 최종 승인합니다</small>
        </label>
        <label className="text-[11.5px]">
          <b className="mb-1 block">승인자</b>
          <PersonSelect people={people} value={approverId} onChange={setApprover} blank="업무의 PM (기본)" full />
          <small className="text-ink3">최종 승인 · 완료 처리자. 발행 후에도 티켓 창에서 바꿀 수 있습니다</small>
        </label>
        <label className="text-[11.5px] sm:col-span-3">
          <b className="mb-1 block">공통 전달 메모</b>
          <textarea className={`${sel} min-h-[56px] w-full`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 12월 1주차 착수분. 산출물은 감리 양식으로 첨부 바랍니다." />
        </label>
      </div>
    </Modal>
  );
}

export function PersonSelect({ people, value, onChange, blank, full, disabled }: {
  people: People; value: string; onChange: (v: string) => void; blank?: string; full?: boolean; disabled?: boolean;
}) {
  const known = !value || people.people.some((p) => p.id === value);
  return (
    <select className={`${sel} ${full ? 'w-full' : 'max-w-[160px]'}`} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {blank != null && <option value="">{blank}</option>}
      {!known && <option value={value}>{people.labelOf(value)}</option>}
      {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
}

/** 발행 끝 (showIssued 1841): 담당자별 티켓 */
function IssuedModal({ made, people, onClose, onGo }: { made: PmTicket[]; people: People; onClose: () => void; onGo: () => void }) {
  const by = new Map<string, PmTicket[]>();
  made.forEach((x) => by.set(x.assigneeId, [...(by.get(x.assigneeId) ?? []), x]));
  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={`✅ 티켓 ${made.length}건 발행 완료`}
      footer={<div className="flex w-full justify-end gap-2"><Button onClick={onClose}>계속 발행하기</Button><Button variant="primary" onClick={onGo}>🎫 티켓 목록으로 이동</Button></div>}
    >
      <p className="mb-2 rounded-lg bg-ok/10 px-3 py-2 text-[12px] text-ink2">담당자 {by.size}명에게 발행했습니다. 이 업무들은 다시 발행할 수 없도록 잠겼습니다 (발행 취소하면 다시 발행 가능).</p>
      <table className="w-full text-[12px]">
        <tbody>
          {[...by].map(([a, ts]) => (
            <tr key={a} className="border-t border-border align-top">
              <td className="w-[140px] py-1.5"><b>{people.labelOf(a)}</b><div className="text-[10.5px] text-ink3">{ts.length}건</div></td>
              <td className="py-1.5">{ts.map((x) => <span key={x.no} className="m-0.5 inline-block"><Tag tone="warn">{x.no} · {x.title.slice(0, 28)}{x.title.length > 28 ? '…' : ''}</Tag></span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
