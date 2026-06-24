import type { EquipBom, BomNode } from '@/domain/equipBom/schema';

/** part 노드 헬퍼 — 화면 part()와 동일 시그니처. */
const part = (code: string, name: string, partNo: string, qty: number, maker: string, spare: string, cycle: string): BomNode => ({ lv: 'part', code, name, partNo, qty, maker, spare, cycle });

/** 설비 BOM 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 equip-bom.jsx) */
export const EQUIP_BOM_SEED: EquipBom[] = [
  {
    lv: 'line', code: 'LINE-A', name: 'A라인', children: [
      { lv: 'equip', code: 'EQ-CMP02', name: 'CMP 02호기', model: 'Reflexion LK', maker: 'AMAT', state: '가동', children: [
        { lv: 'unit', code: 'U-CMP02-HC', name: '헤드 캐리어 유닛', qty: 1, maker: 'AMAT', children: [
          part('P-1001', '캐리어 멤브레인', 'AM-MB-200', 4, 'AMAT', 'Y', '6개월'),
          part('P-1002', '리테이너 링', 'AM-RR-300', 4, 'AMAT', 'Y', '3개월'),
          part('P-1003', '진공 척 어셈블리', 'AM-VC-110', 4, 'AMAT', 'N', '12개월'),
        ] },
        { lv: 'unit', code: 'U-CMP02-PL1', name: '연마 플래튼 #1', qty: 1, maker: 'AMAT', children: [
          part('P-1010', '연마 패드', 'RHM-IC1000', 1, 'DuPont', 'Y', '7일'),
          part('P-1011', '컨디셔너 디스크', 'AM-CD-A45', 1, 'AMAT', 'Y', '1개월'),
          part('P-1012', '플래튼 구동 모터', 'YAS-SGM-3', 1, 'Yaskawa', 'N', '60개월'),
        ] },
        { lv: 'unit', code: 'U-CMP02-PL2', name: '연마 플래튼 #2', qty: 1, maker: 'AMAT', children: [
          part('P-1020', '연마 패드', 'RHM-IC1000', 1, 'DuPont', 'Y', '7일'),
          part('P-1021', '컨디셔너 디스크', 'AM-CD-A45', 1, 'AMAT', 'Y', '1개월'),
        ] },
        { lv: 'unit', code: 'U-CMP02-SL', name: '슬러리 공급 유닛', qty: 1, maker: 'AMAT', children: [
          part('P-1030', '슬러리 다이어프램 펌프', 'IWK-LK-25', 2, 'IWAKI', 'Y', '24개월'),
          part('P-1031', '유량 센서', 'KEY-FD-Q', 2, 'Keyence', 'N', '36개월'),
          part('P-1032', '인라인 필터', 'PALL-PF-5', 4, 'Pall', 'Y', '1개월'),
        ] },
        { lv: 'unit', code: 'U-CMP02-EP', name: 'End-point 검출 유닛', qty: 1, maker: 'AMAT', children: [
          part('P-1040', '광학 센서 모듈', 'AM-OPT-EP', 1, 'AMAT', 'N', '48개월'),
          part('P-1041', '신호 처리 보드', 'AM-PCB-EP2', 1, 'AMAT', 'Y', '—'),
        ] },
      ] },
      { lv: 'equip', code: 'EQ-ETCH01', name: 'Etch 01호기', model: 'Centura Sym3', maker: 'AMAT', state: '대기', children: [
        { lv: 'unit', code: 'U-ETCH01-RF', name: 'RF 제너레이터', qty: 1, maker: 'AE', children: [
          part('P-2001', 'RF 매칭 박스', 'AE-MN-30', 1, 'Advanced Energy', 'N', '60개월'),
          part('P-2002', 'RF 케이블 세트', 'AE-CBL-A', 2, 'Advanced Energy', 'Y', '24개월'),
        ] },
        { lv: 'unit', code: 'U-ETCH01-CHA', name: '챔버 A', qty: 1, maker: 'AMAT', children: [
          part('P-2010', '샤워헤드', 'AM-SH-200', 1, 'AMAT', 'Y', '12개월'),
          part('P-2011', 'O-Ring 키트', 'AM-OR-KIT', 1, 'AMAT', 'Y', '6개월'),
        ] },
      ] },
      { lv: 'equip', code: 'EQ-PHO05', name: 'Photo 05호기', model: 'NSR-S635E', maker: 'Nikon', state: '가동', children: [
        { lv: 'unit', code: 'U-PHO05-RS', name: '레티클 스테이지', qty: 1, maker: 'Nikon', children: [
          part('P-3001', '리니어 모터', 'NK-LM-S6', 2, 'Nikon', 'N', '60개월'),
        ] },
      ] },
    ],
  },
];
