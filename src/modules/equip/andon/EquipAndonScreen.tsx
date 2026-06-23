import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/charts/Donut';

type St = 'RUN' | 'IDLE' | 'STOP' | 'DOWN' | 'PM';
const AND: Record<St, { ko: string; c: string; soft: string }> = {
  RUN: { ko: '가동', c: '#1f9d6b', soft: '#e7f5ee' },
  IDLE: { ko: '대기', c: '#ef8f43', soft: '#fdf0e3' },
  STOP: { ko: '정지', c: '#56607a', soft: '#eef0f4' },
  DOWN: { ko: '고장', c: '#e0564f', soft: '#fdeceb' },
  PM: { ko: '점검', c: '#3a6ee0', soft: '#e9eefc' },
};

interface Eq { code: string; name: string; st: St; lot: string; prod: string; step: string; prog: number; run: string; cy: string; oee: number }
const BOARD: Array<{ line: string; eq: Eq[] }> = [
  { line: 'A라인', eq: [
    { code: 'CMP-02', name: 'CMP 02호기', st: 'RUN', lot: 'LOT-A2406-118', prod: 'AP-9 / 14nm', step: 'STEP 7/12', prog: 62, run: '04:12', cy: '120 WPH', oee: 88 },
    { code: 'ETCH-01', name: 'Etch 01호기', st: 'IDLE', lot: '—', prod: '대기 (레시피 대기)', step: 'STEP 0/9', prog: 0, run: '00:24', cy: '90 WPH', oee: 80 },
    { code: 'PHO-05', name: 'Photo 05호기', st: 'RUN', lot: 'LOT-A2406-117', prod: 'AP-9 / 14nm', step: 'STEP 3/8', prog: 41, run: '02:38', cy: '180 WPH', oee: 92 },
    { code: 'PHO-06', name: 'Photo 06호기', st: 'PM', lot: '—', prod: '정기 PM (광원 교체)', step: '—', prog: 35, run: '01:05', cy: '180 WPH', oee: 0 },
    { code: 'CMP-03', name: 'CMP 03호기', st: 'RUN', lot: 'LOT-A2406-120', prod: 'BX-2 / 28nm', step: 'STEP 9/12', prog: 78, run: '05:46', cy: '118 WPH', oee: 85 },
    { code: 'CLN-02', name: 'Clean 02호기', st: 'RUN', lot: 'LOT-A2406-119', prod: 'AP-9 / 14nm', step: 'STEP 2/4', prog: 55, run: '01:52', cy: '160 WPH', oee: 90 },
  ] },
  { line: 'B라인', eq: [
    { code: 'DEP-03', name: 'Depo 03호기', st: 'STOP', lot: '—', prod: '생산 정지 (계획)', step: '—', prog: 0, run: '01:30', cy: '110 WPH', oee: 0 },
    { code: 'IMP-02', name: 'Implant 02호기', st: 'RUN', lot: 'LOT-B2406-077', prod: 'CX-5 / 40nm', step: 'STEP 4/6', prog: 67, run: '03:21', cy: '200 WPH', oee: 86 },
    { code: 'DEP-04', name: 'Depo 04호기', st: 'RUN', lot: 'LOT-B2406-078', prod: 'CX-5 / 40nm', step: 'STEP 1/4', prog: 22, run: '00:48', cy: '110 WPH', oee: 83 },
    { code: 'IMP-03', name: 'Implant 03호기', st: 'IDLE', lot: '—', prod: '대기 (자재 입고 대기)', step: 'STEP 0/6', prog: 0, run: '00:12', cy: '200 WPH', oee: 84 },
    { code: 'ETCH-04', name: 'Etch 04호기', st: 'RUN', lot: 'LOT-B2406-079', prod: 'BX-2 / 28nm', step: 'STEP 6/9', prog: 71, run: '04:55', cy: '92 WPH', oee: 81 },
    { code: 'CMP-05', name: 'CMP 05호기', st: 'RUN', lot: 'LOT-B2406-080', prod: 'CX-5 / 40nm', step: 'STEP 5/12', prog: 48, run: '02:10', cy: '120 WPH', oee: 87 },
  ] },
  { line: 'C라인', eq: [
    { code: 'OVEN-05', name: 'Thermal 05호기', st: 'DOWN', lot: 'LOT-C2406-041', prod: '튜브 과승온', step: 'AL-6003', prog: 0, run: '00:42', cy: '150 WPH', oee: 0 },
    { code: 'CLN-04', name: 'Clean 04호기', st: 'RUN', lot: 'LOT-C2406-052', prod: 'DV-1 / 65nm', step: 'STEP 3/4', prog: 84, run: '06:18', cy: '160 WPH', oee: 88 },
    { code: 'OVEN-06', name: 'Thermal 06호기', st: 'RUN', lot: 'LOT-C2406-053', prod: 'DV-1 / 65nm', step: 'STEP 2/3', prog: 58, run: '03:40', cy: '150 WPH', oee: 85 },
    { code: 'CLN-05', name: 'Clean 05호기', st: 'IDLE', lot: '—', prod: '대기 (배스 안정화)', step: 'STEP 0/4', prog: 0, run: '00:08', cy: '160 WPH', oee: 86 },
    { code: 'ETCH-07', name: 'Etch 07호기', st: 'RUN', lot: 'LOT-C2406-054', prod: 'DV-1 / 65nm', step: 'STEP 8/9', prog: 91, run: '05:02', cy: '90 WPH', oee: 82 },
    { code: 'DEP-08', name: 'Depo 08호기', st: 'STOP', lot: '—', prod: '생산 정지 (Idle)', step: '—', prog: 0, run: '02:15', cy: '110 WPH', oee: 0 },
  ] },
];

