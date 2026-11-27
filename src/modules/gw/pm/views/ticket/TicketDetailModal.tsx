import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { liveOf } from '@/domain/pm/rules';
import {
  applyTicketDraft, PM_TICKET_FLOW, PM_TICKET_PRIOS, SYSTEM, ticketActions, TICKET_EDIT_FIELDS, tkExpected, tkLate, tkOpen,
  tkReviewPending, type PmTicketPrio, type TicketDraft,
} from '@/domain/pm/ticket';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import { pmBase } from '@/data/pm/pm.store';
import type { usePmPeople } from '../../usePmPeople';
import { Tag } from '../wbs/parts';
import { SubtaskBox } from '../wbs/TaskDetailModal';
import { PersonSelect } from './IssueModal';
import { LegacyTag, PrioTag, StatusTag, TypeTag, workLabel } from './parts';

type People = ReturnType<typeof usePmPeople>;
const HIST_N = 7;
const inp = 'rounded border border-border-hi bg-panel px-1.5 py-1 text-[12px]';

/**
 * 티켓 상세 창 (renderTk 1933): 처리 단계 · 상태 버튼 · 코멘트 · 세부 작업 · 산출물 · 처리 이력 /
 * 오른쪽 담당·검토·승인·우선순위·마감 ([수정]을 눌러야 반영) · 진행률 · 업무 원본 · 발행 정보.
 * 처리할 사람이 아닌 사람이 누르면 "(대리 처리)"로 기록 (데모 그대로 — 막지 않음).
 */
