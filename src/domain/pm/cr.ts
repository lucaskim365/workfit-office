import { addDays, diffDays } from './rules';
import type { PmChangeRequest, PmTask } from './schema';

/**
 * 요구사항(CR) — 점검 · 요구사항 · 산출물 › 요구사항(CR) (데모 siteCR 3616 · crForm 3044 · crReview 3076 · crToWbs 3096).
 * 현장 요구사항을 접수(검토중) → PM이 일정 · 비용 영향을 보고 승인 · 반려 → 승인하면 업무로 추가.
 */

/** 다음 번호 CR-001 (crForm onSubmit) — 지금까지 가장 큰 번호 + 1 */
export function nextCrId(list: readonly PmChangeRequest[]): string {
  const n = list.reduce((a, x) => Math.max(a, +x.id.split('-')[1] || 0), 0) + 1;
  return `CR-${String(n).padStart(3, '0')}`;
}

export type CrSt = 'all' | PmChangeRequest['status'];
/** 변경 장부 (siteCR list) — 사업 · 상태로 거르고 요청일 최근 순 */
export function crList(list: readonly PmChangeRequest[], site: string, st: CrSt): PmChangeRequest[] {
  return list.filter((c) => (site === 'all' || c.projectId === site) && (st === 'all' || c.status === st))
    .sort((x, y) => ((y.date || '') < (x.date || '') ? -1 : (y.date || '') > (x.date || '') ? 1 : 0));
}

/** 위 흐름 칸 · 누적 영향 (siteCR flow) — 사업 · 상태 거르기와 상관없이 전체 */
export function crFlow(list: readonly PmChangeRequest[]) {
  const ok = list.filter((c) => c.status === '승인');
  return {
    n: { 검토중: list.filter((c) => c.status === '검토중').length, 승인: ok.length, 반려: list.filter((c) => c.status === '반려').length },
    days: ok.reduce((a, c) => a + (+c.days || 0), 0),
    cost: ok.reduce((a, c) => a + (+c.cost || 0), 0),
    /** 승인했는데 아직 업무로 안 넣은 것 */
    noTask: ok.filter((c) => !c.taskId).length,
  };
}

/** 다음 마일스톤과 일정 충돌 위험 (crForm · crReview) — 남은 날 − 일정 영향 < 7 */
export const crConflict = (m: PmTask | null, days: number, today: string) => !!m && !!m.end && diffDays(today, m.end) - (+days || 0) < 7;

/** 승인 → 업무 추가 창에 미리 채울 값 (crToWbs) — 종료 = 오늘 + 일정 영향(없으면 7일, 최소 1일) */
export function crTaskPreset(c: PmChangeRequest, today: string) {
  return { name: `[${c.id}] ${c.title}`, output: 'CR 반영 결과서', end: addDays(today, Math.max(1, +c.days || 7)) };
}
