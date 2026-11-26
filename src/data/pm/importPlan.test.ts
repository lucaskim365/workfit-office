import assert from 'node:assert/strict';
import test from 'node:test';
import { bareName, buildImportPreview, matchUser, personKind, type DemoState, type GwUserLite } from './importPlan';

/** 1.5단계 미리보기 — 가짜 이름의 작은 state 로 규칙만 확인 (실제 state.json 은 저장소 밖) */
const USERS: GwUserLite[] = [
  { id: 'u1', name: '홍길동', dept: '개발팀', position: '과장', status: '사용' },
  { id: 'u2', name: '김동명', dept: '개발팀', position: '사원', status: '사용' },
  { id: 'u3', name: '김동명', dept: '영업팀', position: '사원', status: '사용' },
  { id: 'u4', name: '이퇴사', dept: '개발팀', position: '사원', status: '미사용', resignedAt: '2026-10-01' },
];

const STATE: DemoState = {
  users: [
    { id: '홍길동', name: '홍길동', role: '팀원', org: '개발팀' },
    { id: '김동명', name: '김동명', role: '팀원' },
    { id: '이퇴사', name: '이퇴사', role: '팀원' },
    { id: '박외부', name: '박외부', role: '도입기업 담당', org: '어느회사 (도입기업)' },
    { id: '최협력', name: '최협력', role: '협력사' },
  ],
  subs: {
    'P2|5.24': [{ id: 's1', txt: '예전 작업', who: '홍길동', done: true, d: '2026-10-29', dd: '2026-10-31', ddBy: '홍길동' }],
    'P2|01-01': [{ id: 's2', txt: '새 번호 작업', who: '홍길동' }],
    'P2|5.9': [],
  },
  tickets: [
    { no: 'P2-0001', key: 'P2|5.24', sub: 's1', k: 'P2', wbs: '5.24', title: '예전 작업', status: '완료', assignee: '홍길동', watchers: ['없는사람'] },
    { no: 'P2-0002', key: 'P2|01-01', sub: 'gone', k: 'P2', wbs: '01-01', title: '새 번호', status: '진행중', due: '2026/11/01' },
  ],
  baselines: { P2: { d: '2026-10-23', map: {} } },
  plan: { 홍길동: { '2026-11-02': [{}, {}] } },
  money: { rules: [] },
  weird: 1,
};

test('이름+직급 글자에서 이름만', () => {
  assert.equal(bareName('박명규 부장'), '박명규');
  assert.equal(bareName(''), '');
});

test('사람 구분: 도입기업 담당 / 협력사 / 내부', () => {
  assert.equal(personKind({ role: '도입기업 담당' }), '도입기업 담당');
  assert.equal(personKind({ role: '팀원', org: '저스템 (도입기업)' }), '도입기업 담당');
  assert.equal(personKind({ role: '협력사' }), '협력사');
  assert.equal(personKind({ role: 'PM' }), '내부');
});

test('짝짓기: 1명이면 찾음, 2명이면 동명이인(자동으로 안 고름), 미사용만 있으면 퇴사·미사용', () => {
  assert.equal(matchUser('홍길동', USERS).user?.id, 'u1');
  assert.equal(matchUser('김동명', USERS).match, '동명이인');
  assert.equal(matchUser('이퇴사', USERS).match, '퇴사·미사용');
  assert.equal(matchUser('없음', USERS).match, '없음');
});

test('미리보기: 예전 WBS 번호는 연결 끊김, 새 번호는 이어짐, 외부는 짝짓기 안 함', () => {
  const p = buildImportPreview(STATE, USERS, { links: { P2: 'a.pdf' }, files: ['a.pdf'] }, '2026-11-24');
  const broken = p.broken.map((b) => `${b.kind}:${b.id}`).sort();
  assert.deepEqual(broken, ['세부 작업:s1', '티켓:P2-0001']);
  assert.equal(p.people.find((x) => x.name === '홍길동')?.userId, 'u1');
  assert.equal(p.people.find((x) => x.name === '박외부')?.match, '안 함(이름 글자)');
  // 내장 데이터의 사업·업무 PM(실제 이름)도 데모 사용자 목록에서 찾으므로, 여기선 가짜 목록에 없는 이름이 잡히는지만
  assert.ok(p.unknownNames.includes('없는사람'));
  // 일부러 넣은 잘못된 날짜(P2-0002 due 2026/11/01)만 칸 오류로 잡힌다 (티켓은 안 옮기지만 기록으로) · 넣을 줄 1,441건은 모두 저장 계층이 읽음
  assert.deepEqual(p.schemaErrors.map((e) => e.split(':')[0]), ['(안 옮김) 티켓 P2-0002']);
  // 내장 데이터 건수 (1단계 확인 숫자와 같음)
  assert.equal(p.counts.find((c) => c.collection === 'pmTasks')?.count, 338);
  assert.equal(p.counts.find((c) => c.collection === 'pmProjects')?.count, 12);
  // 7-3: 23개 전부 · 합 1,441 = 설계 5.7.8 표 · 티켓 0 · 세부 작업 = FP 432 (state.json 세부 작업 안 옮김)
  assert.equal(p.counts.length, 23);
  assert.equal(p.counts.reduce((a, c) => a + c.count, 0), 1441);
  assert.deepEqual([p.counts.find((c) => c.collection === 'pmTickets')?.count, p.counts.find((c) => c.collection === 'pmSubtasks')?.count], [0, 432]);
  assert.equal(p.left.find((r) => r.key === 'money')?.when, '옮기지 않음');
  assert.equal(p.left.find((r) => r.key === 'tickets')?.when, '옮기지 않음');
  // 문제점: 빈 세부 작업 목록 · 없는 세부 작업에 묶인 티켓 · 날짜 형식 · 짝 없는 내부 직원 · PDF 없음
  const all = p.problems.join('\n');
  assert.match(all, /P2\|5\.9/);
  assert.match(all, /P2-0002: 묶인 세부 작업\(gone\)/);
  assert.match(all, /P2-0002: due 날짜 형식 아님/);
  assert.match(all, /김동명\(동명이인\)/);
  assert.match(all, /계획서 PDF 없음/);
  // 분류 안 된 칸은 '확인 필요'로 드러난다
  assert.equal(p.left.find((r) => r.key === 'weird')?.when, '?');
  assert.equal(p.left.find((r) => r.key === 'plan')?.when, '옮기지 않음');
});

test('7-3 미리보기: state.json 에만 있는 사람이 넣은 기준정보(자동 아님)는 따로 목록 · 사업 PM → 사용자 ID', () => {
  const p = buildImportPreview({ ...STATE, orgs: [{ id: 'o:도입기업:손으로', name: '손으로', auto: 0 }, { id: 'o:x', name: '자동', auto: 1 }], codes: { biz: [{ id: 'b:새', name: '새 구분' }] } }, USERS, { links: {}, files: [] }, '2026-11-24');
  assert.deepEqual(p.hand.map((h) => `${h.kind}:${h.name}`), ['기업 · 기관:손으로', '사업구분:새 구분']);
  assert.match(p.problems.join(' / '), /사람이 넣은 기준정보 2건/);
});
