import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';
import { useScheduleEntries } from '@/features/scheduleEntry/useScheduleEntries';

const START = 8;
const END = 20;
const NOW = 13.5;
const HOURS: number[] = [];
for (let h = START; h <= END; h += 2) HOURS.push(h);

type Status = '진행중' | '대기' | '완료' | '셋업' | '지연위험';
interface Block {
  s: number;
  e: number;
  wo: string;
  prod: string;
  qty: number;
  status: Status;
  setup?: boolean;
}
interface Resource {
  eq: string;
  blocks: Block[];
}

const RESOURCES: Resource[] = [
  { eq: '사출 03호기', blocks: [
    { s: 8, e: 11.5, wo: 'WO-1001', prod: '커넥터 하우징', qty: 4800, status: '진행중' },
    { s: 12, e: 15, wo: 'WO-1005', prod: '센서 커버', qty: 3200, status: '대기' },
    { s: 15, e: 15.5, wo: '', prod: '금형 교체', qty: 0, status: '셋업', setup: true },
    { s: 15.5, e: 19, wo: 'WO-1012', prod: '하우징 캡', qty: 4000, status: '대기' },
  ] },
  { eq: '프레스 01호기', blocks: [
    { s: 8, e: 12, wo: 'WO-1002', prod: '터미널 핀', qty: 12000, status: '진행중' },
    { s: 13, e: 18, wo: 'WO-1008', prod: '브래킷 본체', qty: 6500, status: '대기' },
  ] },
  { eq: '조립셀 A', blocks: [
    { s: 9, e: 14, wo: 'WO-1003', prod: '커넥터 어셈블리', qty: 2400, status: '진행중' },
    { s: 15, e: 19.5, wo: 'WO-1011', prod: '커넥터 어셈블리', qty: 2200, status: '지연위험' },
  ] },
  { eq: 'SMT 라인 2', blocks: [
    { s: 8, e: 13, wo: 'WO-1004', prod: '센서 모듈 PCB', qty: 5400, status: '진행중' },
    { s: 14, e: 20, wo: 'WO-1009', prod: '센서 모듈 PCB', qty: 6000, status: '대기' },
  ] },
  { eq: 'EOL 테스터', blocks: [
    { s: 10, e: 12, wo: 'WO-1006', prod: '기능 검사', qty: 2400, status: '완료' },
    { s: 13, e: 16, wo: 'WO-1007', prod: '기능 검사', qty: 2200, status: '대기' },
  ] },
];

const BLOCK_STYLE: Record<Status, { bg: string; fg: string; border: string }> = {
  진행중: { bg: T.teal, fg: '#fff', border: T.teal },
  대기: { bg: T.blueSoft, fg: T.blue, border: T.blue },
  완료: { bg: T.bgDeep, fg: T.ink3, border: T.bgDeep },
  셋업: { bg: '#fdecea', fg: T.warn, border: T.warn },
  지연위험: { bg: '#fde7e4', fg: T.err, border: T.err },
};

const xPct = (h: number) => ((h - START) / (END - START)) * 100;
const pad2 = (h: number) => String(Math.floor(h)).padStart(2, '0') + ':' + (h % 1 ? '30' : '00');

