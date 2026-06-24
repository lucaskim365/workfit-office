import type { PdmEquipment } from '@/domain/pdmEquipment/schema';

/**
 * 설비 예지보전(PdM) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-pdm.jsx 의 인라인 PDM_EQ 이관)
 */
export const PDM_EQUIPMENT_SEED: PdmEquipment[] = [
  { code: 'EQ-OVEN05', name: 'Thermal 05호기', health: 41, rul: 6, trend: 'down', state: '위험', driver: '히터존 온도편차' },
  { code: 'EQ-CMP02', name: 'CMP 02호기', health: 63, rul: 18, trend: 'down', state: '주의', driver: '구동부 진동' },
  { code: 'EQ-IMP02', name: 'Implant 02호기', health: 72, rul: 34, trend: 'flat', state: '주의', driver: '이온소스 전류' },
  { code: 'EQ-ETCH01', name: 'Etch 01호기', health: 88, rul: 72, trend: 'up', state: '정상', driver: '–' },
  { code: 'EQ-PHO05', name: 'Photo 05호기', health: 91, rul: 95, trend: 'flat', state: '정상', driver: '–' },
  { code: 'EQ-DEP03', name: 'Depo 03호기', health: 84, rul: 61, trend: 'flat', state: '정상', driver: '–' },
];
