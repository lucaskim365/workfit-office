import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { addDays, diffDays, isDone, isLate, leftText, liveOf, mdAvgRaw, monthDay, shortName, spanOf } from '@/domain/pm/rules';
import type { PmTask } from '@/domain/pm/schema';
import { usePmDerived } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint } from './parts';

/**
 * 간트 (schedGantt 4094): 사업 칩 → 사업 막대(실적 채움) + 단계 막대(완료·진행·예정·지연 색),
 * 다음 마일스톤 1개(이름표) · 놓친 마일스톤(빨강) · 오늘 선 · 기준선과 다를 때 회색 선.
 * 과거는 오늘 기준 6개월까지만.
 */
export function GanttView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const [params, setParams] = useSearchParams();
  const [gk, setGk] = useState('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!d) return <EmptyHint title="불러오는 중입니다" />;
  const { snap, today, liveMap } = d;
  const L = (t: PmTask) => liveMap.get(t.id) ?? liveOf(t);
  const ssAll = snap.projects.filter((p) => p.start && p.end);
  if (!ssAll.length) return <EmptyHint title="기간이 들어간 사업이 없습니다" hint="기준정보 › 사업에서 사업 기간을 넣으면 간트에 나옵니다." />;
  const k = ssAll.some((s) => s.id === gk) ? gk : 'all';
  const ss = ssAll.filter((s) => k === 'all' || s.id === k);
  const name = (id: string) => shortName(snap.projects.find((p) => p.id === id)!, snap.projects);

  const m6 = addDays(today, -183);
  const minStart = ss.reduce((a, s) => (s.start < a ? s.start : a), ss[0].start);
  const R0 = `${[minStart, m6].sort()[1].slice(0, 8)}01`;
  const last = ss.reduce((a, s) => (s.end > a ? s.end : a), ss[0].end);
  const months: string[] = [];
  const cur = new Date(+R0.slice(0, 4), +R0.slice(5, 7) - 1, 1);
  const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-01`;
  while (fmt(cur) <= last) {
    months.push(`${String(cur.getFullYear()).slice(2)}.${cur.getMonth() + 1}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  const R1 = fmt(cur);
  const TOT = diffDays(R0, R1);
  const x = (s: string) => Math.max(0, Math.min(100, (diffDays(R0, s) / TOT) * 100));

  const bg = (
    <>
      <div className="absolute inset-0 flex">{months.map((m) => <div key={m} className="flex-1 border-l border-border/70" />)}</div>
      <div className="absolute inset-y-0 w-0.5 bg-danger" style={{ left: `${x(today)}%` }} title={`오늘 ${today}`} />
    </>
  );
  const goList = (pid: string, stage?: string) => {
    const n = new URLSearchParams(params);
    n.set('v', 'task/wbs');
    n.set('k', pid);
    if (stage) n.set('stage', stage);
    else n.delete('stage');
    setParams(n);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant={k === 'all' ? 'primary' : 'secondary'} onClick={() => setGk('all')}>전체</Button>
        {ssAll.map((s) => (
          <Button key={s.id} size="sm" variant={k === s.id ? 'primary' : 'secondary'} onClick={() => setGk(s.id)} title={`${s.company} · ${s.biz}`}>{name(s.id)}</Button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-ink2">
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-3 rounded bg-ok" />완료</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-3 rounded bg-blue" />진행</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-3 rounded bg-ink3/60" />예정</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-3 rounded bg-danger" />지연 포함</span>
        <span><b className="text-amber">◆</b> 다음 마일스톤</span>
        <span><b className="text-danger">◆</b> 놓친 마일스톤</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-0.5 bg-danger" />오늘</span>
        <span className="flex-1" />
        {k === 'all' && (
          <Button size="sm" onClick={() => { const all = ss.every((s) => open[s.id]); setOpen(Object.fromEntries(ss.map((s) => [s.id, !all]))); }}>모두 펼치기/접기</Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <div style={{ minWidth: Math.max(980, 230 + months.length * 48) }}>
          <div className="flex border-b border-border bg-panel-alt text-[10.5px] text-ink3">
            <div className="w-[230px] flex-none px-2.5 py-1.5">사업 / 단계</div>
            <div className="flex flex-1">{months.map((m) => <div key={m} className="flex-1 border-l border-border py-1.5 text-center">{m}</div>)}</div>
          </div>
          {ss.map((s) => {
            const ts = snap.tasks.filter((t) => t.projectId === s.id);
            const act = mdAvgRaw(ts, liveMap);
            const isOpen = k !== 'all' || !!open[s.id];
            const msOpen = ts.filter((t) => t.milestone && !isDone(L(t)) && t.end);
            const miss = msOpen.filter((t) => t.end < today);
            const nx = msOpen.filter((t) => t.end >= today).sort((a, b) => (a.end < b.end ? -1 : 1))[0];
            const stages = [...new Set(ts.map((t) => t.stage))].map((stage) => {
              const g = ts.filter((t) => t.stage === stage);
              const [start, end] = spanOf(g);
              const bl = d.snap.baselines.find((b) => b.id === s.id);
              let bs = '';
              let be = '';
              if (bl) for (const t of g) { const o = bl.map[t.id]; if (!o) continue; if (o.start && (!bs || o.start < bs)) bs = o.start; if (o.end && (!be || o.end > be)) be = o.end; }
              return {
                stage, n: g.length, done: g.filter((t) => isDone(L(t))).length, act: mdAvgRaw(g, liveMap), start, end,
                late: g.some((t) => isLate(t, L(t), today)),
                base: bs && be && (bs !== start || be !== end) ? [bs, be] as const : null,
              };
            });
            return (
              <div key={s.id}>
                <div
                  className={`flex border-b border-border ${k === 'all' ? 'cursor-pointer hover:bg-panel-alt' : ''}`}
                  onClick={() => k === 'all' && setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                >
                  <div className="flex w-[230px] flex-none items-center gap-1.5 px-2.5 py-2 text-[12px] font-bold" title={s.company}>
                    <span className="w-3 text-ink3">{isOpen ? '▾' : '▸'}</span>
                    <span className="rounded bg-navy px-1.5 text-[10.5px] text-white">{name(s.id)}</span>
                    <span className="text-[11px] font-normal text-ink3">{ts.length ? `${Math.round(act)}%` : '업무 목록 작성 전'}</span>
                    {miss.length > 0 && <span className="text-[11px] font-bold text-danger" title={miss.map((t) => `${t.name} (${t.end})`).join(', ')}>놓침 {miss.length}</span>}
                  </div>
                  <div className="relative h-9 flex-1">
                    {bg}
                    <div className="absolute top-2.5 h-4 overflow-hidden rounded bg-navy/25" style={{ left: `${x(s.start)}%`, width: `${x(s.end) - x(s.start)}%` }} title={`${s.start} ~ ${s.end}`}>
                      <i className="block h-full bg-navy" style={{ width: `${act}%` }} />
                    </div>
                    {miss.map((t) => <div key={t.id} className="absolute top-2.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-danger" style={{ left: `${x(t.end)}%` }} title={`놓친 ◆ ${t.name} ${t.end}`} />)}
                    {nx && (
                      <>
                        <div className="absolute top-2.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-amber" style={{ left: `${x(nx.end)}%` }} title={`◆ ${nx.name} ${nx.end}`} />
                        <div className="absolute top-2 whitespace-nowrap text-[10.5px] font-bold text-amber" style={x(nx.end) > 62 ? { right: `calc(${100 - x(nx.end)}% + 10px)` } : { left: `calc(${x(nx.end)}% + 10px)` }}>
                          ◆ {nx.name.slice(0, 16)} · {leftText(nx.end, today)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {isOpen && stages.map((g) => {
                  const col = g.late ? 'bg-danger' : g.done === g.n ? 'bg-ok' : g.start > today ? 'bg-ink3/60' : 'bg-blue';
                  const w = g.start && g.end ? Math.max(0.6, x(g.end) - x(g.start)) : 0;
                  const lbl = `${monthDay(g.start)}~${monthDay(g.end)} · ${Math.round(g.act)}%`;
                  return (
                    <div key={g.stage} className="flex cursor-pointer border-b border-border hover:bg-panel-alt" onClick={() => goList(s.id, g.stage)} title="눌러서 이 단계의 업무 목록 보기">
                      <div className="w-[230px] flex-none truncate py-1.5 pl-7 pr-2 text-[11.5px] text-ink2" title={g.stage}>{g.stage} <span className="text-[10.5px] text-ink3">{g.done}/{g.n}</span></div>
                      <div className="relative h-7 flex-1">
                        {bg}
                        {g.base && <div className="absolute top-0.5 h-[3px] rounded bg-ink3 opacity-55" style={{ left: `${x(g.base[0])}%`, width: `${Math.max(0.6, x(g.base[1]) - x(g.base[0]))}%` }} title={`기준선 ${g.base[0]} ~ ${g.base[1]}`} />}
                        {w > 0 ? (
                          <>
                            <div className={`absolute top-1.5 flex h-4 items-center overflow-hidden whitespace-nowrap rounded px-1 text-[10px] text-white ${col}`} style={{ left: `${x(g.start)}%`, width: `${w}%` }} title={`${g.start} ~ ${g.end} · 실적 ${Math.round(g.act)}%`}>
                              {w >= 12 ? lbl : ''}
                            </div>
                            {w < 12 && <div className="absolute top-1.5 whitespace-nowrap text-[10px] text-ink2" style={x(g.end) > 80 ? { right: `calc(${100 - x(g.start)}% + 6px)` } : { left: `calc(${x(g.end)}% + 6px)` }}>{lbl}</div>}
                          </>
                        ) : (
                          <div className="absolute left-2 top-1.5 text-[10.5px] text-ink3">일정 없음</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink3">
        ※ 사업 줄을 누르면 단계를 펼칩니다 · 단계를 누르면 그 단계의 업무 목록으로 갑니다 · 단계 막대 위 회색 선 = 기준선(최초 계획)과 다를 때만 표시.
        지금 업무 목록은 시작·종료일이 비어 있어 단계 막대가 "일정 없음"으로 나오는 것이 정상입니다 — 업무에 날짜를 넣으면 막대가 생깁니다.
      </p>
    </div>
  );
}
