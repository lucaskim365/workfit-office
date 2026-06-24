import type { WorkCenter } from '@/domain/workCenter/schema';

/** 작업장 시드 — Firebase 미설정 시 폴백 + 초기 seed 소스. (와이어프레임 workcenter-map.jsx) */
export const WORK_CENTER_SEED: WorkCenter[] = [
  { code: 'WC-INJ', name: '사출 작업장', line: '사출 라인', dept: '생산1팀', shift: '2교대', crew: 6, capa: 92, procs: ['OP10 사출 성형'], eqs: [
    { name: '사출 02호기', kind: '사출기', capa: 80, status: '가동' },
    { name: '사출 03호기', kind: '사출기', capa: 80, status: '가동' },
    { name: '사출 05호기', kind: '사출기', capa: 76, status: '대기' },
  ] },
  { code: 'WC-PRS', name: '프레스 작업장', line: '프레스 라인', dept: '생산1팀', shift: '2교대', crew: 4, capa: 88, procs: ['OP30 터미널 압착', 'OP10 프레스 성형'], eqs: [
    { name: '프레스 01호기', kind: '프레스', capa: 120, status: '가동' },
    { name: '프레스 02호기', kind: '프레스', capa: 120, status: '정비' },
  ] },
  { code: 'WC-ASM', name: '조립 작업장', line: '조립 라인', dept: '생산2팀', shift: '주간', crew: 10, capa: 78, procs: ['OP40 본체 조립', 'OP40 케이스 조립'], eqs: [
    { name: '조립셀 A', kind: '조립셀', capa: 60, status: '가동' },
    { name: '조립셀 B', kind: '조립셀', capa: 60, status: '가동' },
  ] },
  { code: 'WC-SMT', name: 'SMT 작업장', line: 'SMT 라인', dept: '생산2팀', shift: '3교대', crew: 5, capa: 95, procs: ['OP10 SMT 실장', 'OP20 리플로우', 'OP30 AOI 검사'], eqs: [
    { name: 'SMT 라인 2', kind: '실장기', capa: 128, status: '가동' },
    { name: '리플로우 오븐', kind: '오븐', capa: 130, status: '가동' },
    { name: 'AOI 02호기', kind: '검사기', capa: 140, status: '가동' },
  ] },
  { code: 'WC-EOL', name: '검사 작업장', line: '검사실', dept: '품질팀', shift: '주간', crew: 3, capa: 64, procs: ['OP50 기능 검사', 'OP50 교정/검사'], eqs: [
    { name: 'EOL 테스터', kind: '검사기', capa: 90, status: '가동' },
    { name: '교정 지그', kind: '지그', capa: 70, status: '대기' },
  ] },
  { code: 'WC-PKG', name: '포장 작업장', line: '포장 라인', dept: '생산3팀', shift: '주간', crew: 4, capa: 70, procs: ['OP60 포장', 'OP40 키트 포장'], eqs: [
    { name: '포장기 1', kind: '포장기', capa: 200, status: '가동' },
    { name: '라벨러', kind: '라벨러', capa: 220, status: '대기' },
  ] },
];
