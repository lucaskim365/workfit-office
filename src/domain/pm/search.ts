import { diffDays, isDone, liveOf, monthDay, taskPeople, type Live } from './rules';
import type { PmAction, PmChangeRequest, PmIssue, PmProject, PmTask } from './schema';
import type { PmTicket } from './ticket';
import type { AlertGo } from './alerts';

/**
 * 전체 검색 (위쪽 검색칸 · Ctrl+K, 데모 GS_DO · gsFind 8181~) — 하는 일 · 화면 · 사업 · 업무 · 티켓 · 이슈 · 액션 아이템 · 사람.
 * 누르면 그 자리로. 요구사항(CR)은 4단계, 회의록은 5단계에서 더한다.
 */
export type SearchGo = AlertGo;
export interface SearchHit { grp: string; label: string; sub: string; go: SearchGo }

const v = (id: string, params?: Record<string, string>): SearchGo => ({ kind: 'view', v: id, ...(params ? { params } : {}) });
/** 하는 일 (메뉴 길잡이) — [이름, 찾는 말, 갈 곳] */
export const GS_DO: ReadonlyArray<readonly [string, string, SearchGo]> = [
  ['사업 등록', '새 사업 수주 신규 등록 추가', v('master/base')],
  ['진행률 입력', '진행률 갱신 실적 입력 업데이트 퍼센트', v('dash/my')],
  ['오늘 할 일 · 일일 업무 보고', '업무계획 오늘 할일 일일보고 PDF 업무 보고', v('dash/plan')],
  ['티켓 발행 (업무 맡기기)', '업무 배정 맡기기 티켓 발행 지시', v('task/wbs')],
  ['TASK 추가 · 일정 수정', 'WBS 업무 추가 일정 수정 기간 변경', v('task/wbs')],
  ['점검 결과 기록 (중간점검 · 감리)', '점검 결과 판정 보완 중간점검 감리 최종평가', v('doc/insp')],
  ['협약변경 기록', '협약변경 기간 연장 변경 기록', v('dash/site')],
  ['사업계획서 등록', '계획서 PDF 기능 목록 성과지표 등록', v('dash/site')],
  ['주간 특이사항 · 주간 보고서', '주간 보고 보고서 특이사항 협조 요청 진행률 갱신', v('doc/check')],
  ['이슈 등록', '이슈 문제 장애 등록', v('risk/issue', { issue: 'new' })],
  ['회의록 작성', '회의 회의록 액션 아이템', v('doc/meet')],
  ['산출물 제출', '산출물 제출 문서 파일 감리', v('doc/audit')],
  ['팀원 업무량 보기', '팀 현황 업무량 부하 누가 바쁜지', v('dash/team')],
  ['지난 기한 정리', '지난 기한 미완료 정리 완료 처리', v('dash/overview', { pop: 'past' })],
  ['활동 기록 (누가 언제 무엇을)', '로그 기록 이력 변경 이력 활동', v('master/log')],
  ['지난 업무 기록 · 과제 수행일지', '수행일지 일지 업무 기록 인건비 증빙 지난 기록', v('doc/log')],
  ['성과지표 실측 기록', '성과지표 KPI 실측 달성도 최종평가 목표', v('site/kpi')],
  ['견적 작성 · 엑셀 내보내기', '견적 견적서 작성 엑셀 내보내기 매출 매입 이익 이익률 수익 계약 품목', v('money/site')],
  ['원가 변경 · 대금 일정', '원가 변경 비용 매입 대금 선급 잔금 세금계산서 입금', v('money/site')],
  ['월별 · 연간 손익 · 간접비', '손익 월별 연간 순수익 간접비 예상 매출', v('money/pl')],
  ['지원 기준 · 단가', '지원금 정부 지방비 도비 시군비 자부담 현물 클라우드 단가 KOSA', v('money/rules')],
  ['품목 · 단가 (장비 · 소프트웨어 목록)', '품목 장비 단가 매입 협력사 키오스크 바코드 PDA 엣지 현황판 목록', v('money/items')],
];

