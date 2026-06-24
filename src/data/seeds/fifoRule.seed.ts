import type { FifoRule } from '@/domain/fifoRule/schema';

/**
 * FIFO 출고규칙 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 wms-screens-4.jsx 의 인라인 RULES 객체화 이관)
 */
export const FIFO_RULE_SEED: FifoRule[] = [
  { category: '원자재(웨이퍼)', rule: 'FIFO', basis: '입고일자', mode: '강제', use: true },
  { category: '화학약품·가스', rule: 'FEFO', basis: '유효기한', mode: '강제', use: true },
  { category: '포토레지스트', rule: 'FEFO', basis: '제조일자', mode: '강제', use: true },
  { category: '포장·부자재', rule: 'FIFO', basis: '입고일자', mode: '권고', use: false },
];
