import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { diffDays, monthDay } from '@/domain/pm/rules';
import { dlEff, SIDE_TEXT, type Deadline } from '@/domain/pm/site';
import type { PmTask } from '@/domain/pm/schema';
import type { PmDerived, PmSiteRow } from '@/features/pm/usePm';
import { DueCell, EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { DeadlineRow } from './parts';

/**
 * 대시보드 팝업 — 숫자를 누르면 그 항목 목록 (사용자 규칙 0.1-2).
 */

/** 기한 목록 팝업 — 2주 안 기한 · 도입기업 챙길 일 (사업별로 묶음) */
export function DeadlineListModal({ title, hint, groups, today, shortOf, onOpenSite, onClose }: {
  title: string;
  hint: string;
  groups: Array<{ projectId: string; L: Deadline[] }>;
  today: string;
  shortOf: (id: string) => string;
  onOpenSite: (projectId: string) => void;
  onClose: () => void;
}) {
  const total = groups.reduce((a, g) => a + g.L.length, 0);
  return (
    <Modal open onClose={onClose} width={900} title={`${title} — ${total}건`} footer={<><span className="flex-1 text-[11px] text-ink3">{hint}</span><Button onClick={onClose}>닫기</Button></>}>
      {total ? (
        <div className="max-h-[60vh] overflow-auto">
          {groups.filter((g) => g.L.length).map((g) => (
            <div key={g.projectId} className="mb-3">
              <div className="mb-1 flex items-center gap-2">
                <ProjectTag>{shortOf(g.projectId)}</ProjectTag>
                <span className="text-[11px] text-ink3">{g.L.length}건</span>
                <span className="flex-1" />
                <Button size="sm" variant="secondary" onClick={() => onOpenSite(g.projectId)}>이 사업 화면에서 처리 ›</Button>
              </div>
              {g.L.map((x) => <DeadlineRow key={`${x.src}${x.id ?? x.taskId}`} x={x} today={today} />)}
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint title="해당하는 기한이 없습니다" hint={hint} />
      )}
    </Modal>
  );
}

/** 지난 기한 정리 (pastModal) — 체크로 끝나는 것(관리기준 서류 · 계획서 약속)만 여기서 한 번에 완료 처리 */
export function PastModal({ rows, only, today, shortOf, onDone, onOpenTask, onOpenSite, onClose }: {
  rows: PmSiteRow[];
  /** 사업 하나만 (없으면 전체) */
  only?: string;
  today: string;
  shortOf: (id: string) => string;
  onDone: (items: Array<{ projectId: string; kind: 'gov' | 'plan'; id: string }>, date: string) => Promise<void>;
  onOpenTask: (id: string) => void;
  onOpenSite: (projectId: string) => void;
  onClose: () => void;
}) {
  const groups = rows.filter((r) => !only || r.p.id === only).map((r) => ({ k: r.p.id, L: r.b.past })).filter((g) => g.L.length);
  const total = groups.reduce((a, g) => a + g.L.length, 0);
  const keyOf = (k: string, x: Deadline) => `${k}|${x.chk}|${x.id}`;
  const can = (x: Deadline) => !!x.chk && !(x.gov && 'autoCodes' in x.gov);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const toggle = (key: string) => setSel((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const all = (k: string, L: Deadline[]) => setSel((s) => { const n = new Set(s); L.filter(can).forEach((x) => n.add(keyOf(k, x))); return n; });
  const done = async () => {
    if (!sel.size) { setMsg({ t: '완료한 것을 체크하세요', bad: true }); return; }
    const items = [...sel].map((s) => { const [projectId, kind, id] = s.split('|'); return { projectId, kind: kind as 'gov' | 'plan', id }; });
    await onDone(items, date || today);
    setMsg({ t: `${items.length}건 완료 처리했습니다 (${monthDay(date || today)})` });
    setSel(new Set());
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={920}
      title={`지난 기한 정리 — ${only ? shortOf(only) : '전체 사업'} ${total}건`}
      footer={(
        <>
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink2">완료한 날
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-border px-1.5 py-0.5 text-[12px]" />
          </label>
          {msg && <span className={`text-[11.5px] font-bold ${msg.bad ? 'text-danger' : 'text-ok'}`}>{msg.t}</span>}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button onClick={() => void done()}>선택한 것 완료 처리</Button>
        </>
      )}
    >
      <div className="mb-3 rounded-lg border border-blue/20 bg-blue-soft px-3 py-2 text-[12px] text-ink2">
        이미 끝낸 일은 체크하고 <b>[선택한 것 완료 처리]</b>를 누르세요. 완료한 날을 알면 넣고, 모르면 오늘 날짜로 남습니다.
        <div className="text-[11px] text-ink3">마일스톤은 업무 목록에서 업무를 완료하면 목록에서 빠집니다. (점검 판정 [결과 기록]은 사업별 화면에서)</div>
      </div>
      {groups.length ? (
        <div className="max-h-[55vh] overflow-auto">
          {groups.map((g) => (
            <div key={g.k} className="mb-3">
              <div className="mb-1 flex items-center gap-2">
                <ProjectTag>{shortOf(g.k)}</ProjectTag>
                <span className="text-[11px] text-ink3">{g.L.length}건</span>
                <span className="flex-1" />
                <Button size="sm" variant="secondary" onClick={() => all(g.k, g.L)}>이 사업 체크할 수 있는 것 모두 선택</Button>
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  {g.L.map((x) => {
                    const key = keyOf(g.k, x);
                    return (
                      <tr key={key} className="border-t border-border">
                        <td className="w-6 py-1.5">{can(x) && <input type="checkbox" checked={sel.has(key)} onChange={() => toggle(key)} className="h-4 w-4" aria-label="완료로 선택" />}</td>
                        <td className="whitespace-nowrap pr-2"><Tag>{x.src}</Tag></td>
                        <td className="whitespace-nowrap pr-2 font-bold">{monthDay(x.due)}</td>
                        <td className="pr-2" title={`${x.t} — ${x.sub}`}>{x.t}{SIDE_TEXT[x.side] && <> <Tag tone={x.side === 'buyer' ? 'warn' : 'plain'}>{SIDE_TEXT[x.side]}</Tag></>}</td>
                        <td className="whitespace-nowrap pr-2 text-danger" title={x.inner ? `실제 기한 ${x.due} · 내부 마감 ${x.inner}` : ''}>{x.inner ? `내부 ${monthDay(x.inner)} · ` : ''}{diffDays(dlEff(x), today)}일 경과</td>
                        <td className="whitespace-nowrap text-right">
                          {!can(x) && x.taskId && <Button size="sm" variant="secondary" onClick={() => onOpenTask(x.taskId!)}>업무 보기</Button>}
                          {!can(x) && !x.taskId && <Button size="sm" variant="secondary" onClick={() => onOpenSite(g.k)}>사업 화면</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint title="지난 기한이 없습니다 👍" />
      )}
    </Modal>
  );
}

/** 업무 목록 팝업 — 지연 업무 (lateModal) · 오래 지난 마일스톤 (oldMsModal) */
export function TaskListModal({ title, hint, tasks, d, shortOf, extra, onOpenTask, footer, onClose }: {
  title: string;
  hint: string;
  tasks: PmTask[];
  d: PmDerived;
  shortOf: (id: string) => string;
  extra?: (t: PmTask) => ReactNode;
  onOpenTask: (id: string) => void;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const L = useMemo(() => [...tasks].sort((a, b) => (a.end < b.end ? -1 : 1)), [tasks]);
  return (
    <Modal open onClose={onClose} width={860} title={`${title} ${L.length}건`} footer={<><span className="flex-1 text-[11px] text-ink3">{hint}</span><Button variant="secondary" onClick={onClose}>닫기</Button>{footer}</>}>
      {L.length ? (
        <div className="max-h-[60vh] overflow-auto">
          {L.map((t) => {
            const l = d.liveMap.get(t.id)!;
            return (
              <button key={t.id} type="button" onClick={() => onOpenTask(t.id)} className="flex w-full items-center gap-2 border-b border-border py-2 text-left text-[12px] hover:bg-panel-alt">
                <ProjectTag>{shortOf(t.projectId)}</ProjectTag>
                <span className="w-[44px] flex-none text-ink3">{t.code}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{t.milestone ? '◆ ' : ''}{t.name}</span>
                {extra?.(t)}
                <span className="text-[11px] text-ink3">{l.status} · {l.pct}%</span>
                <DueCell t={t} l={l} today={d.today} />
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyHint title="해당하는 업무가 없습니다" hint={hint} />
      )}
    </Modal>
  );
}
