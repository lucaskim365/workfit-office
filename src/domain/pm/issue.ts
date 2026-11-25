import { diffDays } from './rules';
import type { PmIssue } from './schema';

/**
 * 이슈 — 이슈 · 회의 · 보고 › 이슈 (데모 pRisk 4188 · issueForm 3182 · esc 5938).
 * 처리 흐름 보드: 열림 → 대응 중 → 해결. 위 분류 칸은 눌러서 거르기.
 */
export const ISSUE_CATS = ['설비 통신 장애', '네트워크 단절', '현장 협조 지연', '코드 버그', '설비업체 데이터 지연', '데이터 품질', '요구사항 변경', '기타'] as const;
/** 위 분류 칸 4개 (pRisk CATS) — 나머지는 '기타'로 거름 */
export const ISSUE_TILES = ['설비 통신 장애', '현장 협조 지연', '코드 버그', '데이터 품질'] as const;
export const ISSUE_FORM_SEVS = ['긴급', '높음', '보통'] as const;
export const ISSUE_STATES = ['열림', '대응중', '해결'] as const;

export const issueOpen = (i: PmIssue) => i.status !== '해결';
/** 열린 지 며칠 (age) */
export const issueAge = (i: PmIssue, today: string) => (i.date ? diffDays(i.date, today) : 0);
const SEV: Record<string, number> = { 긴급: 0, 높음: 1, 보통: 2, 낮음: 3 };

export type IssueLane = '열림' | '대응중' | '해결';
export interface IssueBoard {
  lanes: Record<IssueLane, PmIssue[]>;
  /** 사업으로 거른 미해결 · 긴급/높음 · 7일 넘음 */
  nOpen: number;
  nHot: number;
  nOld: number;
  /** 분류 칸 숫자 (미해결) */
  tile: Record<string, number>;
}
/** 보드 (pRisk) — site 'all' · cat 'all' | 분류 | '기타'(칸 4개 밖) */
export function issueBoard(all: readonly PmIssue[], site: string, cat: string, today: string): IssueBoard {
  const inSite = all.filter((i) => site === 'all' || i.projectId === site);
  const list = inSite.filter((i) => cat === 'all' || i.cat === cat || (cat === '기타' && !(ISSUE_TILES as readonly string[]).includes(i.cat)));
  const age = (i: PmIssue) => issueAge(i, today);
  const srt = (x: PmIssue, y: PmIssue) => (SEV[x.sev] ?? 2) - (SEV[y.sev] ?? 2) || age(y) - age(x);
  const lanes: Record<IssueLane, PmIssue[]> = {
    열림: list.filter((i) => i.status !== '해결' && i.status !== '대응중').sort(srt),
    대응중: list.filter((i) => i.status === '대응중').sort(srt),
    해결: list.filter((i) => i.status === '해결').sort((x, y) => ((y.date || '') < (x.date || '') ? -1 : (y.date || '') > (x.date || '') ? 1 : 0)),
  };
  const open = inSite.filter(issueOpen);
  const tile: Record<string, number> = { all: open.length };
  for (const c of ISSUE_TILES) tile[c] = open.filter((i) => i.cat === c).length;
  return { lanes, nOpen: open.length, nHot: open.filter((i) => i.sev === '긴급' || i.sev === '높음').length, nOld: open.filter((i) => age(i) >= 7).length, tile };
}

/** 다음 번호 I-001 */
export function nextIssueId(list: readonly PmIssue[]): string {
  const n = list.reduce((a, x) => Math.max(a, +x.id.split('-')[1] || 0), 0) + 1;
  return `I-${String(n).padStart(3, '0')}`;
}
/** 입력 확인 (issueForm validate) */
export function issueCheck(v: { title: string; ownerId: string; date: string; status: string; action: string; projectId: string }): [string, string] | null {
  if (!v.projectId) return ['사업을 골라 주세요', 'projectId'];
  if (!v.title.trim()) return ['이슈 제목을 입력해 주세요', 'title'];
  if (!v.ownerId) return ['대응 담당자를 골라 주세요', 'ownerId'];
  if (!v.date) return ['발생일을 입력해 주세요', 'date'];
  if (v.status === '해결' && !v.action.trim()) return ['해결 처리 시 조치 내용을 입력해야 합니다', 'action'];
  return null;
}
