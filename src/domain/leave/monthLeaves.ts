import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import { docLinkType } from '@/domain/approvalDoc/linkType';
import { calculateLeaveDays } from './policy';

export interface MonthLeave {
  doc: ApprovalDoc;
  startDate: string;
  endDate: string;
  leaveType: string;
  days: number;
}

/**
 * 한 달(YYYY-MM)에 걸친 승인 완료 휴가 — 웹 근태 '휴가 현황'·PWA 근태 관제 공용.
 * 휴가 문서는 연동 유형으로 알아본다(새로 만든 시트 서식이 연동 기능 '휴가'면 서식 코드가 달라도 휴가).
 * 달을 통째로 걸친 휴가(전달 시작·다음 달 끝)도 넣는다. 시작일 순.
 */
export function approvedLeavesInMonth(docs: readonly ApprovalDoc[], month: string): MonthLeave[] {
  const out: MonthLeave[] = [];
  for (const doc of docs) {
    if (doc.status !== '완료' || docLinkType(doc) !== '휴가' || !doc.form?.startDate) continue;
    const startDate = doc.form.startDate;
    const endDate = doc.form.endDate || startDate;
    if (startDate.slice(0, 7) > month || endDate.slice(0, 7) < month) continue;
    const leaveType = doc.form.leaveType || '연차';
    const days = calculateLeaveDays({ leaveType, startDate, endDate, rawDays: doc.form.days, title: doc.title });
    out.push({ doc, startDate, endDate, leaveType, days });
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
