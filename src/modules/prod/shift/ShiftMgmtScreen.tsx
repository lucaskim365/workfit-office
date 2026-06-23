import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { T } from '@/shared/theme/tokens';

interface Shift {
  code: string;
  name: string;
  start: number;
  end: number;
  brk: number;
  net: number;
  c: string;
}
const SHIFTS: Shift[] = [
  { code: 'D', name: '주간 (Day)', start: 8, end: 20, brk: 90, net: 10.5, c: T.teal },
  { code: 'N', name: '야간 (Night)', start: 20, end: 8, brk: 90, net: 10.5, c: T.navy },
  { code: 'A', name: '상주 (관리)', start: 9, end: 18, brk: 60, net: 8.0, c: T.blue },
];

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TODAY_IDX = 4;

const ROTATION = [
  { crew: 'A조', lead: '김주임', n: 8, plan: ['주간', '주간', '야간', '야간', '휴무', '휴무', '주간'] },
  { crew: 'B조', lead: '이주임', n: 8, plan: ['야간', '야간', '휴무', '휴무', '주간', '주간', '야간'] },
  { crew: 'C조', lead: '박주임', n: 7, plan: ['휴무', '휴무', '주간', '주간', '야간', '야간', '휴무'] },
];

const SHIFT_TONE: Record<string, { bg: string; fg: string; bd: string }> = {
  주간: { bg: T.tealSoft, fg: T.teal, bd: T.teal },
  야간: { bg: '#e7eaf3', fg: T.navy, bd: T.navy },
  휴무: { bg: T.panelAlt, fg: T.ink3, bd: T.border },
};

const pad2 = (h: number) => String(h).padStart(2, '0') + ':00';

function ShiftTimeline({ start, end, c }: { start: number; end: number; c: string }) {
  const segs: Array<[number, number]> = end > start ? [[start, end]] : [[start, 24], [0, end]];
  return (
    <div className="relative h-[26px] overflow-hidden rounded-md bg-bg-deep">
      {[6, 12, 18].map((h) => (
        <div key={h} className="absolute bottom-0 top-0 w-px bg-border" style={{ left: `${(h / 24) * 100}%` }} />
      ))}
      {segs.map(([s, e], i) => (
        <div key={i} className="absolute bottom-[3px] top-[3px] flex items-center justify-center rounded" style={{ left: `${(s / 24) * 100}%`, width: `${((e - s) / 24) * 100}%`, background: c }}>
          {e - s >= 4 && <span className="font-mono text-[9px] font-bold text-white">{String(s).padStart(2, '0')}–{String(e === 24 ? 0 : e).padStart(2, '0')}</span>}
        </div>
      ))}
    </div>
  );
}

