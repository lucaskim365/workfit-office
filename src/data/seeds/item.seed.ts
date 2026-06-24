import type { Item } from '@/domain/item/schema';

/**
 * 품목 시드 데이터 — Firebase 미설정(초기) 시 repository가 반환하는 폴백.
 * Firestore 연동 후에는 초기 업로드(seed) 소스로 재사용한다.
 * (와이어프레임 admin-screens.ItemInfoContent 기준)
 */
export const ITEM_SEED: Item[] = [
  { code: 'WF-200-A', name: '200mm 웨이퍼', spec: 'Ø200mm', unit: 'EA', type: '원자재', use: '사용', safetyStock: 500, remark: '입고 검사 필수 품목. 거래처 대성반도체(주).' },
  { code: 'WF-300-B', name: '300mm 웨이퍼', spec: 'Ø300mm', unit: 'EA', type: '원자재', use: '사용', safetyStock: 300, remark: '주력 생산 라인 투입 원자재.' },
  { code: 'PKG-BGA-14', name: 'BGA 패키지', spec: '14×14mm', unit: 'EA', type: '반제품', use: '사용', safetyStock: 1200, remark: '패키징 공정 반제품.' },
  { code: 'CHM-SL-05', name: '슬러리 SL-05', spec: '20L', unit: 'CAN', type: '부자재', use: '사용', safetyStock: 40, remark: 'CMP 공정 소모 부자재. 유효기간 관리.' },
  { code: 'MOD-CAM-02', name: '카메라 모듈', spec: '1/2.8"', unit: 'EA', type: '완제품', use: '사용', safetyStock: 200, remark: '출하 완제품.' },
  { code: 'RES-PR-22', name: '포토레지스트', spec: '5L', unit: 'BTL', type: '부자재', use: '미사용', safetyStock: 60, remark: '포토 공정 소모 부자재.' },
];
