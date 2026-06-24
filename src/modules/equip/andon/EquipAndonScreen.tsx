import { useMemo } from 'react';
import { Card } from '@/shared/ui/Card';
import { Donut } from '@/shared/ui/charts/Donut';
import { useAndonStatus } from '@/features/andonStatus/useAndonStatus';
import type { AndonStatus } from '@/domain/andonStatus/schema';

type St = 'RUN' | 'IDLE' | 'STOP' | 'DOWN' | 'PM';
const AND: Record<St, { ko: string; c: string; soft: string }> = {
  RUN: { ko: '가동', c: '#1f9d6b', soft: '#e7f5ee' },
  IDLE: { ko: '대기', c: '#ef8f43', soft: '#fdf0e3' },
  STOP: { ko: '정지', c: '#56607a', soft: '#eef0f4' },
  DOWN: { ko: '고장', c: '#e0564f', soft: '#fdeceb' },
  PM: { ko: '점검', c: '#3a6ee0', soft: '#e9eefc' },
};

/** 안돈 도큐먼트(설비별 1행)는 도메인 타입 AndonStatus 를 그대로 쓴다. */
type Eq = AndonStatus;
const STS = Object.keys(AND) as St[];

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

function StatTile({ k, count, total }: { k: St; count: number; total: number }) {
  const a = AND[k];
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-border bg-panel px-4 py-3" style={{ borderLeft: `4px solid ${a.c}` }}>
      <span className="text-[26px] font-extrabold leading-none tabular-nums" style={{ color: a.c }}>{count}</span>
      <div className="flex flex-col">
        <span className="text-[12px] font-bold text-ink">{a.ko}</span>
        <span className="text-[9.5px] text-ink3">{total ? Math.round((count / total) * 100) : 0}%</span>
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
  const { data: rows = [], isLoading } = useAndonStatus();

  // 안돈 도큐먼트(설비별 1행) → line 별 그룹핑으로 보드 재구성. seed 등장 순서 유지.
  const BOARD = useMemo(() => {
    const map = new Map<string, Eq[]>();
    for (const e of rows) {
      const g = map.get(e.line);
      if (g) g.push(e);
      else map.set(e.line, [e]);
    }
    return [...map.entries()].map(([line, eq]) => ({ line, eq }));
  }, [rows]);

  const ALL = rows;
  const COUNT = useMemo(
    () => Object.fromEntries(STS.map((k) => [k, ALL.filter((e) => e.st === k).length])) as Record<St, number>,
    [ALL],
  );
  const RUN_RATE = ALL.length ? Math.round((COUNT.RUN / ALL.length) * 100) : 0;

  if (!ALL.length) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '설비 안돈 데이터가 없습니다.'}</div>;
  }

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
        {STS.map((k) => <StatTile key={k} k={k} count={COUNT[k]} total={ALL.length} />)}
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