export default function ScheduleScreen() {
  const { data: UNASSIGNED = [], isLoading } = useScheduleEntries();

  const allBlocks = RESOURCES.flatMap((r) => r.blocks.filter((b) => !b.setup));
  const totalWo = allBlocks.length;
  const totalQty = allBlocks.reduce((s, b) => s + b.qty, 0);
  const loads = RESOURCES.map((r) => (r.blocks.reduce((s, b) => s + (b.e - b.s), 0) / (END - START)) * 100);
  const avgLoad = Math.round(loads.reduce((s, v) => s + v, 0) / loads.length);
  const atRisk = allBlocks.filter((b) => b.status === '지연위험').length + UNASSIGNED.filter((o) => o.urgent).length;

  const kpis: Array<[string, string, string, string]> = [
    ['금일 작업지시', String(totalWo), '건', 'text-ink'],
    ['계획 수량', totalQty.toLocaleString(), 'EA', 'text-ink'],
    ['평균 설비 부하율', String(avgLoad), '%', avgLoad >= 85 ? 'text-amber' : 'text-teal'],
    ['납기 임박/위험', String(atRisk), '건', 'text-danger'],
    ['미배정 오더', String(UNASSIGNED.length), '건', 'text-amber'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">일일 생산 스케줄링</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 계획·지시 / 일일 생산 스케줄링</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-[7px] border border-border-hi bg-panel px-3 py-1.5 font-mono text-[11.5px] font-bold text-ink">◷ 2026-06-21 (금)</span>
          <ActionBar actions={[{ preset: 'refresh', label: '자동 스케줄' }, 'save', 'download']} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c]) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${c}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_300px]">
        {/* 간트 */}
        <Card
          title="설비별 생산 스케줄 (Gantt)"
          action={
            <div className="flex gap-3 text-[10px]">
              {(['진행중', '대기', '지연위험', '셋업'] as Status[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5 font-semibold text-ink2">
                  <span className="h-[9px] w-[9px] rounded-sm" style={{ background: BLOCK_STYLE[k].bg, border: k === '대기' ? `1px solid ${T.blue}` : 'none' }} />
                  {k}
                </span>
              ))}
            </div>
          }
          bodyClassName="p-0"
        >
          {/* 시간 헤더 */}
          <div className="flex border-b border-border bg-panel-alt">
            <div className="w-[120px] shrink-0 border-r border-border px-3 py-2 text-[10px] font-bold text-ink3">설비 / 부하</div>
            <div className="relative h-[30px] flex-1">
              {HOURS.map((h) => (
                <span key={h} style={{ left: `${xPct(h)}%` }} className="absolute top-2 -translate-x-1/2 font-mono text-[9.5px] font-semibold text-ink3">{pad2(h)}</span>
              ))}
            </div>
          </div>
          {/* 행 */}
          <div className="relative">
            {RESOURCES.map((r, ri) => (
              <div key={r.eq} className="flex min-h-[46px] border-b border-border">
                <div className={`w-[120px] shrink-0 border-r border-border px-3 py-2 ${ri % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                  <div className="text-[11px] font-bold text-ink">{r.eq}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1 flex-1 rounded-sm bg-bg-deep">
                      <div className="h-full rounded-sm" style={{ width: `${loads[ri]}%`, background: loads[ri] >= 85 ? T.warn : T.teal }} />
                    </div>
                    <span className="font-mono text-[8.5px] font-bold" style={{ color: loads[ri] >= 85 ? T.warn : T.ink3 }}>{Math.round(loads[ri])}%</span>
                  </div>
                </div>
                <div className={`relative flex-1 ${ri % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                  {HOURS.map((h) => (
                    <div key={h} style={{ left: `${xPct(h)}%` }} className="absolute bottom-0 top-0 w-px bg-border opacity-60" />
                  ))}
                  {r.blocks.map((b, bi) => {
                    const st = BLOCK_STYLE[b.status];
                    return (
                      <div
                        key={bi}
                        title={`${b.wo} ${b.prod}`}
                        style={{
                          left: `${xPct(b.s)}%`,
                          width: `${xPct(b.e) - xPct(b.s)}%`,
                          background: b.setup ? 'repeating-linear-gradient(45deg,#fdecea,#fdecea 4px,#fff 4px,#fff 8px)' : st.bg,
                          border: `1px solid ${st.border}`,
                        }}
                        className="absolute bottom-1.5 top-1.5 flex flex-col justify-center overflow-hidden rounded-md px-2"
                      >
                        {!b.setup ? (
                          <>
                            <span className="truncate text-[10px] font-extrabold" style={{ color: st.fg }}>{b.prod}</span>
                            <span className="truncate font-mono text-[8.5px] opacity-85" style={{ color: st.fg }}>{b.wo} · {b.qty.toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="whitespace-nowrap text-[8.5px] font-bold text-amber">⚙ 셋업</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* 현재 시각 라인 */}
            <div className="pointer-events-none absolute bottom-0 top-0 z-[2] w-0.5 bg-danger" style={{ left: `calc(120px + (100% - 120px) * ${(xPct(NOW) / 100).toFixed(4)})` }}>
              <span className="absolute -left-4 -top-px whitespace-nowrap rounded bg-danger px-1.5 py-px text-[8.5px] font-extrabold text-white">{pad2(NOW)}</span>
            </div>
          </div>
        </Card>

        {/* 미배정 오더 + 부하 */}
        <div className="flex flex-col gap-3.5">
          <Card title="미배정 오더" action={<Pill tone="warn">{UNASSIGNED.length}</Pill>} bodyClassName="p-0">
            {isLoading || UNASSIGNED.length === 0 ? (
              <div className="grid place-items-center py-10 text-[12px] text-ink3">
                {isLoading ? '불러오는 중…' : '미배정 오더가 없습니다.'}
              </div>
            ) : (
            <div className="py-1">
              {UNASSIGNED.map((o, i) => (
                <div key={o.wo} className={`cursor-grab px-4 py-3 ${i < UNASSIGNED.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11.5px] font-bold text-ink">{o.prod}</span>
                    <span className={`rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-extrabold ${o.urgent ? 'bg-[#fdecea] text-danger' : 'bg-panel-alt text-ink3'}`}>{o.due}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9.5px] text-ink3">{o.wo} · {o.qty.toLocaleString()} EA</span>
                    <span className="text-[9.5px] text-ink3">⠿ 드래그 배정</span>
                  </div>
                </div>
              ))}
            </div>
            )}
            <div className="border-t border-border bg-panel-alt p-3">
              <button className="w-full rounded-[9px] bg-navy py-2.5 text-[12px] font-extrabold text-white">자동 배정 실행</button>
            </div>
          </Card>

          <Card title="설비 부하율">
            <div className="flex flex-col gap-2.5">
              {RESOURCES.map((r, i) => (
                <div key={r.eq} className="flex items-center gap-2">
                  <span className="w-[78px] truncate text-[10.5px] font-semibold text-ink2">{r.eq}</span>
                  <div className="h-[7px] flex-1 rounded bg-bg-deep">
                    <div className="h-full rounded" style={{ width: `${loads[i]}%`, background: loads[i] >= 85 ? T.err : loads[i] >= 70 ? T.warn : T.teal }} />
                  </div>
                  <span className="w-8 text-right font-mono text-[10.5px] font-bold" style={{ color: loads[i] >= 85 ? T.err : T.ink2 }}>{Math.round(loads[i])}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
