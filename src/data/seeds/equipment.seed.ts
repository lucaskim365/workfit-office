import type { Equipment } from '@/domain/equipment/schema';

/**
 * 설비 마스터 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-base.jsx / 모듈 공유 _data.EQ_LIST 이관)
 */
export const EQUIPMENT_SEED: Equipment[] = [
  { code: 'EQ-CMP02', name: 'CMP 02호기', type: 'CMP', model: 'Reflexion LK', maker: 'AMAT', line: 'A라인', loc: 'FAB1-2F-A03', date: '2022-04-18', mgr: '김설비', state: '가동', power: '32', volt: '380V 3상', use: '사용', ip: '10.21.4.12' },
  { code: 'EQ-ETCH01', name: 'Etch 01호기', type: 'Etch', model: 'Centura Sym3', maker: 'AMAT', line: 'A라인', loc: 'FAB1-2F-A05', date: '2021-11-30', mgr: '박보전', state: '대기', power: '45', volt: '380V 3상', use: '사용', ip: '10.21.4.18' },
  { code: 'EQ-PHO05', name: 'Photo 05호기', type: 'Photo', model: 'NSR-S635E', maker: 'Nikon', line: 'A라인', loc: 'FAB1-3F-A11', date: '2023-02-09', mgr: '김설비', state: '가동', power: '60', volt: '440V 3상', use: '사용', ip: '10.21.5.04' },
  { code: 'EQ-DEP03', name: 'Depo 03호기', type: 'Depo', model: 'Producer GT', maker: 'AMAT', line: 'B라인', loc: 'FAB1-2F-B07', date: '2020-08-22', mgr: '이정비', state: '정지', power: '38', volt: '380V 3상', use: '사용', ip: '10.21.6.21' },
  { code: 'EQ-IMP02', name: 'Implant 02호기', type: 'Implant', model: 'VIISta 900', maker: 'AMAT', line: 'B라인', loc: 'FAB1-2F-B09', date: '2021-06-14', mgr: '이정비', state: '가동', power: '52', volt: '440V 3상', use: '사용', ip: '10.21.6.30' },
  { code: 'EQ-OVEN05', name: 'Thermal 05호기', type: 'Thermal', model: 'ASM A412', maker: 'ASM', line: 'C라인', loc: 'FAB1-1F-C02', date: '2019-03-05', mgr: '박보전', state: '고장', power: '28', volt: '380V 3상', use: '미사용', ip: '10.21.7.08' },
  { code: 'EQ-CLN04', name: 'Clean 04호기', type: 'Clean', model: 'FSI Mercury', maker: 'TEL', line: 'C라인', loc: 'FAB1-1F-C05', date: '2022-09-27', mgr: '김설비', state: '가동', power: '18', volt: '220V 단상', use: '사용', ip: '10.21.7.15' },
];
