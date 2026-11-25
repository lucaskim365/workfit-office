import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { diffDays, isDone, leftText, liveOf, monthDay, shortName } from '@/domain/pm/rules';
import type { PmProject, PmTask } from '@/domain/pm/schema';
import { agoText, dday, siteStats, weekStart } from '@/domain/pm/site';
import {
  MY_SORTS, UPD_WHY, myInbox, mySites, myUpdList, myWork, nextMilestone, pageOf, prioN, updBatch, updSort, updWhat,
  type Approval, type MySort, type UpdItem, type UpdPages,
} from '@/domain/pm/my';
import { usePmDerived, usePmMutations, usePmSiteMutations, usePmSites, type PmDerived } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { usePmPlanCtx } from '@/features/pm/usePmPlan';
import { planEditable, planMarkTask, planRecentIdx, planUpdDates, todayRecord } from '@/domain/pm/plan';
import { EmptyHint, ProgressBar, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, ScreenHead, SiteStatusTag } from './parts';

/**
 * 대시보드 › 내 업무 (pMy 3470) — 3-5단계. 로그인한 사람 = '나'.
 * 홈: 오늘 숫자 4개 · 진행률 갱신 5건씩 · 오늘 업무 기록 · 처리할 일 · 내가 참여하는 사업 · 2주 내 시작.
 * [업무 n] 을 누르면 업무 보드 (지금 할 일 · 나중에 할 일, 7건씩).
 */
const WD = '일월화수목금토';
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11px] font-bold text-ink3';
const td = 'px-3 py-2 align-middle';

function PrioTag({ t, d }: { t: PmTask; d: PmDerived }) {
  const l = d.liveMap.get(t.id) ?? liveOf(t);
  const p = prioN(t, l, d.today);
  if (p === 0) return <Tag tone="bad">지연 {dday(t.end, d.today)}</Tag>;
  if (p === 1) return <Tag tone="warn">마감 {dday(t.end, d.today)}</Tag>;
  if (p === 2) return <Tag tone="run">진행 중</Tag>;
  return <Tag>{t.start ? `${dday(t.start, d.today)} 시작` : '일정 없음'}</Tag>;
}
const span = (t: PmTask) => (t.start || t.end ? `${monthDay(t.start)}~${monthDay(t.end)}` : '일정 없음');

/** 진행률 입력 — 바꾸고 칸을 벗어나거나 Enter 면 바로 저장 (quickAp) */
function PctInput({ pct, onSet, onBad }: { pct: number; onSet: (n: number) => void; onBad: () => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <input type="number" min={0} max={100} step={1} defaultValue={pct} key={pct} aria-label="실적 진행률"
        title="실적 진행률 기록 (0~100) — 바꾸면 업무 목록에 바로 반영"
        className="w-[52px] rounded border border-border-hi bg-panel px-1.5 py-0.5 text-right text-[12px]"
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const v = e.target.value;
          const n = Math.round(+v);
          if (v === '' || Number.isNaN(n) || n < 0 || n > 100) { e.target.value = String(pct); onBad(); return; }
          if (n !== pct) onSet(n);
        }} />%
    </span>
  );
}