const ALL = BOARD.flatMap((b) => b.eq);
const STS = Object.keys(AND) as St[];
const COUNT = Object.fromEntries(STS.map((k) => [k, ALL.filter((e) => e.st === k).length])) as Record<St, number>;
const RUN_RATE = Math.round((COUNT.RUN / ALL.length) * 100);

const EVENTS: Array<{ t: string; st: St; eq: string; msg: string }> = [
  { t: '14:22:08', st: 'DOWN', eq: 'OVEN-05', msg: 'AL-6003 튜브 과승온 — 설비 정지' },
  { t: '14:18:41', st: 'RUN', eq: 'ETCH-07', msg: 'LOT-C2406-054 STEP 8 진입' },
  { t: '14:11:55', st: 'IDLE', eq: 'IMP-03', msg: '자재 입고 대기로 전환' },
  { t: '14:05:12', st: 'PM', eq: 'PHO-06', msg: '정기 PM 시작 — 광원 교체' },
  { t: '13:58:30', st: 'RUN', eq: 'CMP-02', msg: 'LOT-A2406-118 가동 재개' },
  { t: '13:49:07', st: 'STOP', eq: 'DEP-08', msg: '계획 정지 (Idle) 전환' },
  { t: '13:40:22', st: 'RUN', eq: 'CLN-04', msg: 'LOT-C2406-052 STEP 3 진입' },
  { t: '13:31:48', st: 'IDLE', eq: 'ETCH-01', msg: '레시피 대기 상태' },
];

function StatTile({ k }: { k: St }) {
  const a = AND[k];
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-panel px-4 py-3" style={{ borderLeft: `4px solid ${a.c}` }}>
      <span className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: a.c }}>{COUNT[k]}</span>
      <div className="flex flex-col">
        <span className="text-[12px] font-bold text-ink">{a.ko}</span>
        <span className="text-[9.5px] text-ink3">{Math.round((COUNT[k] / ALL.length) * 100)}%</span>
      </div>
    </div>
  );
}

