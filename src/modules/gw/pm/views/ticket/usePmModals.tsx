import { useState, type ReactNode } from 'react';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { TaskDetailModal } from '../wbs/TaskDetailModal';
import { IssueModal } from './IssueModal';
import { TicketDetailModal } from './TicketDetailModal';

/**
 * 업무 상세 · 티켓 발행 · 티켓 상세 창을 한곳에서 — 업무 목록·간트·일정 변동·티켓 목록이 같이 쓴다.
 * 업무 창에서 [티켓 발행] → 발행 창, 티켓 번호 → 티켓 창, 티켓 창의 업무 이름 → 업무 창.
 */
export function usePmModals({ d, people, mut, shortOf, onEditTask, onIssued }: {
  d: PmDerived | null;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  /** 업무 창 [수정] (업무 목록만) */
  onEditTask?: (id: string) => void;
  onIssued?: () => void;
}): { openTask: (id: string) => void; openTicket: (no: string) => void; issue: (ids: string[]) => void; node: ReactNode } {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState<string | null>(null);
  const [issueIds, setIssueIds] = useState<string[] | null>(null);
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
      {issueIds && <IssueModal ids={issueIds} d={d} people={people} mut={mut} shortOf={shortOf} onClose={() => setIssueIds(null)} onIssued={() => onIssued?.()} />}
    </>
  );
  return { openTask, openTicket, issue, node };
}
