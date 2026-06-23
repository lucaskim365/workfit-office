import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { Donut } from '@/shared/ui/charts/Donut';
import { RankBars } from '@/shared/ui/charts/RankBars';
import { LineChart } from '@/shared/ui/charts/LineChart';

const SEV: Record<string, string> = { 중대: '#e0564f', 경고: '#ef8f43', 주의: '#3a6ee0' };
const STATE: Record<string, { c: string; soft: string }> = {
  미조치: { c: '#e0564f', soft: '#fdeceb' },
  조치중: { c: '#ef8f43', soft: '#fdf0e3' },
  완료: { c: '#1f9d6b', soft: '#e7f5ee' },
};

interface Alarm { sev: '중대' | '경고' | '주의'; t: string; el: string; eq: string; code: string; msg: string; state: '미조치' | '조치중' | '완료'; mgr: string; il: boolean }
const ALARMS: Alarm[] = [
  { sev: '중대', t: '14:22:08', el: '13분', eq: 'Thermal 05호기', code: 'AL-6003', msg: '튜브 과승온 — 설비 인터록 정지', state: '조치중', mgr: '박보전', il: true },
  { sev: '중대', t: '14:08:41', el: '27분', eq: 'Etch 04호기', code: 'AL-2010', msg: 'RF 반사파 과다 (Reflect 38W)', state: '조치중', mgr: '이정비', il: true },
  { sev: '경고', t: '14:14:22', el: '21분', eq: 'Etch 01호기', code: 'AL-2033', msg: '챔버 압력 이상 — APC 밸브 점검 필요', state: '미조치', mgr: '—', il: false },
  { sev: '경고', t: '14:11:55', el: '24분', eq: 'CMP 03호기', code: 'AL-1021', msg: '슬러리 공급 압력 저하 (0.15 MPa)', state: '미조치', mgr: '—', il: false },
  { sev: '주의', t: '14:05:12', el: '30분', eq: 'Photo 06호기', code: 'AL-3041', msg: '광원 출력 저하 — 램프 수명 임박', state: '조치중', mgr: '김설비', il: false },
  { sev: '경고', t: '13:51:48', el: '44분', eq: 'Implant 02호기', code: 'AL-5044', msg: '진공도 저하 (1.4×10⁻⁵)', state: '완료', mgr: '이정비', il: false },
  { sev: '주의', t: '13:40:33', el: '55분', eq: 'Clean 04호기', code: 'AL-7011', msg: '케미컬 농도 이탈 (+3.8%)', state: '완료', mgr: '김설비', il: false },
  { sev: '중대', t: '13:22:07', el: '1시간 13분', eq: 'Depo 03호기', code: 'AL-4081', msg: '챔버 누설 감지 — 리크 테스트 실시', state: '완료', mgr: '박보전', il: true },
  { sev: '주의', t: '13:08:19', el: '1시간 27분', eq: 'Photo 05호기', code: 'AL-3088', msg: '환경 온도 편차 (+0.12℃)', state: '완료', mgr: '김설비', il: false },
  { sev: '경고', t: '12:55:40', el: '1시간 40분', eq: 'Implant 03호기', code: 'AL-5070', msg: '고전압 방전 경고 — 절연부 점검', state: '완료', mgr: '이정비', il: false },
];

const ACTIVE = ALARMS.filter((a) => a.state !== '완료');
const SEV_COUNT = (s: string) => ACTIVE.filter((a) => a.sev === s).length;
const UNACK = ALARMS.filter((a) => a.state === '미조치').length;

const TOP_EQ = [
  { label: 'Etch (식각)', v: 18, c: '#e0564f' },
  { label: 'CMP (연마)', v: 14, c: '#ef8f43' },
  { label: 'Thermal (열처리)', v: 11, c: '#ef8f43' },
  { label: 'Implant (이온주입)', v: 8, c: '#3a6ee0' },
  { label: 'Photo (노광)', v: 6, c: '#3a6ee0' },
];

const TREND_LABELS = ['00', '02', '04', '06', '08', '10', '12', '14'];
const TREND = [
  { c: '#e0564f', data: [1, 0, 2, 1, 3, 2, 4, 3] },
  { c: '#9aa4ba', data: [4, 3, 5, 6, 9, 11, 13, 14] },
];

const sevTone = (s: string): Tone => (s === '중대' ? 'err' : s === '경고' ? 'warn' : 'info');

function Kpi({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-[10px] border border-border bg-panel px-4 py-3" style={{ borderTop: `3px solid ${color}` }}>
      <span className="text-[10.5px] font-semibold text-ink3">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[23px] font-extrabold leading-none tabular-nums" style={{ color }}>{value}</span>
        <span className="text-[11px] font-semibold text-ink3">{unit}</span>
      </span>
    </div>
  );
}

