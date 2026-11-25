import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { doneInfoOf, isDone, isLate, leftText, liveOf, monthDay, undoPct } from '@/domain/pm/rules';
import type { PmSubtask, PmTask } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { makeSubTicket, subTicketOf } from '@/domain/pm/ticket';
import { StatusTag } from '../ticket/parts';
import { ProjectTag, Tag } from './parts';

/**
 * 업무 상세 창 (taskView 6412): 할 일 · 공수 · 세부 기능 · 담당 · PM · 기간 · 상태·진행률 · 세부 작업 ·
 * [수정] · [TASK 전체 완료] · [완료 취소] · [티켓 발행] (taskIssue) / 티켓 열기.
 * '계획서 쪽'은 1단계에선 글자만 (§5.1) — PDF 열기는 3단계.
 */
export function TaskDetailModal({ id, d, people, mut, shortOf, onClose, onEdit, onIssue, onOpenTicket }: {
  id: string;
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  onClose: () => void;
  onEdit: () => void;
  /** 이 업무로 티켓 발행 창 (taskIssue) */
  onIssue: (taskId: string) => void;
  onOpenTicket: (no: string) => void;
}) {
  const t = d.taskMap.get(id);
  const [msg, setMsg] = useState('');
  if (!t) return null;
  const { today } = d;
  const l = d.liveMap.get(t.id) ?? liveOf(t);
  const done = isDone(l);
  const info = doneInfoOf(t, l, d.doneMap, d.snap.logs);
  const p = d.snap.projects.find((x) => x.id === t.projectId);
  const fns = d.fnMap.get(t.id)?.items ?? [];
  const subs = d.subsByTask.get(t.id) ?? [];
  const preds = t.predecessorIds.map((x) => d.taskMap.get(x)).filter(Boolean);
  const tk = d.taskTicket.get(t.id);

  const complete = () => {
    const left = subs.filter((s) => !s.done).length;
    if (left && !confirm(`아직 안 끝난 세부 작업이 ${left}건 있습니다.\n그래도 '${t.name}' 업무를 완료로 바꿀까요? (세부 작업은 그대로 남습니다)`)) return;
    mut.setProgress.mutate({ id: t.id, pct: 100, why: 'TASK 완료 처리' });
    setMsg(`완료 — 실적 100%. 잘못 눌렀으면 [완료 취소]로 되돌릴 수 있습니다`);
  };
  const undo = () => {
    if (!info) return;
    const prev = undoPct(info);
    if (!confirm(`'${t.name}' 완료를 취소할까요?\n진행률을 ${prev}%로 되돌립니다.`)) return;
    mut.setProgress.mutate({ id: t.id, pct: prev, why: 'TASK 완료 취소' });
    setMsg(`완료를 취소했습니다 — 진행률 ${prev}%`);
  };
  const doneTxt = !info ? '' : info.date ? `${monthDay(info.date)} ${people.nameOf(info.by) || ''} 완료` : '엑셀 업무 목록에서 완료로 들어옴';

  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={
        <span className="flex items-center gap-2">
          <ProjectTag>{shortOf(t.projectId)}</ProjectTag>
          <span>업무 {t.code}</span>
          {t.milestone && <b className="text-amber">◆</b>}
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button onClick={onEdit}>✏ 수정</Button>
          <span className="flex-1" />
          <Button onClick={onClose}>닫기</Button>
          {!done && <Button variant="accent" onClick={complete} title="세부 작업 하나가 아니라 이 업무 전체가 끝났을 때 누르세요 — 실적 100% · 완료로 바뀝니다">✓ TASK 전체 완료</Button>}
          {tk
            ? <Button variant="primary" onClick={() => onOpenTicket(tk.no)}>티켓 {tk.no} 열기</Button>
            : !done && <Button variant="primary" onClick={() => onIssue(t.id)}>🎫 티켓 발행</Button>}
        </div>
      }
    >
      <div className="mb-3 text-[15px] font-bold text-ink">{t.name}</div>
      {msg && <div className="mb-3 rounded-lg bg-teal-soft px-3 py-1.5 text-[11.5px] text-ink2">{msg}</div>}
      <table className="w-full">
        <tbody>
          <Row h="사업">{p?.company ?? t.projectId} · {t.stage}{t.group && t.group !== t.stage ? ` · ${t.group}` : ''}</Row>
          {t.memo && (
            <Row h="할 일">
              <div className="whitespace-pre-line leading-relaxed">
                {t.memo.split('\n').map((line, i) => {
                  const m = line.match(/^(신규|변경|재사용)\s+(.*)$/);
                  return <div key={i}>{m ? <><b>{m[1]}</b> {m[2]}</> : line}</div>;
                })}
              </div>
            </Row>
          )}
          {(t.info || t.md) && <Row h="공수">{t.md ? <b className="mr-2">{t.md} MD</b> : null}<span className="text-[11.5px] text-ink3">{t.info}</span></Row>}
          {fns.length > 0 && (
            <Row h={`세부 기능 ${fns.length}`}>
              <div className="max-h-[220px] overflow-auto">
                {fns.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5 text-[11.5px]">
                    <Tag tone={f.kind === '신규' ? 'run' : f.kind === '변경' ? 'warn' : 'plain'}>{f.kind}</Tag>
                    <span>{f.name}{f.note && <span className="text-ink3"> ({f.note})</span>}</span>
                  </div>
                ))}
              </div>
            </Row>
          )}
          {t.output && <Row h="산출물">{t.output}</Row>}
          <Row h="담당">
            {t.assigneeIds.length ? (
              <span className="flex flex-wrap gap-2">
                {t.assigneeIds.map((a, i) => (
                  <span key={a}>{people.labelOf(a)} <Tag tone={i === 0 || !t.subAssigneeIds.includes(a) ? 'run' : 'plain'}>{i === 0 || !t.subAssigneeIds.includes(a) ? '정' : '부'}</Tag></span>
                ))}
              </span>
            ) : (
              <Tag tone="bad">지정 필요</Tag>
            )}
            {t.execMemo && <span className="ml-2 text-[11px] text-ink3">기타 실행 주체: {t.execMemo}</span>}
          </Row>
          <Row h="PM">{t.pmName || '-'}</Row>
          <Row h="기간">
            <span className={isLate(t, l, today) ? 'font-bold text-danger' : ''}>{t.start || t.end ? `${t.start || '-'} ~ ${t.end || '-'}` : '일정 없음'}</span>
            {t.end && !done && <span className="ml-1 text-[11px] text-ink3">({leftText(t.end, today)})</span>}
          </Row>
          <Row h="상태">
            <Tag tone={done ? 'ok' : isLate(t, l, today) ? 'bad' : l.status === '진행중' ? 'run' : 'plain'}>{isLate(t, l, today) ? '지연' : l.status}</Tag>
            <span className="ml-2 text-[11.5px]">진행률 {Math.round(l.pct)}%</span>
            {done && <span className="ml-2 text-[11px] text-ink3">· {doneTxt}</span>}
            {done && <Button size="sm" onClick={undo} title="잘못 완료했을 때 — 완료 전 진행률로 되돌립니다">완료 취소</Button>}
            {!done && <ProgressQuick pct={l.pct} onSet={(v) => mut.setProgress.mutate({ id: t.id, pct: v, why: '업무 상세에서 기록' })} />}
          </Row>
          {preds.length > 0 && <Row h="선행 업무">{preds.map((x) => <div key={x!.id}>{x!.code} {x!.name}{isDone(d.liveMap.get(x!.id) ?? liveOf(x!)) ? ' ✓' : ''}</div>)}</Row>}
          <Row h="티켓">
            {tk ? (
              <button type="button" className="inline-flex items-center gap-1.5 font-bold text-teal" onClick={() => onOpenTicket(tk.no)}>
                <StatusTag s={tk.status} /> {tk.no} · 담당 {people.nameOf(tk.assigneeId) || '없음'} · 진행 {tk.prog}%
              </button>
            ) : (
              <span className="text-ink3">미발행{done ? '' : ' — 아래 [티켓 발행]으로 담당자에게 넘깁니다'}</span>
            )}
          </Row>
        </tbody>
      </table>
      <SubtaskBox taskId={t.id} d={d} people={people} mut={mut} onMsg={setMsg} taskName={t.name} taskDone={done} onOpenTicket={onOpenTicket} />
    </Modal>
  );
}

