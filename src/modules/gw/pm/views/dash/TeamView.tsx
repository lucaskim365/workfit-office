import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { leftText, monthDay, shortName } from '@/domain/pm/rules';
import { agoText } from '@/domain/pm/site';
import {
  HOUR_PERIODS, LOAD_WEEKS, PERSON_WBS, hourRange, hourSummary, hourText, loadCell, loadOrder, loadWeeks, projectNum, reassignList, teamRows,
  type HourPeriod, type HourRow, type PersonTab,
} from '@/domain/pm/team';
import { usePmDerived, usePmMutations, usePmSiteMutations, type PmDerived } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag } from '../wbs/parts';
import { CardHead, ScreenHead } from './parts';
import { PersonModal } from './PersonModal';

/**
 * 대시보드 › 팀 현황 — 오늘 (pTeam 3579) · 앞으로 4주 (schedLoad 4164) · 투입 시간 (pHours 8299). 3-4단계.
 * 숫자는 모두 업무 목록의 담당 · 날짜 · 진행률로 계산한다 (입력 칸 없음).
 */
const inp = 'rounded border border-border-hi bg-panel px-2 py-1 text-[12px]';

interface PersonPop { who: string; k: string; tab: PersonTab }

/** 세 보기가 같이 쓰는 것: 사람 · 계산값 · 업무 창 · 사람별 업무 팝업 · 업무 목록으로 가기 */
function useTeamBase() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [, setParams] = useSearchParams();
  const [pop, setPop] = useState<PersonPop | null>(null);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id || '사내 · 기타'; };
  const modals = usePmModals({ d, people, mut, shortOf });
  /** 업무 목록으로 (wbsGoto) — 사업 · 담당 · 기간 · 상태 */
  const goWbs = (o: { k: string; who: string; period: string; st?: string }) => {
    const next = new URLSearchParams();
    next.set('v', 'task/wbs');
    if (o.k !== 'all') next.set('k', o.k);
    next.set('who', o.who);
    next.set('period', o.period);
    if (o.st && o.st !== 'open') next.set('st', o.st);
    setParams(next);
  };
  const node = d && (
    <>
      {pop && (
        <PersonModal who={pop.who} k={pop.k} tab={pop.tab} d={d} label={people.labelOf(pop.who)} shortOf={shortOf} nameOf={people.nameOf}
          onChange={(k, tab) => setPop({ ...pop, k, tab })}
          onOpenTask={(id) => modals.openTask(id)}
          onGoWbs={() => goWbs({ k: pop.k, who: pop.who, ...PERSON_WBS[pop.tab] })}
          onClose={() => setPop(null)} />
      )}
      {modals.node}
    </>
  );
  return { people, d, shortOf, modals, goWbs, openPerson: (who: string, k: string, tab: PersonTab) => setPop({ who, k, tab }), node };
}

/** 사업 고르기 (sitePk) — 업무가 있거나 협약 시작일이 있는 사업, 번호 순 */
function SitePick({ d, value, onChange }: { d: PmDerived; value: string; onChange: (k: string) => void }) {
  const ps = d.snap.projects.filter((p) => p.start || d.snap.tasks.some((t) => t.projectId === p.id)).sort((a, b) => projectNum(a.id) - projectNum(b.id));
  return (
    <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">전체 사업</option>
      {ps.map((p) => <option key={p.id} value={p.id}>{shortName(p, d.snap.projects)} · {p.company}</option>)}
    </select>
  );
}

const Initials = ({ name }: { name: string }) => (
  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{name.slice(-2)}</span>
);

// ── 오늘 ─────────────────────────────────────────────

