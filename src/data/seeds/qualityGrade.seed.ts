import type { QualityGrade } from '@/domain/qualityGrade/schema';

/**
 * 품질등급 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-grade.jsx 의 인라인 mock 이관)
 * color 는 화면 표시색을 리터럴 hex 로 보존(원래 C 토큰 참조였던 값은 해석한 hex).
 */
export const QUALITY_GRADE_SEED: QualityGrade[] = [
  { code: 'A', name: 'A급 (양품)', type: '합격', color: '#16a34a', ship: true, rework: false, stock: '양품 재고', stockTone: 'ok', allow: { 치명: false, 주요: false, 경미: false }, approve: '자동 판정', price: 100, stages: ['수입', '공정', '출하'], use: true, desc: '전 검사항목이 규격 내 — 결함 없는 정상 양품. 즉시 입고·출하 가능.' },
  { code: 'B', name: 'B급 (2급)', type: '조건부합격', color: '#3a6ee0', ship: true, rework: false, stock: '등급 재고', stockTone: 'info', allow: { 치명: false, 주요: false, 경미: true }, approve: '검사 담당', price: 85, stages: ['공정', '출하'], use: true, desc: '경미 결함 허용 범위 내. 등급 분리 보관 후 할인 단가로 출하.' },
  { code: 'C', name: 'C급 (특채)', type: '특채', color: '#e6960c', ship: true, rework: false, stock: '특채 재고', stockTone: 'warn', allow: { 치명: false, 주요: true, 경미: true }, approve: 'MRB 심의 / 고객 승인', price: 70, stages: ['공정', '출하'], use: true, desc: '주요 결함 일부 포함. MRB 심의 및 고객 특채(Waiver) 승인 후 한정 출하.' },
  { code: 'RW', name: '재작업 대상', type: '처리', color: '#9159d6', ship: false, rework: true, stock: '보류 (재작업 대기)', stockTone: 'info', allow: { 치명: false, 주요: true, 경미: true }, approve: '생산 / 품질', price: null, stages: ['공정'], use: true, desc: '재작업으로 양품 전환 가능한 부적합품. 재작업 오더 발행 후 재검사.' },
  { code: 'RG', name: '선별 대상', type: '처리', color: '#3a8ee0', ship: false, rework: false, stock: '보류 (선별 대기)', stockTone: 'info', allow: { 치명: false, 주요: true, 경미: true }, approve: '품질 담당', price: null, stages: ['수입', '공정'], use: true, desc: '혼입 의심 로트. 전수 선별(Sorting) 후 양품/불량 재판정.' },
  { code: 'SC', name: '폐기 (Scrap)', type: '불합격', color: '#e0483b', ship: false, rework: false, stock: '폐기 대기', stockTone: 'err', allow: { 치명: true, 주요: true, 경미: true }, approve: '품질 책임자', price: 0, stages: ['수입', '공정', '출하'], use: true, desc: '재작업 불가 치명 결함. 폐기(Scrap) 처리 및 손실 비용 반영.' },
  { code: 'RT', name: '반품 (협력사)', type: '불합격', color: '#d6603a', ship: false, rework: false, stock: '반품 대기', stockTone: 'err', allow: { 치명: true, 주요: true, 경미: false }, approve: '구매 / 품질', price: 0, stages: ['수입'], use: true, desc: '수입검사 불합격 자재. 협력사 반품서 발행 및 입고 보류 연동.' },
];