function Row({ h, children }: { h: string; children: ReactNode }) {
  return (
    <tr className="border-t border-border align-top">
      <th className="w-[100px] whitespace-nowrap py-2 pr-3 text-left text-[11.5px] font-bold text-ink3">{h}</th>
      <td className="py-2 text-[12px] text-ink">{children}</td>
    </tr>
  );
}

/** 진행률 빠른 기록 */
function ProgressQuick({ pct, onSet }: { pct: number; onSet: (v: number) => void }) {
  const [v, setV] = useState(String(pct));
  return (
    <span className="ml-2 inline-flex items-center gap-1">
      <input type="number" min={0} max={100} className="w-16 rounded border border-border-hi px-1.5 py-0.5 text-[12px]" value={v} onChange={(e) => setV(e.target.value)} aria-label="진행률" />
      <Button size="sm" onClick={() => { const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0))); onSet(n); }}>진행률 기록</Button>
    </span>
  );
}

/**
 * 세부 작업 (subBox 5336): 추가·체크·담당·기한·삭제·메모 + 세부 작업 티켓(줄마다 [발행] / 티켓 번호, 미발행 모두 발행, 추가하면서 발행).
 * 다 끝내도 자동 완료 안 함 — 안내만 (subSync). 업무 상세 창과 티켓 창이 같이 쓴다.
 */