export interface SearchInputs {
  today: string;
  /** 화면 [보기 id, 이름, 메뉴 이름] — 탭에 보이는 것만 (menuList) */
  screens: ReadonlyArray<readonly [string, string, string]>;
  projects: readonly PmProject[];
  tasks: readonly PmTask[];
  liveMap: ReadonlyMap<string, Live>;
  tickets: readonly PmTicket[];
  issues: readonly PmIssue[];
  actions: readonly PmAction[];
  /** 요구사항 변경 (4단계) */
  crs?: readonly PmChangeRequest[];
  people: ReadonlyArray<{ id: string; name: string; label: string; dept: string; position: string }>;
  shortOf: (projectId: string) => string;
  nameOf: (id: string) => string;
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function gsFind(q0: string, X: SearchInputs): SearchHit[] {
  const q = q0.trim().toLowerCase();
  if (!q) return [];
  const hit = (s: string | undefined | null) => String(s ?? '').toLowerCase().includes(q);
  const R: SearchHit[] = [];
  const push = (grp: string, label: string, sub: string, go: SearchGo, max: number) => { if (R.filter((x) => x.grp === grp).length < max) R.push({ grp, label, sub, go }); };
  const L = (t: PmTask) => X.liveMap.get(t.id) ?? liveOf(t);
  const fin = (t: PmTask) => isDone(L(t));

  for (const [l, kw, go] of GS_DO) if (hit(l) || hit(kw) || q.split(/\s+/).every((w) => `${l} ${kw}`.toLowerCase().includes(w))) push('하는 일', l, '바로 가기', go, 6);
  for (const [id, nm, menu] of X.screens) if (hit(nm) || hit(menu)) push('화면', nm, menu, v(id), 6);
  for (const p of X.projects) if (hit(p.company) || hit(X.shortOf(p.id)) || hit(p.bizNo) || hit(p.biz)) push('사업', `${X.shortOf(p.id)} · ${p.company}`, `${p.biz || ''} · PM ${p.pmName.split(/[\s/,]+/)[0] || X.nameOf(p.pmUserId) || '-'}`, v('dash/site', { k: p.id }), 6);
  // 업무: 이름 · 산출물 · 번호 · 묶음에 맞는 것을 안 끝난 것 · 마감 가까운 순으로. 8건 넘으면 '모두 보기' 한 줄
  const tHit = X.tasks.filter((t) => !/^\[FP\]/.test(t.name) && (hit(t.name) || hit(t.output) || hit(t.code) || hit(t.group)))
    .sort((a, b) => (Number(fin(a)) - Number(fin(b))) || ((a.end || '9') < (b.end || '9') ? -1 : (a.end || '9') > (b.end || '9') ? 1 : 0));
  for (const t of tHit) {
    const who = taskPeople(t).slice(0, 2).map(X.nameOf).join(', ') || '담당 미지정';
    const when = fin(t) ? ' · 완료' : t.end ? (t.end < X.today ? ` · ${diffDays(t.end, X.today)}일 지남` : ` · ~${monthDay(t.end)}`) : '';
    push('업무', t.name, `${X.shortOf(t.projectId)} ${t.code} · ${who}${when}`, { kind: 'task', id: t.id }, 8);
  }
  if (tHit.length > 8) push('업무', `'${q0.trim()}' 업무 ${tHit.length}건 모두 보기`, '업무 목록에서 검색', v('task/wbs', { q: q0.trim(), st: 'all' }), 9);
  for (const p of X.projects) if (hit(X.shortOf(p.id)) || hit(p.company)) {
    const n = X.tasks.filter((t) => t.projectId === p.id && !/^\[FP\]/.test(t.name) && !fin(t)).length;
    push('업무 목록', `${X.shortOf(p.id)} 업무 목록 보기`, `안 끝난 업무 ${n}건`, v('task/wbs', { k: p.id, period: 'now' }), 12);
  }
  for (const x of X.tickets) if (hit(x.no) || hit(x.title)) push('티켓', `${x.no} ${x.title}`, `${X.shortOf(x.projectId)} · ${x.status} · ${X.nameOf(x.assigneeId) || '담당 없음'}`, { kind: 'ticket', no: x.no }, 5);
  for (const i of X.issues) if (hit(i.id) || hit(i.title)) push('이슈', `${i.id} ${i.title}`, `${i.sev} · ${i.status}`, v('risk/issue', { issue: i.id }), 5);
  for (const a of X.actions) if (hit(a.text)) push('액션 아이템', a.text, `${X.nameOf(a.whoId) || '담당 없음'}${a.due ? ` · ~${monthDay(a.due)}` : ''}${a.done ? ' · 완료' : ''}`, v('doc/meet'), 5);
  for (const c of X.crs ?? []) if (hit(c.id) || hit(c.title)) push('CR', `${c.id} ${c.title}`, c.status, v('site/cr', { cr: c.id }), 5);
  for (const u of X.people) if (hit(u.name) || hit(u.dept)) push('사람', u.label, `${u.dept || u.position || ''} · 누르면 이 사람의 진행 중 업무`, v('task/wbs', { who: u.id, period: 'now' }), 5);
  return R.map((x) => ({ ...x, label: trunc(x.label, 60), sub: trunc(x.sub, 60) }));
}
