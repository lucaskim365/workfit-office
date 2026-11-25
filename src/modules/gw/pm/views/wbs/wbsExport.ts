import { diffDays, liveOf, todayStr } from '@/domain/pm/rules';
import type { PmTask } from '@/domain/pm/schema';
import type { PmDerived } from '@/features/pm/usePm';

/**
 * 업무 목록 엑셀 내보내기 (wbsCsv 6602) — 엑셀에서 바로 열리는 CSV(UTF-8 BOM). 데모와 같은 열 + 묶음·공수.
 * 티켓 칸 = 그 업무의 티켓 (취소·세부 작업 티켓 제외).
 */
export function tasksCsv(tasks: readonly PmTask[], d: PmDerived, nameOf: (id: string) => string, shortOf: (id: string) => string): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['사업키', '사업', '사업구분', '도입기업', '단계', '묶음', '번호', '업무명', '산출물', 'PM', '담당', '기타 실행 주체', '시작일', '종료일', '기간(일)', 'M/S', '상태', '계획진행률', '실적진행률', '공수(MD)', '티켓번호', '티켓상태'];
  const rows = tasks.map((t) => {
    const p = d.snap.projects.find((x) => x.id === t.projectId);
    const l = d.liveMap.get(t.id) ?? liveOf(t);
    return [
      t.projectId, shortOf(t.projectId), p?.biz, p?.company, t.stage, t.group, t.code, t.name, t.output, t.pmName,
      t.assigneeIds.map(nameOf).join(' / '), t.execMemo, t.start, t.end, t.start && t.end ? diffDays(t.start, t.end) + 1 : '',
      t.milestone ? '◆' : '', l.status, `${t.planPct}%`, `${l.pct}%`, t.md ?? '', d.taskTicket.get(t.id)?.no ?? '', d.taskTicket.get(t.id)?.status ?? '',
    ];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}

export function exportTasksCsv(tasks: readonly PmTask[], d: PmDerived, nameOf: (id: string) => string, shortOf: (id: string) => string) {
  const csv = tasksCsv(tasks, d, nameOf, shortOf);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `업무목록_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
