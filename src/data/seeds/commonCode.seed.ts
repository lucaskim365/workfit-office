import type { CommonCode } from '@/domain/commonCode/schema';

/**
 * 공통코드 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스.
 * (와이어프레임 admin-screens.CommonCodeContent 기준, flat 형태로 전개)
 */
type Tuple = [code: string, name: string, order: number, use: boolean];
const G = (groupCode: string, groupName: string, rows: Tuple[]): CommonCode[] =>
  rows.map(([code, name, order, use]) => ({ groupCode, groupName, code, name, order, use, regBy: '관리자' }));

export const COMMON_CODE_SEED: CommonCode[] = [
  ...G('EQ_STATUS', '설비 가동 상태', [
    ['RUN', '가동', 10, true], ['IDLE', '대기', 20, true], ['STOP', '정지', 30, true],
    ['DOWN', '고장', 40, true], ['PM', '예방정비', 50, false],
  ]),
  ...G('USE_YN', '사용 여부', [['Y', '사용', 10, true], ['N', '미사용', 20, true]]),
  ...G('DEFECT_GRADE', '결함 등급', [
    ['A', '심', 10, true], ['B', '중', 20, true], ['C', '경', 30, true], ['D', '정보', 40, false],
  ]),
  ...G('INSP_TYPE', '검사 유형', [
    ['IQC', '수입검사', 10, true], ['PQC', '공정검사', 20, true], ['OQC', '출하검사', 30, true],
  ]),
  ...G('VENDOR_TYPE', '거래처 구분', [
    ['BUY', '매입', 10, true], ['SELL', '매출', 20, true], ['SUB', '외주', 30, true],
  ]),
  ...G('LINE_CODE', '라인 코드', [['A', 'A라인', 10, true], ['B', 'B라인', 20, true], ['C', 'C라인', 30, true]]),
  ...G('UNIT', '단위', [['EA', '개', 10, true], ['KG', '킬로그램', 20, true], ['BOX', '박스', 30, false]]),
];
