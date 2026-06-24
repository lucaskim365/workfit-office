import type { Issue } from '@/domain/issue/schema';

/**
 * 불출 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 wms-screens-2.jsx)
 * 자재 종수 = materials.length (5/4/6종). IS-21/22는 이미 불출완료(재고에 반영됨).
 */
export const ISSUE_SEED: Issue[] = [
  { no: 'IS-260611-21', wo: 'WO-260611-021', target: 'M-Line 작업장1', kit: '키트 A', warehouse: 'A-Zone', status: '불출완료',
    materials: [
      { code: 'WF-300-B', name: '300mm 웨이퍼', qty: 40 }, { code: 'CHM-SL-05', name: '슬러리 SL-05', qty: 6 },
      { code: 'RES-PR-22', name: '포토레지스트', qty: 4 }, { code: 'PKG-BGA-14', name: 'BGA 기판', qty: 12 },
      { code: 'WF-200-A', name: '200mm 웨이퍼', qty: 20 },
    ] },
  { no: 'IS-260611-22', wo: 'WO-260611-022', target: 'M-Line 작업장2', kit: '키트 B', warehouse: 'A-Zone', status: '불출완료',
    materials: [
      { code: 'WF-300-B', name: '300mm 웨이퍼', qty: 20 }, { code: 'CHM-SL-05', name: '슬러리 SL-05', qty: 3 },
      { code: 'RES-PR-22', name: '포토레지스트', qty: 2 }, { code: 'WF-200-A', name: '200mm 웨이퍼', qty: 10 },
    ] },
  { no: 'IS-260611-15', wo: 'WO-260611-015', target: 'P-Line 작업장1', kit: '키트 C', warehouse: 'C-Zone', status: '준비중',
    materials: [
      { code: 'PKG-BGA-14', name: 'BGA 기판', qty: 80 }, { code: 'CMP-CON-14', name: '보드 커넥터', qty: 200 },
      { code: 'WF-300-B', name: '300mm 웨이퍼', qty: 30 }, { code: 'CHM-SL-05', name: '슬러리 SL-05', qty: 5 },
      { code: 'RES-PR-22', name: '포토레지스트', qty: 3 }, { code: 'WF-200-A', name: '200mm 웨이퍼', qty: 15 },
    ] },
];
