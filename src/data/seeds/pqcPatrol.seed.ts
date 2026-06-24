import type { PqcPatrol } from '@/domain/pqcPatrol/schema';

/**
 * PQC 공정 순회(Patrol) 검사 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-pqc-patrol.jsx 의 인라인 PT_ROUNDS mock 이관)
 */
export const PQC_PATROL_SEED: PqcPatrol[] = [
  { id: 'PR-260621-3', time: '14:00', route: 'A동 1·2라인', pic: '이순회', status: '진행중', dur: '22분', stops: [
    { line: '1라인 #1', proc: '사출', equip: 'INJ-02', time: '14:03', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '1라인 #3', proc: 'CNC 가공', equip: 'CNC-03', time: '14:09', c: { std: 0, five: 1, id: 1, self: 0, iso: 1, eqp: 1 }, note: '작업표준서 미게시 · 자주검사 기록 2회차 누락' },
    { line: '2라인 #1', proc: '프레스', equip: 'PRS-07', time: '14:15', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '2라인 #2', proc: '프레스', equip: 'PRS-08', time: '14:18', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 0 }, note: '유압유닛 미세 누유 — 설비팀 통보' },
    { line: '2라인 #4', proc: '검사', equip: 'VIS-01', time: '점검중', c: null },
    { line: '1라인 #5', proc: '조립', equip: 'ASM-02', time: '예정', c: null },
    { line: '1라인 #6', proc: '조립', equip: 'ASM-03', time: '예정', c: null },
    { line: 'A동 출하', proc: '포장', equip: 'PKG-01', time: '예정', c: null },
  ] },
  { id: 'PR-260621-2', time: '11:00', route: 'A동 1·2라인', pic: '이순회', status: '완료', dur: '34분', stops: [
    { line: '1라인 #1', proc: '사출', equip: 'INJ-02', time: '11:04', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '1라인 #3', proc: 'CNC 가공', equip: 'CNC-03', time: '11:11', c: { std: 1, five: 0, id: 1, self: 1, iso: 1, eqp: 1 }, note: '가공칩 미정리 — 즉시 시정' },
    { line: '2라인 #1', proc: '프레스', equip: 'PRS-07', time: '11:20', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '2라인 #4', proc: '검사', equip: 'VIS-01', time: '11:28', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
  ] },
  { id: 'PR-260621-1', time: '08:00', route: 'B동 3라인', pic: '김순회', status: '완료', dur: '28분', stops: [
    { line: '3라인 #1', proc: '호빙', equip: 'HOB-01', time: '08:05', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
    { line: '3라인 #2', proc: '선삭', equip: 'LTH-05', time: '08:14', c: { std: 1, five: 1, id: 0, self: 1, iso: 0, eqp: 1 }, note: 'LOT 식별표 미부착 · 부적합품 미격리' },
    { line: '3라인 #3', proc: '연삭', equip: 'GRD-02', time: '08:24', c: { std: 1, five: 1, id: 1, self: 1, iso: 1, eqp: 1 } },
  ] },
  { id: 'PR-260621-4', time: '17:00', route: 'A동 1·2라인', pic: '이순회', status: '예정', dur: '—', stops: [] },
];
