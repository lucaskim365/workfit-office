import type { LiveAlarm } from '@/domain/liveAlarm/schema';

/**
 * 설비 실시간 알람 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-alarmmon.jsx 인라인 ALARMS 이관, id LA-01~LA-10 인덱스순 부여)
 */
export const LIVE_ALARM_SEED: LiveAlarm[] = [
  { id: 'LA-01', sev: '중대', t: '14:22:08', el: '13분', eq: 'Thermal 05호기', code: 'AL-6003', msg: '튜브 과승온 — 설비 인터록 정지', state: '조치중', mgr: '박보전', il: true },
  { id: 'LA-02', sev: '중대', t: '14:08:41', el: '27분', eq: 'Etch 04호기', code: 'AL-2010', msg: 'RF 반사파 과다 (Reflect 38W)', state: '조치중', mgr: '이정비', il: true },
  { id: 'LA-03', sev: '경고', t: '14:14:22', el: '21분', eq: 'Etch 01호기', code: 'AL-2033', msg: '챔버 압력 이상 — APC 밸브 점검 필요', state: '미조치', mgr: '—', il: false },
  { id: 'LA-04', sev: '경고', t: '14:11:55', el: '24분', eq: 'CMP 03호기', code: 'AL-1021', msg: '슬러리 공급 압력 저하 (0.15 MPa)', state: '미조치', mgr: '—', il: false },
  { id: 'LA-05', sev: '주의', t: '14:05:12', el: '30분', eq: 'Photo 06호기', code: 'AL-3041', msg: '광원 출력 저하 — 램프 수명 임박', state: '조치중', mgr: '김설비', il: false },
  { id: 'LA-06', sev: '경고', t: '13:51:48', el: '44분', eq: 'Implant 02호기', code: 'AL-5044', msg: '진공도 저하 (1.4×10⁻⁵)', state: '완료', mgr: '이정비', il: false },
  { id: 'LA-07', sev: '주의', t: '13:40:33', el: '55분', eq: 'Clean 04호기', code: 'AL-7011', msg: '케미컬 농도 이탈 (+3.8%)', state: '완료', mgr: '김설비', il: false },
  { id: 'LA-08', sev: '중대', t: '13:22:07', el: '1시간 13분', eq: 'Depo 03호기', code: 'AL-4081', msg: '챔버 누설 감지 — 리크 테스트 실시', state: '완료', mgr: '박보전', il: true },
  { id: 'LA-09', sev: '주의', t: '13:08:19', el: '1시간 27분', eq: 'Photo 05호기', code: 'AL-3088', msg: '환경 온도 편차 (+0.12℃)', state: '완료', mgr: '김설비', il: false },
  { id: 'LA-10', sev: '경고', t: '12:55:40', el: '1시간 40분', eq: 'Implant 03호기', code: 'AL-5070', msg: '고전압 방전 경고 — 절연부 점검', state: '완료', mgr: '이정비', il: false },
];