function EqTile({ e }: { e: Eq }) {
  const a = AND[e.st];
  const down = e.st === 'DOWN';
  return (
    <div className="overflow-hidden rounded-[11px] border bg-panel" style={{ borderColor: down ? a.c : 'var(--color-border)', boxShadow: down ? `0 0 0 3px ${a.soft}` : 'none' }}>
      <div className="flex items-center justify-between border-b border-border px-2.5 py-2" style={{ background: a.soft }}>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] font-extrabold text-ink">{e.name}</span>
          <span className="font-mono text-[9px] text-ink3">{e.code}</span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold text-white" style={{ background: a.c }}>
          {down && <span className="and-pulse h-1.5 w-1.5 rounded-full bg-white" />}{a.ko}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-2.5 py-2.5">
        <div className="flex min-h-[30px] flex-col gap-0.5">
          <span className="truncate text-[11.5px] font-bold" style={{ color: down ? a.c : 'var(--color-ink)' }}>{e.prod}</span>
          <span className="font-mono text-[9.5px] text-ink3">{e.lot} · {e.step}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-panel-alt">
          <div className="h-full rounded" style={{ width: `${e.prog}%`, background: a.c }} />
        </div>
        <div className="flex items-center justify-between text-[9.5px] text-ink3">
          <span className="flex items-center gap-1">⏱ <b className="font-mono text-ink2">{e.run}</b></span>
          <span>{e.cy}</span>
          <span>OEE <b className={e.oee >= 85 ? 'text-ok' : e.oee > 0 ? 'text-amber' : 'text-ink3'}>{e.oee || '—'}</b></span>
        </div>
      </div>
    </div>
  );
}

/** 실시간 설비 가동 (Andon) — 와이어프레임 equip-andon.jsx 정본. */
export default function EquipAndonScreen() {
  const donut = STS.filter((k) => COUNT[k] > 0).map((k) => ({ name: AND[k].ko, v: COUNT[k], c: AND[k].c }));
  return (
    <div className="flex flex-col gap-3.5">
      <style>{`@keyframes andPulse{0%,100%{opacity:1}50%{opacity:.25}} .and-pulse{animation:andPulse 1s infinite}`}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">실시간 설비 가동 (Andon)</h1>
          <p className="mt-0.5 text-xs text-ink3">설비 관리 / 설비 상태 모니터링 / 실시간 설비 가동(Andon)</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-ink3"><span className="and-pulse h-[7px] w-[7px] rounded-full bg-ok" />LIVE · 10초 자동 갱신</span>
          <span className="font-mono text-[12px] font-bold text-ink">2026-06-10 14:22:30</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex min-w-[132px] flex-col gap-0.5 rounded-[10px] bg-navy px-[18px] py-3">
          <span className="text-[10px] font-semibold text-white/65">전체 가동률</span>
          <span className="text-[26px] font-extrabold leading-none tabular-nums text-white">{RUN_RATE}<span className="text-[13px]">%</span></span>
          <span className="text-[9.5px] text-white/60">가동 {COUNT.RUN} / 총 {ALL.length}대</span>
        </div>
        {STS.map((k) => <StatTile key={k} k={k} />)}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3.5">
          {BOARD.map((grp) => (
            <Card
              key={grp.line}
              title={grp.line}
              action={<span className="flex gap-1.5">{STS.map((k) => { const n = grp.eq.filter((e) => e.st === k).length; return n ? <span key={k} className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: AND[k].c }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: AND[k].c }} />{n}</span> : null; })}</span>}
              bodyClassName="p-3"
            >
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                {grp.eq.map((e) => <EqTile key={e.code} e={e} />)}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-3.5">
          <Card title="상태 분포">
            <div className="flex flex-col items-center gap-3">
              <Donut data={donut} size={140} thickness={20} centerTop={`${ALL.length}대`} centerSub="전체 설비" />
              <div className="grid w-full grid-cols-2 gap-x-3.5 gap-y-1.5">
                {STS.map((k) => (
                  <div key={k} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: AND[k].c }} />
                    <span className="font-semibold text-ink2">{AND[k].ko}</span>
                    <span className="ml-auto font-extrabold tabular-nums text-ink">{COUNT[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="실시간 이벤트" action={<span className="text-[10px] text-ink3">최근 8건</span>} bodyClassName="p-0">
            <div className="max-h-[420px] overflow-y-auto">
              {EVENTS.map((ev, i) => (
                <div key={i} className="flex items-start gap-2.5 border-b border-border px-3 py-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: AND[ev.st].c }} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-ink3">{ev.t}</span>
                      <span className="text-[10px] font-extrabold" style={{ color: AND[ev.st].c }}>{ev.eq}</span>
                    </div>
                    <span className="text-[11px] leading-snug text-ink2">{ev.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