/** 근무조(Shift) 관리 — 와이어프레임 shift-mgmt.jsx 정본. */
export default function ShiftMgmtScreen() {
  const todayHeads = ROTATION.filter((r) => r.plan[TODAY_IDX] !== '휴무').reduce((s, r) => s + r.n, 0);
  const totalHeads = ROTATION.reduce((s, r) => s + r.n, 0);
  const weeklyHours = SHIFTS[0].net * 4;

  const kpis: Array<[string, string, string, string]> = [
    ['근무조', String(SHIFTS.length), '조', 'text-ink'],
    ['운영 패턴', '2교대', '3조', 'text-blue'],
    ['금일 근무 인원', String(todayHeads), '명', 'text-teal'],
    ['주 표준근무', String(weeklyHours), 'h', 'text-ink'],
    ['교대 휴게', '90', '분', 'text-ink'],
  ];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">근무조(Shift) 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">생산 관리 / 생산 기준정보 / 근무조(Shift) 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '근무조 등록', variant: 'primary' }, 'save', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([l, v, u, c], i) => (
          <div key={l} className="rounded-xl border border-border bg-panel px-4 py-3.5">
            <div className="mb-1.5 text-[10.5px] font-semibold text-ink3">{l}</div>
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold tracking-tight tabular-nums ${c} ${i === 1 ? 'text-[19px]' : 'text-2xl'}`}>{v}</span>
              <span className="text-[11px] font-semibold text-ink3">{u}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[340px_1fr]">
        <Card title="근무조 정의">
          <div className="flex flex-col gap-3.5">
            {SHIFTS.map((s) => (
              <div key={s.code} className="rounded-[10px] border border-border px-3 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.c }} />
                    <span className="text-[12.5px] font-extrabold text-ink">{s.name}</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-ink2">{pad2(s.start)}–{pad2(s.end)}</span>
                </div>
                <ShiftTimeline start={s.start} end={s.end} c={s.c} />
                <div className="mt-2 flex justify-between text-[10px]">
                  <span className="text-ink3">총 시간 <b className="font-mono text-ink2">{s.end > s.start ? s.end - s.start : 24 - s.start + s.end}h</b></span>
                  <span className="text-ink3">휴게 <b className="font-mono text-ink2">{s.brk}분</b></span>
                  <span className="text-ink3">실근무 <b className="font-mono" style={{ color: s.c }}>{s.net}h</b></span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[9.5px] text-ink3">
            <span>0</span>
            <div className="relative h-px flex-1 bg-border">
              {[6, 12, 18].map((h) => (
                <span key={h} className="absolute -top-[7px] -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>{h}</span>
              ))}
            </div>
            <span>24시</span>
          </div>
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card title="주간 근무 로테이션" action={<span className="text-[10px] text-ink3">이번 주 · 금요일 기준</span>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-border bg-panel-alt px-3.5 py-2.5 text-left text-[10.5px] font-bold text-ink2">근무조</th>
                    {DAYS.map((d, i) => (
                      <th key={d} className={`border-b border-border px-0 py-2.5 text-center text-[10.5px] font-bold ${i === TODAY_IDX ? 'bg-teal-soft text-teal' : i >= 5 ? 'bg-panel-alt text-danger' : 'bg-panel-alt text-ink2'}`}>
                        {d}{i === TODAY_IDX && <div className="text-[8px] font-extrabold">오늘</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROTATION.map((r, ri) => (
                    <tr key={r.crew}>
                      <td className={`border-b border-border px-3.5 py-2 ${ri % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                        <div className="text-[12px] font-extrabold text-ink">{r.crew}</div>
                        <div className="mt-px text-[9.5px] text-ink3">{r.lead} · {r.n}명</div>
                      </td>
                      {r.plan.map((p, di) => {
                        const t = SHIFT_TONE[p];
                        return (
                          <td key={di} className={`border-b border-border px-1 py-1.5 text-center ${di === TODAY_IDX ? 'bg-teal/[0.06]' : ri % 2 ? 'bg-panel-alt' : 'bg-panel'}`}>
                            <span className="inline-block min-w-[40px] rounded-md border px-1.5 py-1 text-[10px] font-bold" style={{ color: t.fg, background: t.bg, borderColor: p === '휴무' ? T.border : t.bd }}>{p}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3.5 border-t border-border bg-panel-alt px-4 py-2.5">
              {Object.keys(SHIFT_TONE).map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink2">
                  <span className="h-3 w-3 rounded-[3px] border" style={{ background: SHIFT_TONE[k].bg, borderColor: k === '휴무' ? T.border : SHIFT_TONE[k].bd }} />{k}
                </span>
              ))}
              <span className="ml-auto text-[10.5px] text-ink3">4조 3교대 대비 <b className="text-ink2">2교대 3조 로테이션</b> 운영</span>
            </div>
          </Card>

          <Card title="조 편성 / 인원">
            <div className="grid grid-cols-3 gap-3">
              {ROTATION.map((r) => {
                const todayShift = r.plan[TODAY_IDX];
                const t = SHIFT_TONE[todayShift];
                return (
                  <div key={r.crew} className="rounded-[10px] border border-border px-3.5 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-ink">{r.crew}</span>
                      <span className="rounded-md border px-2 py-0.5 text-[9.5px] font-bold" style={{ color: t.fg, background: t.bg, borderColor: todayShift === '휴무' ? T.border : t.bd }}>오늘 {todayShift}</span>
                    </div>
                    <div className="mb-1.5 flex items-baseline gap-1">
                      <span className="text-[22px] font-extrabold tabular-nums text-ink">{r.n}</span>
                      <span className="text-[10.5px] font-semibold text-ink3">명</span>
                    </div>
                    <div className="text-[10.5px] text-ink3">조장 <b className="text-ink2">{r.lead}</b></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-[10.5px]">
              <span className="text-ink3">총 작업 인원 <b className="text-ink">{totalHeads}명</b></span>
              <span className="text-ink3">금일 근무 <b className="text-teal">{todayHeads}명</b> · 휴무 <b className="text-ink2">{totalHeads - todayHeads}명</b></span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
