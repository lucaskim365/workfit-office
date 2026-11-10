import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleChangeRepo, type ScheduleChangeActor } from '@/data/scheduleChange/scheduleChange.repo';
import { latestChangeByDoc, scheduleRangeText, type ScheduleChange, type ScheduleChangeInput } from '@/domain/scheduleChange/schema';
import type { StandardScheduleInfo } from '@/domain/approvalDoc/scheduleEngine';
import type { ApprovalDoc } from '@/domain/approvalDoc/schema';

const KEY = 'scheduleChanges';

/** 결재 완료 외근·출장 일정 변경 기록 전부 */
export function useScheduleChangeList() {
  return useQuery({ queryKey: [KEY], queryFn: () => scheduleChangeRepo.listAll(), staleTime: 60_000 });
}

/** 문서 id → 마지막 변경. 일정을 뽑는 곳(업무계획·캘린더·근태·재실)에 넘긴다 */
export function useScheduleChanges(): ReadonlyMap<string, ScheduleChange> {
  const { data } = useScheduleChangeList();
  return useMemo(() => latestChangeByDoc(data ?? []), [data]);
}

/**
 * 일정 바꾸기 — 기록을 남기고, 결재권자·동행자(남이 바꿨으면 기안자도)에게 알린다.
 * 알림이 실패해도 변경은 그대로 둔다.
 */
export function useChangeSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ actor, current, doc, input }: { actor: ScheduleChangeActor; current: StandardScheduleInfo; doc?: ApprovalDoc; input: ScheduleChangeInput }) => {
      const change = await scheduleChangeRepo.create(actor, current, input);
      try {
        const targets = new Set<string>([
          ...(doc?.steps ?? []).map((st) => st.approverId),
          ...(current.companionIds ?? []),
          current.drafterId,
        ]);
        targets.delete(actor.userId);
        if (targets.size) {
          const { notificationRepo } = await import('@/data/notification/notification.repo');
          const kind = current.category === 'TRIP' ? '출장' : '외근';
          const text = `[${current.docTitle}] ${kind} 일정이 ${scheduleRangeText(change.prevStartDate, change.prevEndDate, change.prevStartTime, change.prevEndTime)} → ${scheduleRangeText(change.startDate, change.endDate, change.startTime, change.endTime)}(으)로 바뀌었습니다. 사유: ${change.reason}`;
          await Promise.all(
            [...targets].map((userId) =>
              notificationRepo.create({ userId, type: '일정', title: `${kind} 일정 변경`, text, senderName: actor.name, linkUrl: `/gw/approval?doc=${current.docId}` }),
            ),
          );
        }
      } catch (e) {
        console.error('일정 변경 알림 전송 실패:', e);
      }
      return change;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
