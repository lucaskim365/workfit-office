import type { MaterialRequest } from '@/domain/materialRequest/schema';

/**
 * 자재 요청 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 material-request.jsx 의 인라인 WOS mock 이관)
 */
export const MATERIAL_REQUEST_SEED: MaterialRequest[] = [
  { wo: 'WO-1001', name: '커넥터 하우징', line: '사출 03호기', mats: [
    { code: 'PA66-GF30', name: 'PA66 강화수지', req: 240, unit: 'kg', stock: 1850, loc: 'A-01-2' },
    { code: 'MB-CLR-BK', name: '마스터배치(흑)', req: 6, unit: 'kg', stock: 95, loc: 'A-02-1' },
  ] },
  { wo: 'WO-1003', name: '커넥터 어셈블리', line: '조립셀 A', mats: [
    { code: 'CN-HSG-08P', name: '커넥터 하우징', req: 2400, unit: 'EA', stock: 2600, loc: 'B-01-3' },
    { code: 'TM-PIN-16', name: '터미널 핀', req: 38400, unit: 'EA', stock: 31000, loc: 'B-02-1' },
    { code: 'SEAL-RING', name: '실링 O-Ring', req: 2400, unit: 'EA', stock: 5000, loc: 'B-03-2' },
    { code: 'LABEL-CN', name: '식별 라벨', req: 2400, unit: 'EA', stock: 8000, loc: 'C-01-1' },
  ] },
  { wo: 'WO-1004', name: '센서 모듈 PCB', line: 'SMT 라인 2', mats: [
    { code: 'IC-SEN-A1', name: '센서 IC', req: 5400, unit: 'EA', stock: 0, loc: 'D-01-1' },
    { code: 'CHIP-0402', name: '칩부품 0402', req: 129600, unit: 'EA', stock: 480000, loc: 'D-02-4' },
    { code: 'CASE-SN', name: '센서 케이스', req: 5400, unit: 'EA', stock: 6200, loc: 'B-04-2' },
  ] },
];
