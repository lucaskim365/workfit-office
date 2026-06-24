import type { Routing } from '@/domain/routing/schema';

/** 라우팅 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 routing-master.jsx) */
export const ROUTING_SEED: Routing[] = [
  {
    code: 'CN-ASM-100', name: '커넥터 어셈블리', rev: 'B', line: '조립 라인',
    steps: [
      { op: 'OP10', name: '사출 성형', wc: 'WC-INJ', eq: '사출 03호기', kind: '가공', setup: 30, ct: 45, crew: 1, yield: 99.2 },
      { op: 'OP20', name: '디버링/외관', wc: 'WC-DBG', eq: '–', kind: '검사', setup: 5, ct: 20, crew: 1, yield: 99.5 },
      { op: 'OP30', name: '터미널 압착', wc: 'WC-PRS', eq: '프레스 01호기', kind: '가공', setup: 25, ct: 30, crew: 1, yield: 98.8 },
      { op: 'OP40', name: '본체 조립', wc: 'WC-ASM', eq: '조립셀 A', kind: '가공', setup: 10, ct: 60, crew: 2, yield: 99.0 },
      { op: 'OP50', name: '기능 검사', wc: 'WC-EOL', eq: 'EOL 테스터', kind: '검사', setup: 8, ct: 35, crew: 1, yield: 97.5 },
      { op: 'OP60', name: '포장', wc: 'WC-PKG', eq: '–', kind: '가공', setup: 5, ct: 18, crew: 1, yield: 99.9 },
    ],
  },
  {
    code: 'SN-MOD-200', name: '센서 모듈', rev: 'A', line: 'SMT 라인',
    steps: [
      { op: 'OP10', name: 'SMT 실장', wc: 'WC-SMT', eq: 'SMT 라인 2', kind: '가공', setup: 40, ct: 28, crew: 1, yield: 99.0 },
      { op: 'OP20', name: '리플로우', wc: 'WC-RFL', eq: '리플로우 오븐', kind: '가공', setup: 15, ct: 22, crew: 1, yield: 99.3 },
      { op: 'OP30', name: 'AOI 검사', wc: 'WC-AOI', eq: 'AOI 02호기', kind: '검사', setup: 6, ct: 16, crew: 1, yield: 98.2 },
      { op: 'OP40', name: '케이스 조립', wc: 'WC-ASM', eq: '조립셀 B', kind: '가공', setup: 10, ct: 48, crew: 2, yield: 99.1 },
      { op: 'OP50', name: '교정/검사', wc: 'WC-CAL', eq: '교정 지그', kind: '검사', setup: 12, ct: 40, crew: 1, yield: 96.8 },
    ],
  },
  {
    code: 'BR-KIT-2T', name: '브래킷 키트', rev: 'C', line: '프레스 라인',
    steps: [
      { op: 'OP10', name: '프레스 성형', wc: 'WC-PRS', eq: '프레스 01호기', kind: '가공', setup: 35, ct: 12, crew: 1, yield: 99.4 },
      { op: 'OP20', name: '표면 처리', wc: 'WC-SFC', eq: '도금 라인', kind: '가공', setup: 20, ct: 90, crew: 1, yield: 98.5 },
      { op: 'OP30', name: '치수 검사', wc: 'WC-INSP', eq: '–', kind: '검사', setup: 5, ct: 25, crew: 1, yield: 99.6 },
      { op: 'OP40', name: '키트 포장', wc: 'WC-PKG', eq: '–', kind: '가공', setup: 5, ct: 30, crew: 2, yield: 99.9 },
    ],
  },
];
