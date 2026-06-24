import type { TraceNode } from '@/domain/traceNode/schema';

/**
 * LOT 계보 추적 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-trace-lot.jsx 의 인라인 TR_NODES mock 이관. level 순서 보존)
 */
export const TRACE_NODE_SEED: TraceNode[] = [
  { id: 'N0', level: 0, type: '제품', lot: 'L2606-1013', name: '브래킷 ASSY-A', code: 'FG-BRK-A', qty: 1200, unit: 'EA', insp: '합격', inspType: '출하검사', extra: '출하 → 현대모비스', ncr: false, events: [['작업착수', '06-21 08:00', 'WO-260621-013 · 1라인 #3', 'info'], ['초·중·종물 검사', '06-21 09:12~15:30', '전 단계 합격', 'ok'], ['출하검사 합격', '06-21 16:20', 'n=80 Ac1 · 부적합 0', 'ok'], ['COA 발행', '06-21 16:40', 'COA-260621-014', 'info'], ['출하 완료', '06-22 14:00', '현대모비스 아산 1공장', 'ok']] },
  { id: 'N1', level: 1, type: '반제품', lot: 'L2606-S07', name: '가공 브래킷 (반제품)', code: 'SF-BRK-07', qty: 1218, unit: 'EA', insp: '합격', inspType: '공정검사', extra: '재작업 1건', ncr: true, events: [['가공 시작', '06-21 08:10', 'CNC-03 가공', 'info'], ['중물검사 외경 과대', '06-21 13:40', 'NCR-260621-008 · 18EA', 'err'], ['재작업(외경 재가공)', '06-21 14:30', 'RW-260620-008 · 회수 16EA', 'warn'], ['재검사 합격', '06-21 15:10', '전수 재검 OK', 'ok']] },
  { id: 'N2', level: 2, type: '자재', lot: 'L2606-0021', name: '알루미늄 빌렛 6061', code: 'RM-AL6061', vendor: '대한금속', qty: 1200, unit: 'EA', insp: '합격', inspType: '수입검사', extra: 'GR-260621-014', ncr: false, events: [['입고', '06-21 08:20', 'GR-260621-014 · 대한금속', 'info'], ['수입검사 합격', '06-21 11:30', 'n=80 Ac2 · 부적합 1', 'ok'], ['투입', '06-21 08:10', 'WO-260621-013', 'info']] },
  { id: 'N3', level: 2, type: '자재', lot: 'L2606-0019', name: '베어링 608ZZ', code: 'SP-BRG-608', vendor: '정밀베어링', qty: 500, unit: 'EA', insp: '합격', inspType: '수입검사', extra: 'GR-260620-031', ncr: false, events: [['입고', '06-20 16:40', 'GR-260620-031 · 정밀베어링', 'info'], ['수입검사 합격', '06-21 10:30', 'n=50 Ac1 · 부적합 0', 'ok'], ['투입', '06-21 09:30', 'WO-260621-013', 'info']] },
  { id: 'N4', level: 2, type: '자재', lot: 'L2606-0015', name: '동(Cu) 판재 t1.0', code: 'RM-CU-T1', vendor: '대한금속', qty: 90, unit: 'SHT', insp: '조건부', inspType: '수입검사', extra: 'GR-260619-035', ncr: false, events: [['입고', '06-19 15:20', 'GR-260619-035 · 대한금속', 'info'], ['수입검사 조건부', '06-19 17:00', '오염·얼룩 경미 · 등급 B', 'warn'], ['투입', '06-21 08:15', 'WO-260621-013', 'info']] },
];