export function SubtaskBox({ taskId, d, people, mut, onMsg, taskName, taskDone, onOpenTicket }: {
  taskId: string;
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  onMsg: (m: string) => void;
  taskName: string;
  taskDone: boolean;
  onOpenTicket: (no: string) => void;
}) {
  const subs = d.subsByTask.get(taskId) ?? [];
  const task = d.taskMap.get(taskId);
  const [txt, setTxt] = useState('');
  const [who, setWho] = useState(people.me);
  const [due, setDue] = useState('');
  const [withTk, setWithTk] = useState(false);
  const [memoOpen, setMemoOpen] = useState<string | null>(null);
  const tks = d.snap.tickets;
  const tkOf = (sid: string) => subTicketOf(tks, sid);
  const issue = async (list: PmSubtask[]) => {
    if (!task) return [];
    const ctx = { today: d.today, me: people.me, approverOf: (t: PmTask) => people.idByName(t.pmName), nameOf: people.nameOf };
    return mut.issueTickets.mutateAsync(list.map((s) => makeSubTicket('P0-0000', task, s, ctx)));
  };
  const issueOne = async (s: PmSubtask) => {
    if (!s.assigneeId) { onMsg('세부 작업 담당자가 없습니다 — 담당을 먼저 고르세요'); return; }
    try { const [x] = await issue([s]); onMsg(`${x.no} 발행 — ${people.nameOf(s.assigneeId)}`); } catch (e) { onMsg(e instanceof Error ? e.message : String(e)); }
  };
  const left = subs.filter((s) => !s.done && !tkOf(s.id));
  const issueAll = async () => {
    const list = left.filter((s) => s.assigneeId);
    if (!list.length) { onMsg('담당이 지정된 세부 작업이 없습니다. 각 줄에서 [담당 지정] 후 발행하세요'); return; }
    const noWho = left.length - list.length;
    if (!confirm(`세부 작업 ${list.length}건을 각각 티켓으로 발행할까요?${noWho ? `\n(담당 없는 ${noWho}건은 빼고 발행)` : ''}`)) return;
    const made = await issue(list);
    onMsg(`세부 작업 티켓 ${made.length}건 발행`);
  };
  const add = async () => {
    const s = txt.trim();
    if (!s) return;
    if (withTk && !who) { onMsg('티켓을 같이 발행하려면 담당을 고르세요'); return; }
    const made = await mut.addSubtask.mutateAsync({ taskId, text: s, assigneeId: who, due });
    setTxt('');
    setDue('');
    if (withTk) await issueOne(made as PmSubtask);
  };
  const remove = async (id: string) => {
    try { await mut.removeSubtask.mutateAsync(id); } catch (e) { onMsg(e instanceof Error ? e.message : String(e)); }
  };
  const check = (id: string, done: boolean) => {
    mut.updateSubtask.mutate({ id, patch: { done } });
    if (done && !taskDone && subs.every((s) => s.id === id || s.done)) {
      onMsg(`세부 작업을 모두 끝냈습니다. '${taskName}' 전체가 끝났으면 [✓ TASK 전체 완료]를 눌러 주세요`);
    }
  };
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-1.5 flex items-center gap-2">
        <b className="text-[12.5px] text-ink">세부 작업</b>
        <span className="text-[11px] text-ink3">{subs.length ? `완료 ${subs.filter((s) => s.done).length}/${subs.length}` : '이 업무를 직접 잘게 나눠 적어 두면 업무계획에서 골라 쓸 수 있습니다'}</span>
        <span className="flex-1" />
        {left.length > 1 && <Button size="sm" onClick={issueAll}>🎫 미발행 {left.length}건 모두 발행</Button>}
      </div>
      {subs.map((s) => (
        <div key={s.id} className="border-b border-border/60 py-1.5">
          <div className="flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={s.done} onChange={(e) => check(s.id, e.target.checked)} aria-label="완료" />
            <span className={`min-w-0 flex-1 ${s.done ? 'text-ink3 line-through' : 'text-ink'}`}>{s.text}</span>
            {!s.assigneeId && !s.done ? (
              <select
                className="w-[110px] rounded border border-border-hi px-1 py-0.5 text-[11.5px]"
                value=""
                onChange={(e) => mut.updateSubtask.mutate({ id: s.id, patch: { assigneeId: e.target.value } })}
                title="담당을 정해야 티켓 발행 가능"
              >
                <option value="">담당 지정</option>
                {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            ) : (
              <span className="whitespace-nowrap text-[11px] text-ink3">
                {people.nameOf(s.assigneeId)}{s.due ? ` · ~${monthDay(s.due)}` : ''}{s.done && s.doneDate ? ` · ${monthDay(s.doneDate)} 완료` : ''}
              </span>
            )}
            {(() => {
              const x = tkOf(s.id);
              if (x) return <Button size="sm" onClick={() => onOpenTicket(x.no)} title="티켓 열기"><StatusTag s={x.status} /> {x.no}</Button>;
              return s.done ? null : <Button size="sm" onClick={() => issueOne(s)} title="이 세부 작업으로 티켓 발행">🎫 발행</Button>;
            })()}
            <Button size="sm" variant="ghost" onClick={() => setMemoOpen(memoOpen === s.id ? null : s.id)} title="메모">{s.memo ? '메모 있음' : '메모'}</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(s.id)} title="지우기">지우기</Button>
          </div>
          {memoOpen === s.id && (
            <textarea
              className="mt-1 w-full rounded border border-border-hi px-2 py-1 text-[11.5px]"
              defaultValue={s.memo}
              placeholder="메모"
              onBlur={(e) => { if (e.target.value !== s.memo) mut.updateSubtask.mutate({ id: s.id, patch: { memo: e.target.value } }); }}
            />
          )}
        </div>
      ))}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <input
          className="min-w-0 flex-[1_1_220px] rounded border border-border-hi px-2 py-1 text-[12px]"
          placeholder="세부 작업 입력 후 Enter — 예: 작업지시 화면 API 연결"
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void add(); } }}
        />
        <select className="w-[110px] rounded border border-border-hi px-1 py-1 text-[12px]" value={who} onChange={(e) => setWho(e.target.value)} title="담당">
          <option value="">담당 없음</option>
          {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input type="date" className="w-[132px] rounded border border-border-hi px-1 py-1 text-[12px]" value={due} onChange={(e) => setDue(e.target.value)} title="예정일 (선택)" />
        <label className="flex items-center gap-1 text-[11.5px]" title="추가하면서 담당자에게 티켓 발행"><input type="checkbox" checked={withTk} onChange={(e) => setWithTk(e.target.checked)} />🎫 티켓도 발행</label>
        <Button size="sm" variant="primary" onClick={add}>추가</Button>
      </div>
    </div>
  );
}
