import type { DefectCode } from '@/domain/defectCode/schema';

/**
 * 불량코드 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-defect-code.jsx 의 인라인 DEF_GROUPS 2중 중첩을 평탄화 →
 *  코드별 1 도큐먼트, 각 코드에 소속 group 필드 부여)
 */
export const DEFECT_CODE_SEED: DefectCode[] = [
  // AP — 외관 불량
  { code: 'D-AP-SC', ko: '스크래치', en: 'Scratch', group: 'AP', proc: '표면처리', grade: '치명', insp: 'QI-AP-001', qty: 142, trend: [18, 22, 16, 25, 20, 24, 17], use: true },
  { code: 'D-AP-CL', ko: '색상·광택 불량', en: 'Color NG', group: 'AP', proc: '도장', grade: '주요', insp: 'QI-AP-002', qty: 76, trend: [9, 12, 8, 14, 10, 11, 12], use: true },
  { code: 'D-AP-BR', ko: '버(Burr)·이물', en: 'Burr / Foreign', group: 'AP', proc: '사출·가공', grade: '치명', insp: 'QI-AP-003', qty: 98, trend: [14, 11, 16, 12, 18, 13, 14], use: true },
  { code: 'D-AP-DT', ko: '찍힘·눌림', en: 'Dent', group: 'AP', proc: '취급·운반', grade: '주요', insp: 'QI-AP-001', qty: 41, trend: [5, 7, 4, 8, 6, 5, 6], use: true },
  { code: 'D-AP-ST', ko: '오염·얼룩', en: 'Stain', group: 'AP', proc: '세정', grade: '경미', insp: 'QI-AP-003', qty: 33, trend: [4, 5, 6, 3, 5, 4, 6], use: false },
  // DIM — 치수 불량
  { code: 'D-DIM-OS', ko: '외경 과대', en: 'O.D Oversize', group: 'DIM', proc: 'CNC 가공', grade: '주요', insp: 'QI-DIM-001', qty: 64, trend: [8, 10, 7, 9, 11, 8, 11], use: true },
  { code: 'D-DIM-US', ko: '내경 과소', en: 'I.D Undersize', group: 'DIM', proc: 'CNC 가공', grade: '주요', insp: 'QI-DIM-002', qty: 52, trend: [6, 8, 7, 5, 9, 8, 9], use: true },
  { code: 'D-DIM-LN', ko: '전장 불량', en: 'Length NG', group: 'DIM', proc: '절단', grade: '경미', insp: 'QI-DIM-003', qty: 38, trend: [5, 4, 6, 7, 5, 6, 5], use: true },
  { code: 'D-DIM-RD', ko: '진원도 불량', en: 'Roundness NG', group: 'DIM', proc: '연삭', grade: '주요', insp: 'QI-DIM-001', qty: 27, trend: [3, 5, 4, 4, 6, 3, 2], use: true },
  // WT — 중량·충전 불량
  { code: 'D-WT-OV', ko: '중량 초과', en: 'Overweight', group: 'WT', proc: '용접·조립', grade: '주요', insp: 'QI-WT-001', qty: 31, trend: [4, 5, 3, 6, 4, 5, 4], use: true },
  { code: 'D-WT-FL', ko: '충전량 부족', en: 'Underfill', group: 'WT', proc: '충전', grade: '주요', insp: 'QI-WT-002', qty: 19, trend: [2, 3, 4, 2, 3, 3, 2], use: false },
  // PR — 물성·재질 불량
  { code: 'D-PR-TS', ko: '인장강도 미달', en: 'Tensile Low', group: 'PR', proc: '수입검사', grade: '치명', insp: 'QI-PRP-001', qty: 22, trend: [3, 2, 4, 3, 5, 2, 3], use: true },
  { code: 'D-PR-HD', ko: '경도 불량', en: 'Hardness NG', group: 'PR', proc: '열처리', grade: '주요', insp: 'QI-PRP-002', qty: 29, trend: [4, 3, 5, 4, 3, 5, 5], use: true },
  { code: 'D-PR-TMP', ko: '성형온도 이상', en: 'Temp Abnormal', group: 'PR', proc: '사출 성형', grade: '주요', insp: 'QI-TMP-001', qty: 35, trend: [5, 6, 4, 7, 5, 4, 4], use: true },
  // ST — 구조·파손
  { code: 'D-ST-CR', ko: '크랙(균열)', en: 'Crack', group: 'ST', proc: '성형·열처리', grade: '치명', insp: '-', qty: 47, trend: [6, 8, 5, 9, 7, 6, 6], use: true },
  { code: 'D-ST-BK', ko: '파손', en: 'Broken', group: 'ST', proc: '취급·운반', grade: '치명', insp: '-', qty: 25, trend: [3, 4, 3, 5, 4, 3, 3], use: true },
  { code: 'D-ST-DF', ko: '변형·휨', en: 'Deformation', group: 'ST', proc: '용접', grade: '주요', insp: 'QI-DIM-003', qty: 30, trend: [4, 5, 4, 3, 6, 4, 4], use: true },
  // EL — 전기 특성
  { code: 'D-EL-IR', ko: '절연저항 불량', en: 'Insulation NG', group: 'EL', proc: '전기검사', grade: '치명', insp: 'QI-EL-001', qty: 18, trend: [2, 3, 2, 4, 3, 2, 2], use: true },
  { code: 'D-EL-OP', ko: '단선·접촉불량', en: 'Open / Contact', group: 'EL', proc: '조립', grade: '치명', insp: '-', qty: 14, trend: [2, 1, 3, 2, 2, 3, 1], use: true },
];