export function MyView() {
  const people = usePmPeople();
  const { me } = people;
  const d = usePmDerived(people.nameOf);
  const sites = usePmSites(d);
  const mut = usePmMutations(me, people.nameOf);
  const smut = usePmSiteMutations(me);
  const C = usePmPlanCtx(d);
  const [, setParams] = useSearchParams();
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const [board, setBoard] = useState<string | null>(null);
  const [sort, setSort] = useState<MySort>('prog');
  const [sortL, setSortL] = useState<MySort>('prog');
  const [pg, setPg] = useState(1);
  const [pgL, setPgL] = useState(1);
  const [inbox, setInbox] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [upd, setUpd] = useState<UpdPages>({ list: [], i: 0 });

  const pmOf = (p: PmProject) => [...new Set([p.pmUserId, people.idByName(p.pmName)].filter(Boolean))];
  const calc = useMemo(() => {
    if (!d) return null;
    const X = { tasks: d.snap.tasks, liveMap: d.liveMap, projects: d.snap.projects, today: d.today };
    const laterIds = d.snap.later.find((x) => x.id === me)?.taskIds ?? [];
    const w = myWork(me, X, laterIds, sort, sortL);
    const ib = myInbox(me, { ...X, tickets: d.snap.tickets, msOk: new Map(d.snap.msOk.map((x) => [x.id, x])), issues: d.snap.issues, actions: d.snap.actions, pmOf });
    const sitePm = (id: string) => { const p = d.snap.projects.find((x) => x.id === id); return p ? pmOf(p)[0] ?? '' : ''; };
    // 업무계획에서 체크 · 메모한 날도 갱신으로 · 최근 7일 업무계획에 넣은 업무 = '최근 한 업무' (updIdx · planRecentIdx)
    const U = { ...X, logs: d.snap.logs, checks: d.snap.weekChecks, tickets: d.snap.tickets, baseDate: d.snap.baseDate, sitePm,
      more: C ? planUpdDates(C) : undefined, planRecent: C ? planRecentIdx(C) : undefined };
    return { X, w, ib, U, upd: myUpdList(me, U), sites: mySites(w, X) };
    // pmOf 는 people 에 기댐
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, C, me, sort, sortL, people.idByName]);

  if (!d || !calc) return <EmptyHint title="내 업무를 불러오는 중입니다" />;
  if (!me) return <EmptyHint title="로그인한 사용자를 알 수 없습니다" hint="그룹웨어에 다시 로그인하면 내 업무가 나옵니다." />;
  const { w, ib } = calc;
  const today = d.today;
  const L = (t: PmTask) => d.liveMap.get(t.id) ?? liveOf(t);
  const say = (text: string, bad?: boolean) => setMsg({ text, bad });

  const setPct = (t: PmTask, n: number) => {
    mut.setProgress.mutate({ id: t.id, pct: n, why: '내 업무에서 기록' });
    say(`'${t.name}' 진행률 ${n}% 기록`);
  };
  /** [완료] (quickDone · taskDone): 업무 티켓이 진행 중이면 티켓 승인으로, 남은 세부 작업이 있으면 물어봄 */
  const quickDone = (t: PmTask) => {
    const tk = d.taskTicket.get(t.id);
    if (tk && tk.status !== '완료' && tk.status !== '취소') { say(`티켓 ${tk.no}(${tk.status})로 처리 중입니다. 티켓에서 검토 요청 → 승인하면 완료됩니다`, true); return; }
    const left = (d.subsByTask.get(t.id) ?? []).filter((s) => !s.done).length;
    if (left && !confirm(`아직 안 끝난 세부 작업이 ${left}건 있습니다.\n그래도 '${t.name}' 업무를 완료로 바꿀까요? (세부 작업은 그대로 남습니다)`)) return;
    if (C) { const items = planMarkTask(planEditable(C, me, d.today), t.id, true); if (items) mut.setPlanDay.mutate({ date: d.today, items }); }
    mut.setProgress.mutate({ id: t.id, pct: 100, why: 'TASK 완료 처리' });
    say(`'${t.name}' 완료 — 실적 100%. 잘못 눌렀으면 업무 창의 [완료 취소]로 되돌릴 수 있습니다`);
  };
  const toggleLater = (t: PmTask, on: boolean) => smut.setLater.mutate({ taskId: t.id, on });
  const openBoard = (k: string) => { setMsg(null); setBoard(k); setPg(1); setPgL(1); window.scrollTo(0, 0); };
  const goView = (v: string) => { const n = new URLSearchParams(); n.set('v', v); setParams(n); };

  const msgBar = msg && (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${msg.bad ? 'border-danger/30 bg-danger/5 text-danger' : 'border-teal/30 bg-teal-soft/30 text-ink'}`}>
      <span className="flex-1">{msg.text}</span>
      <Button size="sm" variant="ghost" onClick={() => setMsg(null)}>닫기</Button>
    </div>
  );

  const head = (
    <ScreenHead title="내 업무" desc={`${people.labelOf(me)} · 진행률을 기록하면 업무 목록과 팀 현황에 바로 반영됩니다`}>
      <Button size="sm" disabled title="이슈 등록은 이슈 화면과 같이 5단계에서 옮깁니다">+ 이슈 (5단계)</Button>
      <Button size="sm" variant="primary" onClick={() => goView('dash/plan')} title="업무계획의 오늘 할 일로 이동">오늘 할 일</Button>
    </ScreenHead>
  );

  // ── 업무 보드 ───────────────────────────────────────
  if (board) {
    const inK = (t: PmTask) => board === 'all' || t.projectId === board;
    const P = pageOf(w.todo.filter(inK), pg);
    const PL = pageOf(w.later.filter(inK), pgL);
    const row = (t: PmTask) => {
      const l = L(t);
      const subs = d.subsByTask.get(t.id) ?? [];
      const later = w.later.includes(t);
      const p = d.snap.projects.find((x) => x.id === t.projectId);
      return (
        <tr key={t.id} onClick={() => modals.openTask(t.id)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt" title="누르면 업무 상세">
          <td className={td}><PrioTag t={t} d={d} /></td>
          <td className={`${td} whitespace-nowrap text-[11.5px]`}><ProjectTag>{shortOf(t.projectId)}</ProjectTag> <span className="text-ink3">{t.code}</span>{t.milestone && <b className="ml-1 text-amber" title="마일스톤">◆</b>}</td>
          <td className={td}>
            <span className="text-[12.5px] text-ink">{t.name}</span>
            {t.subAssigneeIds.includes(me) && <Tag title="부 담당">부</Tag>}
            <div className="text-[11px] text-ink3">{p?.company} · 산출물 {t.output || '-'}{subs.length ? ` · 세부 ${subs.filter((s) => s.done).length}/${subs.length} 완료` : ''}</div>
          </td>
          <td className={`${td} whitespace-nowrap text-[11.5px] text-ink2`}>{span(t)}</td>
          <td className={td}>
            <div className="flex items-center gap-2"><span className="w-[70px]"><ProgressBar pct={l.pct} /></span><PctInput pct={l.pct} onSet={(n) => setPct(t, n)} onBad={() => say('진행률은 0~100 사이 숫자로 입력하세요', true)} /></div>
          </td>
          <td className={td} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1">
              {later
                ? <Button size="sm" onClick={() => toggleLater(t, false)} title="지금 할 일로 올리기">지금 할 일로</Button>
                : <Button size="sm" onClick={() => toggleLater(t, true)} title="나중에 할 일로 내리기 — 지연 집계는 그대로">나중에</Button>}
              <Button size="sm" variant="accent" onClick={() => quickDone(t)} title="실적 100% · 완료로 기록">완료</Button>
            </div>
          </td>
        </tr>
      );
    };
    const sortBtns = (v: MySort, set: (m: MySort) => void, reset: () => void) => (
      <div className="inline-flex overflow-hidden rounded-md border border-border-hi text-[11.5px] font-bold">
        {MY_SORTS.map(([id, nm, tip], i) => (
          <button key={id} type="button" title={tip} onClick={() => { set(id); reset(); }}
            className={`px-2.5 py-1 ${i ? 'border-l border-border-hi' : ''} ${v === id ? 'bg-navy text-white' : 'text-ink2 hover:bg-panel-alt'}`}>{nm}</button>
        ))}
      </div>
    );
    const pager = (cur: number, n: number, set: (v: number) => void) => n < 2 ? null : (
      <div className="flex justify-center gap-1 border-t border-border px-3 py-2">
        {cur > 1 && <Button size="sm" onClick={() => set(cur - 1)}>‹ 이전</Button>}
        {Array.from({ length: n }, (_, i) => (
          <button key={i} type="button" onClick={() => set(i + 1)} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${cur === i + 1 ? 'bg-teal-soft text-teal' : 'border border-border text-ink2'}`}>{i + 1}</button>
        ))}
        {cur < n && <Button size="sm" onClick={() => set(cur + 1)}>다음 ›</Button>}
      </div>
    );
    const table = (rows: PmTask[], empty: string) => (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-border"><th className={th}>우선</th><th className={th}>번호</th><th className={th}>업무 · 산출물</th><th className={th}>기간</th><th className={th}>진행률</th><th className={th} /></tr></thead>
          <tbody>{rows.length ? rows.map(row) : <tr><td colSpan={6}><EmptyHint title={empty} /></td></tr>}</tbody>
        </table>
      </div>
    );
    return (
      <div className="space-y-3">
        {head}
        <div className={`${sec} flex flex-wrap items-center gap-2.5 px-4 py-2.5`}>
          <Button size="sm" onClick={() => { setMsg(null); setBoard(null); }}>← 내 업무 홈</Button>
          <b className="text-[13px] text-ink">{board === 'all' ? '전체 사업' : shortOf(board)} 업무</b>
          <span className="text-[11.5px] text-ink3">지금 할 일 {P.total} · 나중에 할 일 {PL.total}</span>
        </div>
        {msgBar}
        <section className={sec}>
          <CardHead title="지금 할 일"><span className="flex-1" /><span className="text-[11px] text-ink3">지연 · 7일 내 마감 · 진행 중 · 진행률을 입력하면 바로 저장 · 줄을 누르면 상세</span>{sortBtns(sort, setSort, () => setPg(1))}</CardHead>
          {table(P.rows, '지금 할 일이 없습니다')}
          {pager(P.page, P.n, setPg)}
        </section>
        <section className={sec}>
          <CardHead title={`나중에 할 일 ${PL.total}`}><span className="flex-1" /><span className="text-[11px] text-ink3">지금은 손을 떼 둔 업무 · 지연 집계는 그대로</span>{sortBtns(sortL, setSortL, () => setPgL(1))}</CardHead>
          {table(PL.rows, "지금 할 일에서 [나중에]를 누르면 여기로 옮겨집니다")}
          {pager(PL.page, PL.n, setPgL)}
        </section>
        {modals.node}
      </div>
    );
  }

  // ── 홈 ──────────────────────────────────────────────
  const name = people.nameOf(me);
  const dt = new Date(`${today}T00:00:00`);
  const KBox = ({ n, label, tone, onClick, title, children }: { n?: number; label: string; tone?: string; onClick?: () => void; title?: string; children?: ReactNode }) => (
    <button type="button" onClick={onClick} disabled={!onClick} title={title}
      className={`flex h-[88px] w-[108px] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-panel ${onClick ? 'hover:border-teal' : 'cursor-default'}`}>
      {children ?? <b className={`text-[26px] font-extrabold leading-none ${n ? tone ?? 'text-ink' : 'text-ink'}`}>{n}</b>}
      <span className="text-[10.5px] font-bold text-ink3">{label}</span>
    </button>
  );
  const inboxRef = 'pm-my-inbox';
  const rec = C ? todayRecord(C, me, shortOf) : { rows: [], auto: false };
  const recDone = rec.rows.filter((r) => r.done).length;
  const recP = rec.rows.length ? Math.round((recDone / rec.rows.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {head}
      {/* 오늘 숫자 4개 (11-12 내 업무 = 내 하루) */}
      <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-blue/20 bg-gradient-to-r from-blue-soft to-panel px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="grid h-[52px] w-[52px] flex-none place-items-center rounded-full bg-navy text-[15px] font-extrabold text-white ring-4 ring-white">{name.slice(-2)}</span>
          <div className="min-w-0">
            <small className="text-[10.5px] font-bold text-ink3">{dt.getMonth() + 1}월 {dt.getDate()}일 {WD[dt.getDay()]}요일</small>
            <h3 className="my-0.5 text-[17px] font-extrabold text-ink">{people.labelOf(me)}님, 오늘 챙길 일이에요</h3>
            <span className="text-[11.5px] text-ink3">
              {w.nLate ? <>지연된 업무 <b className="text-danger">{w.nLate}건</b>부터 진행률을 적어 주세요</> : w.nWeek ? <>이번 주 마감 <b>{w.nWeek}건</b>이 있어요</> : '급한 업무는 없어요'}
              {ib.total ? ` · 나에게 온 일 ${ib.total}건` : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-none flex-wrap gap-2.5">
          <KBox n={w.nLate} label="지연된 내 업무" tone="text-danger" onClick={() => { setSort('late'); openBoard('all'); }} title="눌러서 지금 할 일 보기 (지연 우선)" />
          <KBox n={w.nWeek} label="이번 주 마감" tone="text-amber" onClick={() => { setSort('late'); openBoard('all'); }} title="눌러서 지금 할 일 보기 (7일 안 마감 포함)" />
          <KBox n={ib.total} label="나에게 온 일" tone="text-teal" onClick={() => document.getElementById(inboxRef)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} title="아래 '처리할 일'로" />
          <KBox label="오늘 기록" onClick={() => goView('dash/plan')} title="업무계획의 오늘 할 일 완료 비율 — 눌러서 업무계획으로">
            <i className="relative grid h-[46px] w-[46px] place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-ok) ${recP}%, var(--color-border) 0)` }}>
              <span className="absolute inset-[5px] rounded-full bg-panel" />
              <b className={`relative text-[13px] font-extrabold ${rec.rows.length ? 'text-ink' : 'text-ink3'}`}>{recDone}<em className="text-[10px] not-italic">/{rec.rows.length}</em></b>
            </i>
          </KBox>
        </div>
      </div>

      {msgBar}
      <UpdCard list={calc.upd} d={d} P={upd} setP={setUpd} U={calc.U} shortOf={shortOf} nameOf={people.nameOf}
        req={d.snap.updReq.find((x) => x.id === me)}
        onOpenTask={modals.openTask}
        onPct={setPct}
        onSame={(t) => { smut.markNoChange.mutate([t.id]); say(`'${t.name}' 변동 없음으로 확인`); }}
        onBad={() => say('진행률은 0~100 사이 숫자로 입력하세요', true)} />

      <div className={`${sec} flex flex-wrap items-center gap-2.5 px-4 py-2.5`}>
        <b className="text-[12.5px] text-ink">오늘 업무 기록</b>
        <span className="text-[11.5px] text-ink3">{rec.rows.length ? `${recDone} / ${rec.rows.length}건 완료${rec.auto ? ' · 자동 초안' : ''}` : '아직 없음'} — 업무계획의 '오늘 할 일'에서 체크 · 메모하면 기록됩니다</span>
        <span className="flex-1" />
        <Button size="sm" onClick={() => goView('dash/plan')}>업무계획 열기</Button>
        <Button size="sm" disabled title="수행일지(3-7)를 옮기면 켭니다">지난 기록 (3-7)</Button>
      </div>

      <section className={sec} id={inboxRef}>
        <CardHead title="처리할 일">
          {ib.total ? <Tag tone="run">{ib.total}건</Tag> : <Tag tone="ok">모두 처리됨</Tag>}
          <span className="flex-1" /><span className="text-[11px] text-ink3">나에게 온 일 · 누르면 목록이 열립니다</span>
        </CardHead>
        <table className="w-full text-[12px]">
          <tbody>
            {INBOX.map((b, i) => {
              const n = inboxList(ib, i).length;
              return (
                <tr key={b.nm} onClick={() => setInbox(i)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt">
                  <td className="px-4 py-2.5"><b className="text-ink">{b.nm}</b><div className="text-[11px] text-ink3">{b.ds}</div></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">{n ? <b className="text-[15px] text-teal">{n}</b> : <b className="text-ink3">0</b>}<span className="text-[11px] text-ink3">건</span></td>
                  <td className="w-[40px] pr-4 text-right text-ink3">›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={sec}>
          <CardHead title="내가 참여하는 사업">
            <span className="flex-1" /><span className="text-[11px] text-ink3">사업 진척 · 내 업무 완료</span>
            <Button size="sm" variant="primary" onClick={() => openBoard('all')} title="모든 사업의 지금 할 일 · 나중에 할 일 보기">전체 업무 {w.todo.length + w.later.length}</Button>
          </CardHead>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-border"><th className={th}>사업</th><th className={th}>사업 진척</th><th className={`${th} text-right`}>내 업무</th><th className={th}>다음 마일스톤</th><th className={th} /></tr></thead>
              <tbody>
                {calc.sites.length ? calc.sites.map((r) => {
                  const s = sites?.all.find((x) => x.p.id === r.projectId);
                  const st = s ? siteStats(s.c) : null;
                  const m = s ? nextMilestone(s.c.ts, d.liveMap) : null;
                  return (
                    <tr key={r.projectId} className="border-b border-border last:border-b-0">
                      <td className={`${td} whitespace-nowrap`}><ProjectTag>{shortOf(r.projectId)}</ProjectTag></td>
                      <td className={td}>
                        <div className="flex items-center gap-2"><span className="min-w-[60px] flex-1"><ProgressBar pct={st?.act ?? 0} todayPct={st ? Math.round(st.plan) : null} /></span><span className="whitespace-nowrap text-[11px] text-ink2">{Math.round(st?.act ?? 0)}/{Math.round(st?.plan ?? 0)}%</span></div>
                        {s && <div className="mt-0.5"><SiteStatusTag st={s.b.status} /></div>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right`}>{r.done} / {r.n}{r.late ? <div className="text-[11px] text-danger">지연 {r.late}</div> : null}</td>
                      <td className={`${td} whitespace-nowrap text-[11.5px]`}>
                        {m ? (
                          <button type="button" onClick={() => modals.openTask(m.id)} title={m.name} className="text-left hover:text-teal">
                            {m.name.length > 8 ? `${m.name.slice(0, 8)}…` : m.name}
                            <div className={m.end && diffDays(today, m.end) <= 14 ? 'font-bold text-danger' : 'font-bold text-ink2'}>{m.end ? leftText(m.end, today) : '일정 없음'}</div>
                          </button>
                        ) : <span className="text-ink3">-</span>}
                      </td>
                      <td className={td}><Button size="sm" onClick={() => openBoard(r.projectId)} title="이 사업의 지금 할 일 · 나중에 할 일 보기">업무 {r.board}</Button></td>
                    </tr>
                  );
                }) : <tr><td colSpan={5}><EmptyHint title="참여 사업이 없습니다" hint={<>업무 목록에서 업무 <b>담당</b>에 내가 들어가면 그 사업이 여기 나옵니다.</>} /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className={sec}>
          <CardHead title="2주 내 시작"><span className="flex-1" /><span className="text-[11px] text-ink3">{w.next.length}건{w.next.length > 10 ? ' · 아래로 스크롤' : ''}</span></CardHead>
          <div className="max-h-[430px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <tbody>
                {w.next.length ? w.next.map((t) => (
                  <tr key={t.id} onClick={() => modals.openTask(t.id)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-panel-alt">
                    <td className={`${td} whitespace-nowrap text-[11.5px] font-bold text-ink2`}>{dday(t.start, today)}</td>
                    <td className={td}><ProjectTag>{shortOf(t.projectId)}</ProjectTag> <span className="text-ink">{t.name}</span></td>
                    <td className={`${td} whitespace-nowrap text-[11.5px] text-ink3`}>{span(t)}</td>
                  </tr>
                )) : <tr><td><EmptyHint title="2주 내 시작하는 업무가 없습니다" hint="내가 담당인 업무 중 시작일이 오늘부터 14일 안인 업무가 여기 나옵니다." /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {inbox != null && (
        <InboxModal i={inbox} ib={ib} d={d} shortOf={shortOf} nameOf={people.nameOf} labelOf={people.labelOf}
          onClose={() => setInbox(null)}
          onOpenTicket={(no) => { setInbox(null); modals.openTicket(no); }}
          onApproveMs={(t) => {
            if (!confirm(`${d.snap.projects.find((p) => p.id === t.projectId)?.company ?? ''} · ${t.name}\n\n이 마일스톤을 승인할까요? (승인자 ${people.labelOf(me)} · ${today})`)) return;
            smut.approveMilestone.mutate({ taskId: t.id, byName: people.labelOf(me) });
            say(`◆ ${t.name} 마일스톤 승인`);
          }}
          onActionDone={(id, done) => { smut.setActionDone.mutate({ id, done }); say(done ? '액션 아이템 완료' : '액션 아이템 다시 열기'); }}
          onGo={(v) => { setInbox(null); goView(v); }} />
      )}
      {modals.node}
    </div>
  );
}



// ── 처리할 일 ────────────────────────────────────────

/** 종류 4가지 (inbox): 이름 · 설명 · 가는 화면 (없으면 아직 안 옮김) */
const INBOX: ReadonlyArray<{ nm: string; ds: string; go: string; goOk: boolean; goNote?: string }> = [
  { nm: '내 티켓', ds: '배정받은 진행 중 티켓', go: 'task/ticket', goOk: true },
  { nm: '승인 대기', ds: '내가 검토 · 승인할 티켓 · 마일스톤 (요구사항 CR 은 4단계에서 더함)', go: 'task/ticket', goOk: true },
  { nm: '이슈', ds: '내 담당 · 관련 미해결 이슈', go: 'risk/issue', goOk: false, goNote: '이슈 화면은 5단계' },
  { nm: '액션 아이템', ds: '회의에서 맡은 후속 조치', go: 'doc/meet', goOk: false, goNote: '회의록 화면은 5단계' },
];
type IbRow = Inbox['tickets'][number] | Approval | Inbox['issues'][number] | Inbox['actions'][number];
type Inbox = ReturnType<typeof myInbox>;
const inboxList = (ib: Inbox, i: number): IbRow[] => [ib.tickets, ib.appr, ib.issues, ib.actions][i] as IbRow[];

function DueTd({ d, today }: { d: string; today: string }) {
  if (!d) return <td className="px-3 py-2 text-right text-ink3">-</td>;
  const late = d < today;
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right">
      <div className={`font-bold ${late ? 'text-danger' : 'text-ink'}`}>{monthDay(d)}</div>
      <div className={`text-[11px] ${late ? 'text-danger' : 'text-ink3'}`}>{leftText(d, today)}</div>
    </td>
  );
}

function InboxModal({ i, ib, d, shortOf, nameOf, labelOf, onClose, onOpenTicket, onApproveMs, onActionDone, onGo }: {
  i: number; ib: Inbox; d: PmDerived;
  shortOf: (id: string) => string; nameOf: (id: string) => string; labelOf: (id: string) => string;
  onClose: () => void; onOpenTicket: (no: string) => void; onApproveMs: (t: PmTask) => void; onActionDone: (id: string, done: boolean) => void; onGo: (v: string) => void;
}) {
  const b = INBOX[i];
  const list = inboxList(ib, i);
  const today = d.today;
  const head = [['티켓', '제목', '상태', '마감'], ['구분', '제목', '요청', '마감 · 처리'], ['심각도', '이슈', '상태', '기한'], ['완료', '할 일', '', '기한']][i];
  const ttl = (t: string, sub?: string) => <td className="px-3 py-2"><div className="font-bold text-ink">{t}</div>{sub && <div className="mt-0.5 text-[11px] text-ink3">{sub}</div>}</td>;
  const tkSub = (x: Inbox['tickets'][number]) => [shortOf(x.projectId), x.parent || d.taskMap.get(x.taskId)?.name || ''].filter(Boolean).join(' · ');
  const row = (r: IbRow, j: number): ReactNode => {
    if (i === 0) {
      const x = r as Inbox['tickets'][number];
      return (
        <tr key={x.no} onClick={() => onOpenTicket(x.no)} className="cursor-pointer border-b border-border hover:bg-panel-alt">
          <td className="w-px whitespace-nowrap px-3 py-2"><Tag>{x.no}</Tag></td>
          {ttl(x.title, tkSub(x) + (x.issuerId ? ` · ${labelOf(x.issuerId)} 발행` : ''))}
          <td className="whitespace-nowrap px-3 py-2"><Tag tone={x.status === '검토요청' ? 'warn' : x.status === '진행중' ? 'run' : 'plain'}>{x.status}</Tag></td>
          <DueTd d={x.due} today={today} />
        </tr>
      );
    }
    if (i === 1) {
      const a = r as Approval;
      if (a.kind === 'tk') {
        const x = a.x;
        return (
          <tr key={x.no} onClick={() => onOpenTicket(x.no)} className="cursor-pointer border-b border-border hover:bg-panel-alt">
            <td className="w-px whitespace-nowrap px-3 py-2"><Tag>{x.no}</Tag></td>
            {ttl(x.title, tkSub(x))}
            <td className="whitespace-nowrap px-3 py-2">{labelOf(x.assigneeId)} 요청</td>
            <DueTd d={x.due} today={today} />
          </tr>
        );
      }
      const t = a.t;
      return (
        <tr key={t.id} className="border-b border-border">
          <td className="w-px whitespace-nowrap px-3 py-2"><Tag tone="warn">◆ 마일스톤</Tag></td>
          {ttl(t.name, `${shortOf(t.projectId)} · 번호 ${t.code} · 업무 완료`)}
          <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink3">PM 승인</td>
          <td className="px-3 py-2 text-right"><Button size="sm" variant="accent" onClick={() => onApproveMs(t)}>승인</Button></td>
        </tr>
      );
    }
    if (i === 2) {
      const x = r as Inbox['issues'][number];
      return (
        <tr key={x.id} className="border-b border-border" title="이슈 상세 · 수정 창은 5단계에서 옮깁니다">
          <td className="w-px whitespace-nowrap px-3 py-2"><Tag tone={x.sev === '긴급' ? 'bad' : 'warn'}>{x.sev || '보통'}</Tag></td>
          {ttl(x.title, [shortOf(x.projectId), x.ownerId ? `${nameOf(x.ownerId)} 담당` : ''].filter(Boolean).join(' · '))}
          <td className="whitespace-nowrap px-3 py-2">{x.status}</td>
          <DueTd d="" today={today} />
        </tr>
      );
    }
    const a = r as Inbox['actions'][number];
    return (
      <tr key={a.id || j} className="border-b border-border">
        <td className="w-px px-3 py-2"><input type="checkbox" checked={a.done} onChange={(e) => onActionDone(a.id, e.target.checked)} title="완료" className="h-4 w-4 cursor-pointer" /></td>
        {ttl(a.text, a.projectId ? shortOf(a.projectId) : '')}
        <td />
        <DueTd d={a.due} today={today} />
      </tr>
    );
  };
  return (
    <Modal open onClose={onClose} width={820} title={`${b.nm} ${list.length}건`}
      footer={<>
        <span className="flex-1" />
        <Button variant="secondary" onClick={onClose}>닫기</Button>
        <Button variant="primary" disabled={!b.goOk} title={b.goNote} onClick={() => onGo(b.go)}>{b.nm} 화면으로 →{b.goOk ? '' : ` (${b.goNote?.replace(/.* /, '')})`}</Button>
      </>}>
      <p className="mb-2.5 text-[12px] text-ink3">{b.ds}{list.length && i < 2 ? ' · 줄을 누르면 상세 창이 열립니다' : ''}</p>
      {list.length ? (
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border">{head.map((h, j) => <th key={j} className={`${th} ${j === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>{list.map(row)}</tbody>
          </table>
        </div>
      ) : <EmptyHint title="지금은 없습니다" hint={INBOX_HINT[i]} />}
    </Modal>
  );
}

const INBOX_HINT = [
  '티켓 목록에서 나에게 배정된 티켓이 발행되면 여기 나옵니다.',
  '내가 검토자 · 승인자인 티켓이 검토 요청되거나, 내가 PM인 사업의 마일스톤 업무가 끝나면 여기 나옵니다.',
  '이슈(5단계)에서 내가 담당이거나 관련자인 이슈가 등록되면 여기 나옵니다.',
  '회의록(5단계)에서 나에게 액션 아이템이 배정되면 여기 나옵니다.',
];

// ── 진행률 갱신 5건씩 (myUpdCard 7886) ───────────────

function UpdCard({ list, d, P, setP, U, shortOf, nameOf, req, onOpenTask, onPct, onSame, onBad }: {
  list: UpdItem[]; d: PmDerived; P: UpdPages; setP: (p: UpdPages) => void;
  U: Parameters<typeof updWhat>[1];
  shortOf: (id: string) => string; nameOf: (id: string) => string;
  req?: { date: string; by: string };
  onOpenTask: (id: string) => void; onPct: (t: PmTask, n: number) => void; onSame: (t: PmTask) => void; onBad: () => void;
}) {
  const today = d.today;
  // 이번 묶음을 기억해 둔다 (데모 P.list[P.i] = B) — 안 그러면 갱신한 줄이 '✓ 갱신함'으로 남지 않고 남은 것에서 다시 뽑힘
  const r = updBatch(list, P);
  const curKey = (r.P.list[r.P.i] ?? []).join(',');
  const savedKey = (P.list[P.i] ?? []).join(',');
  useEffect(() => { if (list.length && curKey !== savedKey) setP(r.P); });
  const head = (
    <span className="text-[11px] text-ink3">마감이 지났거나 · 이번 주 마감이거나 · 2주 넘게 갱신 안 한 내 업무를 일주일에 한 번 5건씩 묻습니다</span>
  );
  if (!list.length) {
    return (
      <section className={sec}>
        <CardHead title="진행률 갱신">{head}</CardHead>
        <EmptyHint title="이번 주에 갱신할 업무가 없습니다" hint="내가 담당인 업무 중 시작했고 마감이 지났거나 · 이번 주 마감이거나 · 2주 넘게 진행률 기록이 없는 업무가 생기면 여기서 5건씩 묻습니다." />
      </section>
    );
  }
  const byId = new Map(list.map((x) => [x.t.id, x]));
  const left = list.filter((x) => !x.done).sort(updSort);
  const doneN = list.length - left.length;
  if (!r.B.length) {
    return (
      <section className={`${sec} flex items-center gap-2 px-4 py-3 text-[12px]`}>
        <b className="text-ok">✓ 이번 주 진행률 갱신 끝</b><span className="text-ink3">{doneN}건 갱신함 · 다음 주 월요일에 다시 묻습니다</span>
      </section>
    );
  }
  const rows = r.B.map((id) => byId.get(id)!);
  const bDone = rows.filter((x) => x.done).length;
  const go = (i: number) => setP({ list: r.P.list, i });
  const reqOn = req && req.date >= weekStart(today);
  return (
    <section className={sec}>
      <CardHead title="진행률 갱신">
        <span className="text-[11.5px] text-ink3">이 묶음 <b className="text-ink">{bDone} / {rows.length}</b> · 남은 전체 {left.length}건{doneN ? ` · 이번 주 ${doneN}건 갱신함` : ''}</span>
        {reqOn && <Tag tone="warn" title={`${nameOf(req!.by)}님이 ${req!.date}에 요청`}>{nameOf(req!.by)}님 요청 · {monthDay(req!.date)}</Tag>}
        <span className="flex-1" />
        {r.P.i > 0 && <Button size="sm" onClick={() => go(r.P.i - 1)} title="앞 묶음으로 돌아갑니다">← 이전 5건{r.prevLeft ? ` (못한 ${r.prevLeft}건)` : ''}</Button>}
        {r.P.i > 0 && <span className="text-[11px] text-ink3">{r.P.i + 1}번째 묶음</span>}
        {r.rest || r.P.list[r.P.i + 1]
          ? <Button size="sm" variant={bDone === rows.length ? 'primary' : 'secondary'} onClick={() => go(r.P.i + 1)} title="이 묶음을 닫고 다음 업무 5건을 불러옵니다">다음 5건 →</Button>
          : bDone === rows.length ? <b className="text-[12px] text-ok">✓ 이번 주 갱신 끝</b> : null}
      </CardHead>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="border-b border-border"><th className={th}>왜</th><th className={th}>번호</th><th className={th}>업무</th><th className={th}>기간</th><th className={th}>마지막 갱신</th><th className={th}>진행률</th><th className={th} /></tr></thead>
          <tbody>
            {rows.map((x) => {
              const t = x.t;
              const l = d.liveMap.get(t.id) ?? liveOf(t);
              const late = !!t.end && t.end < today && !isDone(l);
              return (
                <tr key={t.id} className={`border-b border-border last:border-b-0 ${x.done ? 'bg-ok/5' : ''}`}>
                  <td className={`${td} whitespace-nowrap`}>{x.done ? <><b className="text-ok">✓ 갱신함</b><div className="text-[11px] text-ink3">{updWhat(t, U)}</div></> : <Tag>{UPD_WHY[x.why]}</Tag>}</td>
                  <td className={`${td} whitespace-nowrap text-[11.5px]`}><ProjectTag>{shortOf(t.projectId)}</ProjectTag> <span className="text-ink3">{t.code}</span></td>
                  <td className={td}><button type="button" onClick={() => onOpenTask(t.id)} className="text-left text-ink hover:text-teal" title={t.name}>{t.name}</button></td>
                  <td className={`${td} whitespace-nowrap text-[11.5px] ${late ? 'text-danger' : 'text-ink2'}`}>{span(t)}{t.end ? ` · ${dday(t.end, today)}` : ''}</td>
                  <td className={`${td} whitespace-nowrap text-[11.5px] text-ink3`}>{x.last ? agoText(x.last, today) : '기록 없음'}</td>
                  <td className={td}><PctInput pct={l.pct} onSet={(n) => onPct(t, n)} onBad={onBad} /></td>
                  <td className={td}>{!x.done && <Button size="sm" onClick={() => onSame(t)} title="진행률이 그대로면 눌러서 확인만 표시">변동 없음</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-ink3">
        진행률을 고치거나 [변동 없음]을 누르면 그 줄이 초록색 '✓ 갱신함'으로 바뀝니다. 다 하면 [다음 5건 →], 앞 묶음을 다시 보려면 [← 이전 5건]. 티켓에서 진행률을 기록해도 갱신으로 칩니다.
      </p>
    </section>
  );
}


