import { useEffect, useState, type ReactNode } from 'react';
import { usePmSiteMutations, type PmDerived, type usePmMutations } from '@/features/pm/usePm';
import { usePmAccess } from '@/features/pm/usePmAccess';
import { SiteFormModal } from '../master/SiteFormModal';
import type { usePmPeople } from '../../usePmPeople';
import { TaskDetailModal } from '../wbs/TaskDetailModal';
import { IssueModal } from './IssueModal';
import { TicketDetailModal } from './TicketDetailModal';
import { IssueFormModal } from '../issue/IssueFormModal';

/**
 * 업무 상세 · 티켓 발행 · 티켓 상세 창을 한곳에서 — 업무 목록·간트·일정 변동·티켓 목록이 같이 쓴다.
 * 업무 창에서 [티켓 발행] → 발행 창, 티켓 번호 → 티켓 창, 티켓 창의 업무 이름 → 업무 창.
 * 이슈 등록 · 수정 창(5단계) · 사업 등록 · 정보 수정 창(6단계)도 여기 — 여러 화면에서 그 자리에서 엶 (데모 issueNew · issueEdit · asAdd · siteNew · siteEdit).
 */
export function usePmModals({ d, people, mut, shortOf, onEditTask, onIssued }: {
  d: PmDerived | null;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  /** 업무 창 [수정] (업무 목록만) */
  onEditTask?: (id: string) => void;
  onIssued?: () => void;
}): { openTask: (id: string) => void; openTicket: (no: string) => void; issue: (ids: string[]) => void; openIssue: (id: string | null, site?: string) => void; openSite: (id: string | null, presetTpl?: string) => void; node: ReactNode } {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState<string | null>(null);
  const [issueIds, setIssueIds] = useState<string[] | null>(null);
  /** 이슈 창: id = 수정, null = 새로 (site = 미리 고를 사업) */
  const [iss, setIss] = useState<{ id: string | null; site: string } | null>(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3500); return () => clearTimeout(t); }, [msg]);
  /** 사업 창: id = 수정, null = 새로 등록 (presetTpl = 템플릿으로 새 사업) */
  const [siteF, setSiteF] = useState<{ id: string | null; tpl?: string } | null>(null);
  const smut = usePmSiteMutations(people.me);
  const access = usePmAccess();
  const openSite = (id: string | null, presetTpl?: string) => { setTaskId(null); setTicketNo(null); setSiteF({ id, tpl: presetTpl }); };
  const openIssue = (id: string | null, site = '') => { setTaskId(null); setTicketNo(null); setIss({ id, site }); };
  const openTask = (id: string) => { setTicketNo(null); setTaskId(id); };
  const openTicket = (no: string) => { setTaskId(null); setTicketNo(no); };
  const issue = (ids: string[]) => { setTaskId(null); setIssueIds(ids); };
  const node = d && (
    <>
      {taskId && (
        <TaskDetailModal
          id={taskId}
          d={d}
          people={people}
          mut={mut}
          shortOf={shortOf}
          onClose={() => setTaskId(null)}
          onEdit={() => { const id = taskId; setTaskId(null); onEditTask?.(id); }}
          onIssue={(id) => issue([id])}
          onOpenTicket={openTicket}
        />
      )}
      {ticketNo && (
        <TicketDetailModal no={ticketNo} d={d} people={people} mut={mut} onClose={() => setTicketNo(null)} onOpenTicket={openTicket} onOpenTask={openTask} />
      )}
      {iss && (iss.id === null || d.snap.issues.some((x) => x.id === iss.id)) && (
        <IssueFormModal issue={iss.id ? d.snap.issues.find((x) => x.id === iss.id)! : null} site={iss.site} d={d} people={people} mut={mut} shortOf={shortOf}
          onDone={setMsg} onClose={() => setIss(null)} />
      )}
      {siteF && (siteF.id === null || d.snap.projects.some((x) => x.id === siteF.id)) && (
        <SiteFormModal s={siteF.id ? d.snap.projects.find((x) => x.id === siteF.id)! : null} presetTpl={siteF.tpl} d={d} people={people} mut={mut} smut={smut} money={access.money} shortOf={shortOf}
          onDone={setMsg} onClose={() => setSiteF(null)} />
      )}
      {msg && <div role="status" className="fixed bottom-6 right-6 z-[60] rounded-lg bg-navy px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg">{msg}</div>}
      {issueIds && <IssueModal ids={issueIds} d={d} people={people} mut={mut} shortOf={shortOf} onClose={() => setIssueIds(null)} onIssued={() => onIssued?.()} />}
    </>
  );
  return { openTask, openTicket, issue, openIssue, openSite, node };
}