export function TeamTodayView() {
  const B = useTeamBase();
  const { d, people, shortOf } = B;
  const [k, setK] = useState('all');
  const rows = useMemo(() => {
    if (!d) return [];
    return teamRows(people.people.map((p) => ({ id: p.id, dept: p.dept })), { tasks: d.snap.tasks, liveMap: d.liveMap, projects: d.snap.projects, today: d.today, tickets: d.snap.tickets, logs: d.snap.logs }, k);
  }, [d, people.people, k]);
  if (!d) return <EmptyHint title="팀 현황을 불러오는 중입니다" />;
  const today = d.today;
  const nLate = rows.filter((r) => r.late).length;
  const nStale = rows.filter((r) => r.stale).length;
  const deptOf = (id: string) => people.people.find((p) => p.id === id)?.dept ?? '';
  /** 그 사람이 '나중에'로 내린 업무 수 (pTeam later) */
  const laterN = (id: string, ts: readonly { id: string }[]) => { const s = new Set(d.snap.later.find((x) => x.id === id)?.taskIds ?? []); return ts.filter((t) => s.has(t.id)).length; };

  const num = (v: number, label: string, tone: string, tab: PersonTab, who: string) => (
    <button type="button" onClick={() => B.openPerson(who, k, tab)} title={`눌러서 ${label} 업무 보기`}
      className={`rounded-md px-1 py-1 text-center hover:bg-panel-alt ${v ? tone : 'text-ink3'}`}>
      <b className="block text-[18px] leading-tight">{v}</b>
      <span className="whitespace-nowrap text-[10.5px] text-ink3">{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <ScreenHead title="팀 현황" desc="팀원별로 오늘 할 일 · 지연 · 이번 주 마감을 봅니다 · [앞으로 4주]에서 마감이 몰리는 주를 봅니다" />
      <div className="flex flex-wrap items-center gap-2">
        <SitePick d={d} value={k} onChange={setK} />
        <span className="flex-1" />
        <span className="text-[11.5px] text-ink3">팀원 {rows.length}명 · 지연 보유 {nLate}명 · 일주일 넘게 업데이트 없음 {nStale}명</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-border-hi text-[12px] font-bold">
          <button type="button" disabled title="팀원이 업무계획에 올린 오늘 할 일 — 업무계획 화면(3-6)을 옮기면 켭니다" className="cursor-not-allowed px-3 py-1 text-ink3">오늘 계획 (3-6)</button>
          <button type="button" className="border-l border-border-hi bg-navy px-3 py-1 text-white" title="일정상 오늘이 업무 기간 안에 있는 업무">기간 중 업무</button>
        </div>
        <span className="text-[11px] text-ink3">카드 가운데에 보여 줄 것</span>
        <span className="flex-1" />
        <Button size="sm" disabled title="팀원들의 오늘 일일 업무 보고를 한 PDF로 묶기 — 업무계획(3-6)과 같이 옮깁니다">팀 일일 보고 모아 받기 (3-6)</Button>
      </div>

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((r) => {
            const name = people.nameOf(r.id);
            return (
              <div key={r.id} className={`flex flex-col rounded-xl border bg-panel shadow-sm ${r.late ? 'border-danger/40' : 'border-border'} ${r.stale ? 'bg-panel-alt' : ''}`}>
                <div className="flex items-center gap-2.5 px-3.5 pt-3">
                  <Initials name={name} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] text-ink">{people.labelOf(r.id)}</b>
                    <small className="block truncate text-[11px] text-ink3">{deptOf(r.id) || '부서 없음'}</small>
                  </div>
                  <span className={`whitespace-nowrap rounded px-1.5 py-px text-[10.5px] font-bold ${r.stale ? 'bg-amber/15 text-amber' : 'text-ink3'}`} title={`마지막 업데이트 ${r.last || '없음'} (변경 이력 · 티켓 처리)`}>
                    {r.stale ? '⏸ ' : ''}{agoText(r.last, today)}
                  </span>
                </div>
                <div className="mx-3.5 mt-2.5 grid grid-cols-4 gap-1 rounded-lg border border-border">
                  {num(r.late, '지연', 'text-danger', 'late', r.id)}
                  {num(r.week, '7일 내 마감', 'text-amber', 'week', r.id)}
                  {num(r.period, '진행 중', 'text-ink', 'now', r.id)}
                  {num(r.doneN, '완료', 'text-ok', 'done', r.id)}
                </div>
                <div className="min-h-[68px] flex-1 px-3.5 py-2 text-[12px]">
                  {r.today.length ? r.today.slice(0, 3).map((t) => (
                    <button key={t.id} type="button" onClick={() => B.modals.openTask(t.id)} className="flex w-full items-center gap-1.5 py-0.5 text-left hover:text-teal">
                      <ProjectTag>{shortOf(t.projectId)}</ProjectTag>
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="whitespace-nowrap text-[11px] text-ink3">{d.liveMap.get(t.id)?.pct ?? 0}% · {leftText(t.end, today)}</span>
                    </button>
                  )) : <span className="text-ink3">기간 중 업무 없음</span>}
                </div>
                <div className="flex items-center gap-1.5 border-t border-border px-3.5 py-2">
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">{r.ks.map((x) => <ProjectTag key={x}>{shortOf(x)}</ProjectTag>)}</span>
                  <Button size="sm" variant="secondary" onClick={() => B.openPerson(r.id, k, 'all')}>업무 {r.ts.length}{laterN(r.id, r.ts) ? ` · 나중에 ${laterN(r.id, r.ts)}` : ''} →</Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          <EmptyHint title="맡은 업무가 있는 팀원이 없습니다" hint={<>업무 목록에서 업무에 <b>담당</b>을 넣거나 티켓을 발행하면 그 사람이 여기 나옵니다. 전체 사업을 볼 때는 {`'데이터플랫폼 개발팀'`} 부서 사람은 업무가 없어도 나옵니다.</>} />
        </section>
      )}
      <p className="text-[11px] text-ink3">※ 지연 많은 사람부터 · 회색 카드 = 급한 업무(지연 · 7일 내 마감 · 진행 중)가 있는데 일주일 넘게 업데이트(변경 이력 · 티켓 처리)가 없음 · 숫자를 누르면 그 업무 목록 · 협약 이전 · 탈락 사업 업무는 세지 않음</p>
      {B.node}
    </div>
  );
}

// ── 앞으로 4주 ───────────────────────────────────────

const CELL_TONE = { none: '', low: 'bg-teal/25', mid: 'bg-amber/30', full: 'bg-amber/55', over: 'bg-danger/35' } as const;

export function TeamLoadView() {
  const B = useTeamBase();
  const { d, people, shortOf } = B;
  const smut = usePmSiteMutations(people.me);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const L = useMemo(() => (d ? loadWeeks({ tasks: d.snap.tasks, liveMap: d.liveMap, projects: d.snap.projects, today: d.today }) : null), [d]);
  if (!d || !L) return <EmptyHint title="팀 현황을 불러오는 중입니다" />;
  const max = d.snap.settings.loadMax;
  const ids = people.people.map((p) => p.id);
  const order = loadOrder(ids, L.m);
  const over = reassignList(ids, L.m, max, d.snap.tasks);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const wkName = (i: number) => (i === 0 ? '이번 주' : i === 1 ? '다음 주' : `${i}주 뒤`);
  const projName = (id: string) => d.snap.projects.find((p) => p.id === id)?.company ?? id;

  return (
    <div className="space-y-4">
      <ScreenHead title="팀 현황" desc="팀원별로 앞으로 4주 동안 마감이 몰리는 주와 일을 나눠야 할 사람을 봅니다">
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink2">몰림 기준 주당 마감
          <input type="number" min={1} max={50} defaultValue={max} key={max} onBlur={(e) => { if (+e.target.value !== max) void smut.setLoadMax.mutateAsync(+e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={`${inp} w-[70px]`} />건
        </label>
      </ScreenHead>

      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <CardHead title={`사람별 업무량 (앞으로 ${LOAD_WEEKS}주)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-ink3">
                <th className="px-4 py-2">담당자</th>
                {L.ws.map((w, i) => <th key={w.s} className="min-w-[150px] px-2 py-2">{wkName(i)}<div className="font-normal">{monthDay(w.s)}~{monthDay(w.e)}</div></th>)}
                <th className="px-4 py-2 text-right">지연</th>
              </tr>
            </thead>
            <tbody>
              {order.map((id) => {
                const r = L.m.get(id)!;
                const on = open.has(id);
                const ks = [...r.ks].sort((a, b) => projectNum(a) - projectNum(b));
                return (
                  <Fragment key={id}>
                    <tr onClick={() => toggle(id)} className="cursor-pointer border-b border-border hover:bg-panel-alt" title="눌러서 사업별로 보기">
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className="mr-1.5 inline-block w-2.5 text-ink3">{on ? '▾' : '▸'}</span>
                        <b className="text-ink">{people.labelOf(id)}</b>
                        <span className="ml-1.5 text-[11px] text-ink3">사업 {ks.length}개</span>
                      </td>
                      {r.w.map((n, i) => {
                        const c = loadCell(n, max);
                        return (
                          <td key={i} className="px-2 py-1.5" title={r.run[i] ? `이 주에 기간이 걸친 업무 ${r.run[i]}건 중 마감 ${n}건` : ''}>
                            <div className={`relative overflow-hidden rounded border border-border px-2 py-1 text-[11.5px] ${c.lv === 'none' ? 'text-ink3' : 'font-bold text-ink'} ${c.lv === 'over' ? 'text-danger' : ''}`}>
                              <i className={`absolute inset-y-0 left-0 ${CELL_TONE[c.lv]}`} style={{ width: `${c.pct}%` }} />
                              <span className="relative">{c.text}</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right">
                        {r.late ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); B.openPerson(id, 'all', 'late'); }} className="font-bold text-danger hover:underline" title="눌러서 지연 업무 보기">{r.late}</button>
                        ) : <span className="text-ink3">-</span>}
                      </td>
                    </tr>
                    {on && ks.map((k) => {
                      const b = r.by.get(k) ?? r.w.map(() => 0);
                      return (
                        <tr key={k} className="border-b border-border bg-panel-alt/60">
                          <td className="whitespace-nowrap py-1.5 pl-11 pr-4"><ProjectTag>{shortOf(k)}</ProjectTag> <span className="text-[11px] text-ink3">{projName(k)}</span></td>
                          {b.map((n, i) => (
                            <td key={i} className="px-2 py-1.5">
                              {n ? <button type="button" onClick={() => B.goWbs({ k, who: id, period: 'now' })} className="text-[11.5px] font-bold text-teal hover:underline" title={`이 사업에서 ${people.nameOf(id)}의 업무 보기`}>마감 {n}건</button> : <span className="text-ink3">·</span>}
                            </td>
                          ))}
                          <td />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {!order.length && (
                <tr><td colSpan={LOAD_WEEKS + 2}><EmptyHint title={`앞으로 ${LOAD_WEEKS}주 안에 맡은 업무가 없습니다`} hint="업무 목록에서 업무에 담당과 시작 · 종료 날짜를 넣으면 주마다 마감 건수가 쌓입니다." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-2.5 text-[11px] text-ink3">
          ※ 그 주에 <b>마감되는</b> 미완료 업무 수 (칸에 마우스를 올리면 그 주 기간 중 업무 수) · 이미 마감이 지난 업무는 오른쪽 '지연' 칸에 따로 · 몰림 기준 주당 {max}건 (오른쪽 위에서 변경) · 협약 이전 · 날짜 없는 업무 제외 · 사람을 누르면 사업별로 펼쳐집니다
        </div>
      </section>

      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <CardHead title="재배정 검토 대상"><span className="text-[11px] text-ink3">이번 주 · 다음 주 마감이 주당 {max}건을 넘는 사람</span></CardHead>
        <div className="space-y-2 p-4">
          {over.length ? over.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-[12px]">
              <span className="font-bold text-amber">!</span>
              <span className="flex-1 text-ink2">
                <b className="text-ink">{people.labelOf(o.id)}</b> 마감 이번 주 {o.row.w[0]}건 · 다음 주 {o.row.w[1]}건{o.row.late ? ` (지연 ${o.row.late}건 별도)` : ''}.
                {o.top && ` ${projName(o.top.projectId)}에 ${o.top.n}건 집중`}
                {o.cand && <> → 같은 사업 참여자 <b className="text-ink">{people.labelOf(o.cand.id)}</b>(2주 마감 {o.cand.due2}건)에게 일부 이관 검토</>}
              </span>
              {o.top && <Button size="sm" variant="secondary" onClick={() => B.goWbs({ k: o.top!.projectId, who: o.id, period: 'now' })}>업무 보기</Button>}
            </div>
          )) : (
            <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] text-ink2">✓ 이번 주 · 다음 주에 마감이 몰린 사람이 없습니다.</div>
          )}
        </div>
      </section>
      {B.node}
    </div>
  );
}


// ── 투입 시간 ────────────────────────────────────────

/** 업무계획 '시간' 칸 기록 — 업무계획 화면(3-6)을 옮기면 여기로 들어온다. 지금은 0건 */
const hourRowsOf = (_d: PmDerived): HourRow[] => [];

export function TeamHoursView() {
  const B = useTeamBase();
  const { d, people, shortOf } = B;
  const [per, setPer] = useState<HourPeriod>('week');
  const [who, setWho] = useState('');
  if (!d) return <EmptyHint title="팀 현황을 불러오는 중입니다" />;
  const [from, to, label] = hourRange(per, d.today);
  const S = hourSummary(hourRowsOf(d), from, to);
  const cell = (h: number) => (h ? <span>{hourText(h)}</span> : <span className="text-ink3">-</span>);
  const kpi = (l: string, v: ReactNode, s: ReactNode) => (
    <div className="rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
      <span className="text-[11.5px] font-bold text-ink2">{l}</span>
      <b className="block text-[22px] leading-tight text-ink">{v}</b>
      <small className="text-[10.5px] text-ink3">{s}</small>
    </div>
  );
  return (
    <div className="space-y-4">
      <ScreenHead title="팀 현황" desc="업무계획 · 일일 업무 보고의 '시간' 칸에 적은 시간을 사람별 · 사업별로 모아 봅니다 (시간을 안 적은 일은 빠짐)" />
      <div className="flex flex-wrap items-center gap-1.5">
        {HOUR_PERIODS.map(([v, l]) => <Button key={v} size="sm" variant={per === v ? 'primary' : 'secondary'} onClick={() => setPer(v)}>{l}</Button>)}
        <span className="ml-1.5 text-[11.5px] text-ink3">{monthDay(from)} ~ {monthDay(to)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {kpi(`${label} 기록된 시간`, hourText(S.total) || '0h', `${S.whos.length}명 · ${S.R.length}건`)}
        {kpi('가장 많이 쓴 사업', S.top ? shortOf(S.top.k) : '-', S.top ? hourText(S.top.h) : '')}
        {kpi('시간을 적은 사람', <>{S.whos.length}<small className="ml-0.5 text-[12px] text-ink3">명</small></>, '업무계획에 시간을 적은 사람만 셉니다')}
      </div>
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <CardHead title="사람별 · 사업별 시간"><span className="flex-1" /><span className="text-[11px] text-ink3">줄을 누르면 그 사람의 그 기간 기록</span></CardHead>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-[11px] text-ink3">
                <th className="px-4 py-2 text-left">사람</th>
                {S.ks.map((k) => <th key={k} className="px-2 py-2 text-right">{shortOf(k)}</th>)}
                <th className="px-2 py-2 text-right">합계</th><th className="px-4 py-2 text-right">적은 날</th>
              </tr>
            </thead>
            <tbody>
              {S.ppl.map((p) => (
                <tr key={p.w} onClick={() => setWho(p.w)} className="cursor-pointer border-b border-border hover:bg-panel-alt">
                  <td className="px-4 py-2"><b>{people.labelOf(p.w)}</b></td>
                  {S.ks.map((k) => <td key={k} className="px-2 py-2 text-right">{cell(S.sum((r) => r.who === p.w && r.projectId === k))}</td>)}
                  <td className="px-2 py-2 text-right"><b>{hourText(p.h)}</b></td>
                  <td className="px-4 py-2 text-right text-ink3">{p.days}일</td>
                </tr>
              ))}
              {S.ppl.length ? (
                <tr className="bg-panel-alt">
                  <td className="px-4 py-2"><b>합계</b></td>
                  {S.ks.map((k) => <td key={k} className="px-2 py-2 text-right"><b>{hourText(S.sum((r) => r.projectId === k))}</b></td>)}
                  <td className="px-2 py-2 text-right"><b>{hourText(S.total)}</b></td><td />
                </tr>
              ) : (
                <tr><td colSpan={S.ks.length + 3}><EmptyHint title={`${label}에 시간을 적은 기록이 없습니다`} hint="업무계획 '오늘 할 일'의 시간 칸에 적으면 여기에 모입니다. (업무계획 화면은 3-6에서 옮깁니다)" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {who && S.whos.includes(who) && (
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          <CardHead title={`${people.labelOf(who)} · ${label} 기록`}><span className="flex-1" /><Button size="sm" variant="secondary" onClick={() => setWho('')}>닫기</Button></CardHead>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border text-left text-[11px] text-ink3"><th className="px-4 py-2">날짜</th><th className="px-2">사업</th><th className="px-2">업무</th><th className="px-4 text-right">시간</th></tr></thead>
            <tbody>
              {S.R.filter((r) => r.who === who).sort((a, b) => (a.d < b.d ? 1 : -1)).map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-1.5">{monthDay(r.d)}</td>
                  <td className="px-2">{r.projectId ? <ProjectTag>{shortOf(r.projectId)}</ProjectTag> : <span className="text-[11px] text-ink3">사내 · 기타</span>}</td>
                  <td className="px-2">{r.txt}</td>
                  <td className="px-4 text-right">{hourText(r.h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {B.node}
    </div>
  );
}