/** 설비 알람·장애 모니터링 — 와이어프레임 equip-alarmmon.jsx 정본. */
export default function EquipAlarmMonScreen() {
  const donut = ['중대', '경고', '주의'].map((s) => ({ name: s, v: SEV_COUNT(s), c: SEV[s] }));
  return (
    <div className="flex flex-col gap-3.5">
      <style>{`@keyframes almPulse{0%,100%{opacity:1}50%{opacity:.3}} .alm-pulse{animation:almPulse 1s infinite}`}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비 알람 · 장애 모니터링</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 상태 모니터링 / 설비 알람·장애 모니터링</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-ink3"><span className="alm-pulse h-[7px] w-[7px] rounded-full bg-danger" />LIVE · 5초 자동 갱신</span>
          <span className="font-mono text-[12px] font-bold text-ink">2026-06-10 14:35:02</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Kpi label="현재 활성 알람" value={ACTIVE.length} unit="건" color="var(--color-danger)" />
        <Kpi label="중대(Critical)" value={SEV_COUNT('중대')} unit="건" color="var(--color-danger)" />
        <Kpi label="미조치" value={UNACK} unit="건" color="var(--color-amber)" />
        <Kpi label="인터록 발생" value={ACTIVE.filter((a) => a.il).length} unit="건" color="var(--color-danger)" />
        <Kpi label="오늘 발생" value="14" unit="건" color="var(--color-ink)" />
        <Kpi label="평균 응답시간" value="6.4" unit="분" color="var(--color-ok)" />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_290px]">
        <Card title="실시간 알람 내역" action={<div className="flex gap-1.5">{Object.keys(STATE).map((s) => <span key={s} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: STATE[s].c }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: STATE[s].c }} />{s} {ALARMS.filter((a) => a.state === s).length}</span>)}</div>} bodyClassName="p-0">
          <div className="max-h-[540px] overflow-y-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['등급', '발생', '경과', '설비 / 알람 내용', '상태', '담당'].map((h, i) => (
                    <th key={h} className={`sticky top-0 z-[1] border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALARMS.map((a, i) => {
                  const active = a.state !== '완료';
                  return (
                    <tr key={i} style={active ? { background: STATE[a.state].soft } : undefined} className={active ? '' : 'bg-panel'}>
                      <td className="border-b border-border px-3 py-2.5 text-center" style={{ borderLeft: `3px solid ${SEV[a.sev]}` }}><Pill tone={sevTone(a.sev)}>{a.sev}</Pill></td>
                      <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10.5px] text-ink2">{a.t}</td>
                      <td className="border-b border-border px-3 py-2.5 text-center text-[10.5px] font-bold" style={{ color: active ? SEV[a.sev] : 'var(--color-ink3)' }}>{a.el}</td>
                      <td className="border-b border-border px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-ink">{a.eq}</span>
                            <span className="font-mono text-[10px] font-bold text-teal">{a.code}</span>
                            {a.il && <span className="rounded bg-danger px-1.5 py-px text-[9px] font-extrabold text-white">인터록</span>}
                          </div>
                          <span className="text-[11px] leading-snug text-ink2">{a.msg}</span>
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: STATE[a.state].c }}>
                          {a.state === '미조치' && <span className="alm-pulse h-[5px] w-[5px] rounded-full bg-white" />}{a.state}
                        </span>
                      </td>
                      <td className={`border-b border-border px-3 py-2.5 text-center text-[11px] font-semibold ${a.mgr === '—' ? 'text-ink3' : 'text-ink'}`}>{a.mgr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="활성 알람 등급 분포">
            <div className="flex flex-col items-center gap-3">
              <Donut data={donut} size={132} thickness={20} centerTop={`${ACTIVE.length}건`} centerSub="활성 알람" />
              <div className="flex w-full flex-col gap-1.5">
                {['중대', '경고', '주의'].map((s) => (
                  <div key={s} className="flex items-center gap-2 text-[11.5px]">
                    <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: SEV[s] }} />
                    <span className="font-semibold text-ink2">{s}</span>
                    <span className="ml-auto font-extrabold text-ink">{SEV_COUNT(s)}건</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="설비 유형별 발생 (24h)" action={<span className="text-[10px] text-ink3">Top 5</span>}>
            <RankBars rows={TOP_EQ} />
          </Card>
        </div>
      </div>

      <Card title="알람 발생 추이 (24시간)" action={<div className="flex gap-3.5"><span className="flex items-center gap-1.5 text-[11px] text-ink2"><span className="h-[3px] w-3 rounded-sm" style={{ background: '#e0564f' }} />중대</span><span className="flex items-center gap-1.5 text-[11px] text-ink2"><span className="h-[3px] w-3 rounded-sm" style={{ background: '#9aa4ba' }} />전체</span></div>}>
        <LineChart series={TREND} labels={TREND_LABELS} w={920} h={180} area max={16} />
      </Card>
    </div>
  );
}
