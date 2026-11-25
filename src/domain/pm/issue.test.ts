import assert from 'node:assert/strict';
import test from 'node:test';
import { pmIssueSchema, type PmIssue } from './schema';
import { issueAge, issueBoard, issueCheck, nextIssueId } from './issue';

/** 이슈 규칙 (데모 pRisk · issueForm) — 테스트용 작은 데이터 (§0.1-1). 오늘 = 2026-11-25 */
const TODAY = '2026-11-25';
const I = (o: Partial<PmIssue> & { id: string }): PmIssue => pmIssueSchema.parse({ projectId: 'P9', title: o.id, ...o });

test('이슈 보드: 열림 · 대응중 = 심각도 → 오래된 순, 해결 = 발생일 최근 순 / 숫자 = 사업으로 거른 미해결', () => {
  const L = [
    I({ id: 'I-001', sev: '보통', date: '2026-11-01', cat: '코드 버그' }), // 24일째
    I({ id: 'I-002', sev: '긴급', date: '2026-11-24', cat: '설비 통신 장애' }),
    I({ id: 'I-003', sev: '보통', date: '2026-11-20', cat: '네트워크 단절' }), // 기타
    I({ id: 'I-004', sev: '높음', date: '2026-11-10', status: '대응중', cat: '코드 버그' }),
    I({ id: 'I-005', date: '2026-11-05', status: '해결', cat: '코드 버그' }),
    I({ id: 'I-006', date: '2026-11-15', status: '해결', cat: '데이터 품질' }),
    I({ id: 'I-007', projectId: 'P3', date: '2026-11-25', cat: '코드 버그' }),
  ];
  const b = issueBoard(L.filter((i) => i.projectId === 'P9').concat(L[6]), 'P9', 'all', TODAY);
  assert.deepEqual([b.lanes.열림, b.lanes.대응중, b.lanes.해결].map((x) => x.map((i) => i.id)), [['I-002', 'I-001', 'I-003'], ['I-004'], ['I-006', 'I-005']]);
  assert.deepEqual([b.nOpen, b.nHot, b.nOld], [4, 2, 2], '긴급 · 높음 = I-002 · I-004, 7일 넘음 = I-001(24일) · I-004(15일)');
  assert.deepEqual(b.tile, { all: 4, '설비 통신 장애': 1, '현장 협조 지연': 0, '코드 버그': 2, '데이터 품질': 0 });
  assert.deepEqual(issueBoard(L, 'all', '기타', TODAY).lanes.열림.map((i) => i.id), ['I-003'], '칸 4개 밖 = 기타');
  assert.deepEqual(issueBoard(L, 'all', '코드 버그', TODAY).lanes.열림.map((i) => i.id), ['I-001', 'I-007']);
  assert.equal(issueAge(L[0], TODAY), 24);
});

test('이슈 번호 · 입력 확인 (해결이면 조치 내용 필수)', () => {
  assert.equal(nextIssueId([]), 'I-001');
  assert.equal(nextIssueId([I({ id: 'I-009' }), I({ id: 'I-002' })]), 'I-010');
  const v = { projectId: 'P9', title: '통신 끊김', ownerId: 'u', date: TODAY, status: '열림', action: '' };
  assert.equal(issueCheck(v), null);
  assert.deepEqual(issueCheck({ ...v, title: ' ' })?.[1], 'title');
  assert.deepEqual(issueCheck({ ...v, ownerId: '' })?.[1], 'ownerId');
  assert.deepEqual(issueCheck({ ...v, status: '해결' }), ['해결 처리 시 조치 내용을 입력해야 합니다', 'action']);
  assert.equal(issueCheck({ ...v, status: '해결', action: 'PLC 재설정' }), null);
});
