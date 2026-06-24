import type { SpcAlarm } from '@/domain/spcAlarm/schema';

/**
 * SPC 품질알람 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 qual-spc-alarm.jsx 인라인 mock 이관)
 */
export const SPC_ALARM_SEED: SpcAlarm[] = [
  { id: 'AL-1042', time: '15:42:08', ago: '방금', type: 'OOS', sev: '치명', prod: '브래킷 ASSY-A', code: 'FG-BRK-A', char: '외경(O.D)', proc: 'CNC-03', val: 25.06, lo: 24.95, hi: 25.05, cl: 25.0, kind: '규격', unit: 'mm', status: '미확인', pic: '미배정', src: 'CMM 자동수집', trend: [25.01, 25.02, 25.03, 25.04, 25.05, 25.06], msg: '규격상한(USL 25.05mm) 초과 — 부적합품 발생. 즉시 설비 정지·격리 필요.' },
  { id: 'AL-1041', time: '15:38:51', ago: '3분 전', type: 'OOC', sev: '주요', prod: '체결 토크', code: 'PROC-ASM', char: '토크', proc: 'ASM-05', val: 13.5, lo: 10.6, hi: 13.4, cl: 12.0, kind: '관리한계', unit: 'N·m', status: '확인', pic: '이품질', src: '토크 시스템', trend: [12.0, 12.4, 12.8, 13.1, 13.3, 13.5], msg: '관리상한(UCL 13.4) 초과 — 공정 평균 상향 이동. 조건 점검 필요.' },
  { id: 'AL-1040', time: '15:31:20', ago: '11분 전', type: '규칙위반', sev: '주요', prod: '하우징 C-Type', code: 'FG-HSG-C', char: '중량', proc: 'INJ-02', val: 50.3, lo: 48.6, hi: 51.6, cl: 50.1, kind: '관리한계', unit: 'g', status: '조치중', pic: '김검사', src: 'SPC 엔진', trend: [50.0, 50.1, 50.2, 50.2, 50.3, 50.3], msg: 'Rule 2 — 연속 8점 중심선 상측. 공정 평균 이동 의심.' },
  { id: 'AL-1039', time: '15:18:05', ago: '24분 전', type: 'OOC', sev: '주요', prod: '두께(t)', code: 'FG-CVR-B', char: '두께', proc: 'PRS-07', val: 1.962, lo: 1.964, hi: 2.038, cl: 2.001, kind: '관리한계', unit: 'mm', status: '조치중', pic: '이품질', src: '인프로세스 게이지', trend: [2.0, 1.99, 1.98, 1.97, 1.97, 1.962], msg: '관리하한(LCL 1.964) 이탈 — 프레스 다이 점검 진행중.' },
  { id: 'AL-1037', time: '14:52:33', ago: '50분 전', type: 'OOS', sev: '치명', prod: '샤프트 D-40', code: 'FG-SFT-D', char: '진원도', proc: 'GRD-02', val: 0.035, lo: 0, hi: 0.02, cl: 0.01, kind: '규격', unit: 'mm', status: '해제', pic: '김검사', src: 'CMM 자동수집', trend: [0.012, 0.018, 0.022, 0.028, 0.032, 0.035], msg: '규격상한(0.02mm) 초과 — 척 클램프 교체 후 해제.' },
  { id: 'AL-1035', time: '14:40:11', ago: '62분 전', type: '설비이상', sev: '경미', prod: '디지털 캘리퍼 GW', code: 'IF-GAGE-05', char: '통신', proc: 'LTH-05', val: 0, lo: 0, hi: 1, cl: 1, kind: '상태', unit: '', status: '해제', pic: '설비팀', src: '인터페이스', trend: [1, 1, 1, 0, 0, 0], msg: '계측 인터페이스 단절 — 수동입력 전환 후 통신 복구.' },
];