export function TicketDetailModal({ no, d, people, mut, onClose, onOpenTicket, onOpenTask }: {
  no: string;
  d: PmDerived;
  people: People;
  mut: ReturnType<typeof usePmMutations>;
  onClose: () => void;
  onOpenTicket: (no: string) => void;
  /** 업무 상세로 (업무 목록에서 열었을 때) */
  onOpenTask?: (taskId: string) => void;
}) {
  const x = d.ticketMap.get(no);
  const [cmt, setCmt] = useState('');
  const [file, setFile] = useState('');
  const [draft, setDraft] = useState<Partial<TicketDraft>>({});
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [allHist, setAllHist] = useState(false);
  if (!x) return null;
  const t = x.taskId ? d.taskMap.get(x.taskId) : undefined;
  const p = d.snap.projects.find((v) => v.id === x.projectId);
  const me = people.me;
  const open = tkOpen(x);
  const who = (id: string) => (id === SYSTEM ? '시스템' : people.labelOf(id) || '-');
  const D: TicketDraft = { assigneeId: x.assigneeId, reviewerId: x.reviewerId, approverId: x.approverId, prio: x.prio, due: x.due, ...draft };
  const chg = (k: keyof TicketDraft) => D[k] !== x[k];
  const dirty = TICKET_EDIT_FIELDS.some(chg);
  const hl = (k: keyof TicketDraft) => (chg(k) ? 'bg-amber-soft' : '');
  const expect = tkExpected(x);
  const acts = ticketActions(x);
  const overDue = !!(t && t.end && x.due > t.end);
  const ok = (t: string) => setMsg({ t });
  const fail = (e: unknown) => setMsg({ t: e instanceof Error ? e.message : String(e), bad: true });

  const close = () => {
    if (dirty && !confirm('수정한 내용이 아직 반영되지 않았습니다.\n[수정]을 누르지 않고 닫으면 바꾼 내용이 사라집니다.\n\n그래도 닫을까요?')) return;
    onClose();
  };
  const move = async (to: (typeof acts)[number][0]) => {
    try { ok(await mut.moveTicket.mutateAsync({ no: x.no, to, cmt: cmt.trim() })); setCmt(''); } catch (e) { fail(e); }
  };
  const save = async () => {
    const r = applyTicketDraft(x, D, me, d.today, people.nameOf, t?.end ?? '');
    if (!r.ok) { fail(new Error(r.error)); return; }
    if (!r.changed) return;
    // G1: 화면 값 x 에 고친 칸을 얹어 티켓을 통째로 씀 → 표 = 화면의 x
    await mut.putTicket.mutateAsync({ x: r.ticket, base: [pmBase('tickets', x.no, x)] });
    setDraft({});
    ok(`${x.no} 수정 ${r.changed}건 반영${r.ticket.status !== x.status ? ' — 담당이 바뀌어 다시 접수해야 합니다' : ''}`);
  };
  const comment = async () => {
    if (!cmt.trim()) { fail(new Error('코멘트를 입력하세요')); return; }
    await mut.commentTicket.mutateAsync({ no: x.no, text: cmt.trim() });
    setCmt('');
  };
  const addFile = async () => {
    if (!file.trim()) { fail(new Error('산출물 이름이나 링크를 입력하세요')); return; }
    await mut.addTicketFile.mutateAsync({ no: x.no, name: file.trim() });
    setFile('');
  };
  const hist = [...x.hist].reverse();
  const ci = PM_TICKET_FLOW.indexOf(x.status as (typeof PM_TICKET_FLOW)[number]);

  return (
    <Modal
      open
      onClose={close}
      width={980}
      title={
        <span className="flex flex-wrap items-center gap-1.5">
          <Tag tone="navy">{x.no}</Tag><StatusTag s={x.status} /><TypeTag t={x.type} /><PrioTag p={x.prio} />
          {x.taskChange && <Tag tone="bad">업무 {x.taskChange}</Tag>}
          {x.legacyKey && <LegacyTag k={x.legacyKey} />}
          {tkLate(x, d.today) && <Tag tone="bad">마감 경과</Tag>}
          <span className="ml-1">{x.title}</span>
        </span>
      }
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-[11px] text-ink3">현재 사용자: {who(me)}</span>
          <span className="flex-1" />
          {open && dirty && <Button onClick={() => setDraft({})}>되돌리기</Button>}
          {open && <Button variant="primary" onClick={save} disabled={!dirty} title="바꾼 담당자·검토자·승인자·우선순위·마감일을 반영하고 처리 이력에 남깁니다">수정</Button>}
          <Button onClick={close}>닫기</Button>
        </div>
      }
    >
      <div className="mb-3 text-[11.5px] text-ink3">
        {x.subtaskId && x.parent && <div>세부 작업 · 업무 {x.code} {x.parent}</div>}
        {x.projectId} · {p?.company ?? ''} · {p?.biz ?? ''} · {x.stage} · 업무 {workLabel(x)}
      </div>
      {msg && <div className={`mb-3 rounded-lg px-3 py-1.5 text-[12px] ${msg.bad ? 'bg-danger/10 text-danger' : 'bg-teal-soft text-ink2'}`}>{msg.t}</div>}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <Sect>처리 단계</Sect>
          <div className="flex gap-1">
            {PM_TICKET_FLOW.map((s, i) => (
              <div key={s} className={`flex-1 rounded px-1 py-1 text-center text-[11px] font-bold ${x.status === '완료' || (ci >= 0 && i < ci) ? 'bg-teal text-white' : i === ci ? 'bg-navy text-white' : 'bg-panel-alt text-ink3'}`}>{s}</div>
            ))}
          </div>
          {x.status === '검토요청' && (
            <div className="mt-1.5 text-[11px] text-ink3">
              {tkReviewPending(x)
                ? <>검토자 <b>{who(x.reviewerId)}</b> 검토 중 → 통과하면 승인자 <b>{who(x.approverId)}</b> 최종 승인</>
                : <>{x.reviewerId ? `검토 통과 (${who(x.reviewerId)}) · ` : ''}승인자 <b>{who(x.approverId)}</b> 승인 대기</>}
            </div>
          )}
          {x.status === '보류' && <Note tone="warn">보류 중인 티켓입니다. 사유는 이력을 확인하세요.</Note>}
          {x.status === '취소' && <Note>발행 취소된 티켓입니다. 이 업무는 다시 발행할 수 있습니다.</Note>}
          {x.legacyKey && <Note>예전 WBS 번호({x.legacyKey})에 묶여 있던 옛 업무 기록입니다. 지금 업무 목록과 연결되지 않습니다. 이어서 할 일이면 새 업무 아래에서 새 티켓으로 발행하세요.</Note>}
          <div className="my-2 flex flex-wrap items-center gap-1.5">
            {acts.map(([to, label, tone]) => (
              <Button key={to} size="sm" variant={tone === 'primary' ? 'primary' : tone === 'danger' ? 'danger' : tone === 'ok' ? 'accent' : 'secondary'} onClick={() => move(to)}>{label}</Button>
            ))}
            {expect && expect !== me && acts.length > 0 && <span className="text-[11px] text-ink3">※ 처리할 사람: {who(expect)} (지금 {who(me)} — 누르면 대리 처리로 기록)</span>}
          </div>
          <textarea className={`${inp} min-h-[56px] w-full`} value={cmt} onChange={(e) => setCmt(e.target.value)} placeholder="코멘트 · 반려/보류 사유 입력" />
          <div className="mt-1 flex items-center gap-2"><Button size="sm" onClick={comment}>💬 코멘트 등록</Button><span className="text-[11px] text-ink3">반려 · 보류 · 재오픈은 사유가 필요합니다</span></div>

          {t && <SubtaskBox taskId={t.id} d={d} people={people} mut={mut} onMsg={(m) => ok(m)} taskName={t.name} taskDone={false} onOpenTicket={onOpenTicket} />}

          <Sect>산출물 첨부 <span className="font-normal text-ink3">(선택) {x.output || ''}</span></Sect>
          {x.files.length ? x.files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-[12px]">
              <Tag tone="ok">📎</Tag>
              <span className="flex-1">{f.name} <span className="text-ink3">· {who(f.by)} · {f.date}</span></span>
              {x.status !== '완료' && <Button size="sm" variant="ghost" onClick={() => mut.removeTicketFile.mutate({ no: x.no, index: i })}>지우기</Button>}
            </div>
          )) : <div className="text-[11.5px] text-ink3">첨부된 산출물이 없습니다 (첨부 없이도 검토 요청할 수 있습니다)</div>}
          {open && (
            <div className="mt-1.5 flex gap-1.5">
              <input className={`${inp} flex-1`} value={file} onChange={(e) => setFile(e.target.value)} placeholder="문서명 / 링크 / Git 커밋" onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void addFile(); } }} />
              <Button size="sm" onClick={addFile}>첨부</Button>
            </div>
          )}

          <Sect>처리 이력 <span className="font-normal text-ink3">{x.hist.length}건 · 최신순</span></Sect>
          <div className="rounded-lg border border-border px-2.5">
            {(allHist ? hist : hist.slice(0, HIST_N)).map((h, i) => (
              <div key={i} className={`border-b border-border/60 py-1.5 text-[11.5px] last:border-b-0 ${h.comment ? 'bg-panel-alt' : ''}`}>
                <span className="text-ink3">{h.date}</span> <b>{who(h.by)}</b> — {h.text}
              </div>
            ))}
            {hist.length > HIST_N && <button type="button" className="py-1 text-[11px] font-bold text-teal" onClick={() => setAllHist((v) => !v)}>{allHist ? '접기' : `나머지 ${hist.length - HIST_N}건 더 보기`}</button>}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-x-2 gap-y-1.5 text-[12px]">
            <K>담당자</K><span className={hl('assigneeId')}><PersonSelect people={people} value={D.assigneeId} onChange={(v) => setDraft((o) => ({ ...o, assigneeId: v }))} blank="— 지정 필요 —" full disabled={!open} /></span>
            <K>검토자</K><span className={hl('reviewerId')}><PersonSelect people={people} value={D.reviewerId} onChange={(v) => setDraft((o) => ({ ...o, reviewerId: v }))} blank="없음 — 승인자가 바로 검토" full disabled={!open} /></span>
            <K>승인자</K><span className={hl('approverId')}><PersonSelect people={people} value={D.approverId} onChange={(v) => setDraft((o) => ({ ...o, approverId: v }))} blank="— 지정 필요 —" full disabled={!open} /></span>
            <K>우선순위</K>
            <select className={`${inp} ${hl('prio')}`} value={D.prio} disabled={!open} onChange={(e) => setDraft((o) => ({ ...o, prio: e.target.value as PmTicketPrio }))}>{PM_TICKET_PRIOS.map((v) => <option key={v}>{v}</option>)}</select>
            <K>마감일</K>
            <span>
              <input type="date" className={`${inp} ${hl('due')}`} value={D.due} disabled={!open} onChange={(e) => setDraft((o) => ({ ...o, due: e.target.value }))} />
              {overDue && <div className="text-[11px] font-bold text-danger">업무 종료일 초과 — 일정 변경 협의 필요</div>}
            </span>
            {open && <><span /><span className={`text-[11px] ${dirty ? 'font-bold text-danger' : 'text-ink3'}`}>{dirty ? '수정 전 — 아래 [수정]을 눌러야 반영됩니다' : '바꾼 뒤 아래 [수정]을 눌러야 반영됩니다'}</span></>}
            <K>참여자</K><span className="text-[11.5px]">{x.watcherIds.map(who).join(', ') || '-'}</span>
            <K>진행률</K>
            <span className="flex items-center gap-2">
              <input
                type="range" min={0} max={100} step={1} defaultValue={x.prog} key={x.prog}
                disabled={!(x.status === '접수' || x.status === '진행중')}
                onMouseUp={(e) => { const n = +(e.target as HTMLInputElement).value; if (n !== x.prog) void mut.ticketProg.mutateAsync({ no: x.no, pct: n }); }}
                onKeyUp={(e) => { const n = +(e.target as HTMLInputElement).value; if (n !== x.prog) void mut.ticketProg.mutateAsync({ no: x.no, pct: n }); }}
                className="w-[130px]" aria-label="진행률"
              />
              <b>{x.prog}%</b>
            </span>
          </div>

          <Sect>업무 원본</Sect>
          {t ? (
            <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[11.5px]">
              <K>업무</K><span>{onOpenTask ? <button type="button" className="text-left font-bold text-teal" onClick={() => onOpenTask(t.id)}>{t.code} {t.name}</button> : `${t.code} ${t.name}`}</span>
              <K>기간</K><span>{t.start || t.end ? `${t.start || '-'} ~ ${t.end || '-'}` : '일정 없음'}</span>
              <K>업무 상태</K><span>{t.status} · 계획 {t.planPct}% / 실적 {t.actualPct}%</span>
              <K>반영 실적</K><span><b>{Math.round((d.liveMap.get(t.id) ?? liveOf(t)).pct)}%</b> <span className="text-ink3">티켓 진행률 반영</span></span>
              <K>PM</K><span>{t.pmName || '-'}</span>
              <K>담당</K><span>{t.assigneeIds.map(people.nameOf).join(', ') || '-'}</span>
              <K>마일스톤</K><span>{t.milestone ? '◆ 예' : '-'}</span>
            </div>
          ) : (
            <Note tone={x.legacyKey ? undefined : 'bad'}>{x.legacyKey ? `옛 업무 ${x.legacyKey} — 지금 업무 목록에 없음 (연결하지 않음)` : '지금 업무 목록에서 원본 업무를 찾을 수 없습니다 (삭제되었거나 번호 변경)'}</Note>
          )}
          <Sect>발행 정보</Sect>
          <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[11.5px]">
            <K>발행</K><span>{x.created} · {who(x.issuerId)}</span>
            {x.memo && <><K>메모</K><span>{x.memo}</span></>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

const Sect = ({ children }: { children: ReactNode }) => <div className="mb-1.5 mt-4 text-[12px] font-bold text-ink">{children}</div>;
const K = ({ children }: { children: ReactNode }) => <span className="text-[11.5px] font-bold text-ink3">{children}</span>;
function Note({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' }) {
  const c = tone === 'warn' ? 'bg-amber-soft text-ink2' : tone === 'bad' ? 'bg-danger/10 text-danger' : 'bg-panel-alt text-ink2';
  return <div className={`mt-2 rounded-lg px-3 py-1.5 text-[11.5px] ${c}`}>{children}</div>;
}
