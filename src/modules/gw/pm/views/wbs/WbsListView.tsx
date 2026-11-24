import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import {
  defaultAssignee, filterTasks, groupsOf, isLate, countsAllStatus, liveOf, PM_FILTER_DEFAULT, PM_PERIOD_TABS,
  projectCard, shortName, stagesOf, monthDay, yearMonth, mdAvg, mdSum, spanOf, timePct, currentStage, taskPeople,
  tabCounts, type PmFilter, type PmPeriod,
} from '@/domain/pm/rules';
import type { PmProject, PmTask } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, type PmDerived } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { Avatar, DueCell, EmptyHint, MiniBar, ProgressBar, ProjectTag, StatusRing, Tag, toneOf } from './parts';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal, type TaskFormMode } from './TaskFormModal';
import { BulkEditModal } from './BulkEditModal';
import { ChangeLogModal } from './ChangeLogModal';
import { exportTasksCsv } from './wbsExport';
import { WbsBoard } from './WbsBoard';

/**
 * 업무 목록 › 목록 (데모 pWbs 1639). 세 모양:
 *  ① 첫 화면 — 숫자 칸 5개 + 사업 카드
 *  ② 사업 하나 — 사업 머리(진행·기간·단계 흐름) + 묶음별 업무
 *  ③ 전체 사업에서 탭·검색으로 고른 업무 — 사업별 묶음
 * 주소 `k=<사업>` 로 사업 화면을 유지한다 (새로 고침해도 그대로).
 */
const KPIS: ReadonlyArray<readonly [Exclude<PmPeriod, 'all'>, string, string]> = [
  ['now', '진행 중', '오늘 일정에 걸린 업무'],
  ['late', '지연', '마감이 지났는데 안 끝남'],
  ['soon', '2주 내 시작', '곧 시작할 업무'],
  ['rec', '발행 추천', '7일 안 시작 · 티켓 없음'],
  ['done', '최근 완료', '2주 안에 끝낸 업무'],
];
/** 0건일 때 무엇을 하면 채워지는지 (빈 화면 숨기지 않기) */
const EMPTY_WHY: Record<PmPeriod, string> = {
  now: '업무에 시작·종료일을 넣으면, 오늘이 그 기간 안인 업무가 여기 나옵니다.',
  late: '종료일이 지났는데 끝나지 않은 업무가 여기 나옵니다. 지금은 종료일이 들어간 업무가 없습니다.',
  soon: '시작일이 앞으로 2주 안인 업무가 여기 나옵니다. 업무에 시작일을 넣어 주세요.',
  rec: '시작일이 7일 안(이미 시작한 것 포함)이고 티켓이 없는 업무가 여기 나옵니다. 업무에 시작일을 넣어 주세요.',
  done: '최근 2주 안에 [TASK 전체 완료]를 누르거나 진행률 100%를 기록한 업무가 여기 나옵니다. 엑셀에서 완료로 들어온 업무는 완료 날짜가 없어 나오지 않습니다.',
  all: '조건에 맞는 업무가 없습니다. 위 탭이나 [필터]를 바꿔 보세요.',
};

export function WbsListView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const [params, setParams] = useSearchParams();
  const k = params.get('k') ?? 'all';
  const setK = (v: string) => {
    const next = new URLSearchParams(params);
    next.delete('stage');
    if (v === 'all') next.delete('k');
    else next.set('k', v);
    setParams(next);
  };

  if (!d) return <EmptyHint title="업무 목록을 불러오는 중입니다" />;
  // 간트에서 단계를 눌러 오면 ?stage= 로 그 단계만 (한 번만 읽음)
  return <WbsList key={k + (params.get('stage') ?? '')} d={d} k={k} setK={setK} people={people} initStage={params.get('stage') ?? 'all'} />;
}

type People = ReturnType<typeof usePmPeople>;

function WbsList({ d, k, setK, people, initStage }: { d: PmDerived; k: string; setK: (v: string) => void; people: People; initStage: string }) {
  const { snap, today, liveMap, ctx } = d;
  const mut = usePmMutations(people.me, people.nameOf);
  const projects = snap.projects;
  const nameP = (p: PmProject) => shortName(p, projects);
  const projOf = (id: string) => projects.find((p) => p.id === id);
  const shortOf = (id: string) => { const p = projOf(id); return p ? nameP(p) : id; };

  const [f, setF] = useState<PmFilter>({ ...PM_FILTER_DEFAULT, stage: initStage });
  const filter: PmFilter = { ...f, projectId: k, mine: f.mine ? people.me : '' };
  const [home, setHome] = useState(true);
  const [board, setBoard] = useState(false);
  const [fltOpen, setFltOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormMode | null>(null);
  const [bulk, setBulk] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [help, setHelp] = useState(false);

  const isHome = k === 'all' && home && !f.q.trim();
  const tasks = snap.tasks;
  // 보드는 완료 칸까지 보여 줘야 해서 상태 필터를 쓰지 않음 · 단계를 골랐으면 끝난 업무도 보여 줌 (D안)
  const allSt = countsAllStatus(filter, board);
  const list = useMemo(() => {
    const L = filterTasks(tasks, allSt ? { ...filter, st: 'all' } : filter, ctx);
    if (filter.period === 'done') L.sort((a, b) => ((ctx.doneInfo(b)?.date ?? '') < (ctx.doneInfo(a)?.date ?? '') ? -1 : 1));
    return L;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, JSON.stringify(filter), allSt, ctx]);
  const cnt = useMemo(() => tabCounts(tasks, filter, ctx, board), [tasks, JSON.stringify(filter), ctx, board]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = (t: PmTask) => liveMap.get(t.id) ?? liveOf(t);
  const setPeriod = (p: PmPeriod) => { setF((x) => ({ ...x, period: p })); setHome(false); };
  const pick = (id: string) => { setK(id); setF((x) => ({ ...x, stage: 'all' })); if (id === 'all') setHome(true); };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const nAct = (filter.who !== 'all' ? 1 : 0) + (filter.st !== 'open' ? 1 : 0) + (f.mine ? 1 : 0) + (filter.milestoneOnly ? 1 : 0) + (filter.stage !== 'all' ? 1 : 0);
  const chips: Array<[keyof PmFilter, string]> = [
    ...(filter.stage !== 'all' ? [['stage', `단계: ${filter.stage}`] as [keyof PmFilter, string]] : []),
    ...(filter.who !== 'all' ? [['who', `담당: ${filter.who === '__none' ? '지정 필요' : people.nameOf(filter.who)}`] as [keyof PmFilter, string]] : []),
    ...(filter.st !== 'open' ? [['st', `상태: ${filter.st === 'all' ? '전체 상태' : filter.st}`] as [keyof PmFilter, string]] : []),
    ...(f.mine ? [['mine', '내 업무만'] as [keyof PmFilter, string]] : []),
    ...(filter.milestoneOnly ? [['milestoneOnly', '◆ 마일스톤만'] as [keyof PmFilter, string]] : []),
  ];
  const clearChip = (key: keyof PmFilter | 'all') =>
    setF((x) => (key === 'all' ? { ...PM_FILTER_DEFAULT, period: x.period, q: x.q } : { ...x, [key]: PM_FILTER_DEFAULT[key] }));

  // ── 업무 한 줄 ──
  const row = (t: PmTask, sub: '' | 'stage' | 'k') => {
    const l = L(t);
    const as = defaultAssignee(t);
    const n = taskPeople(t).length;
    const subs = d.subsByTask.get(t.id) ?? [];
    const tip = [t.name, t.output ? `산출물: ${t.output}` : '', `단계: ${t.stage}`, `${t.start || '-'} ~ ${t.end || '-'}`, `진행 ${l.pct}%`].filter(Boolean).join('\n');
    return (
      <div
        key={t.id}
        role="button"
        tabIndex={0}
        title={tip}
        onClick={() => setOpenId(t.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(t.id); }}
        className={`group flex cursor-pointer items-center gap-2.5 border-t border-border px-3 py-2 hover:bg-panel-alt ${sel.has(t.id) ? 'bg-teal-soft' : ''}`}
      >
        <span className="w-4 flex-none" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} title="일괄 수정·티켓 발행할 업무로 선택" aria-label={`${t.name} 선택`} />
        </span>
        <StatusRing pct={l.pct} tone={toneOf(t, l, today)} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[12.5px] font-bold text-ink">
            {t.milestone && <span className="mr-1 text-amber" title="마일스톤">◆</span>}
            {t.name}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10.5px] text-ink3">
            <span>{t.code}</span>
            {sub === 'stage' && <span>{t.stage}</span>}
            {sub === 'k' && <span>{shortOf(t.projectId)} · {t.stage}</span>}
            <span>진행 {l.pct}%</span>
            {t.md ? <span>{t.md} MD</span> : null}
            {subs.length > 0 && <span>세부 {subs.filter((s) => s.done).length}/{subs.length}</span>}
            {t.output && <span className="text-ink2">{t.output}</span>}
          </div>
        </div>
        <div className="flex w-[110px] flex-none items-center gap-1.5 text-[11.5px]">
          {as ? (
            <>
              <Avatar name={people.nameOf(as)} />
              <span className="truncate text-ink2">{people.nameOf(as)}</span>
              {n > 1 && <em className="text-[10.5px] not-italic text-ink3">+{n - 1}</em>}
            </>
          ) : (
            <span className="text-[11px] font-bold text-amber">담당 없음</span>
          )}
        </div>
        <DueCell t={t} l={l} today={today} />
        <div className="flex flex-none gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => setForm({ kind: 'edit', id: t.id })}>수정</Button>
          <Button size="sm" onClick={() => setForm({ kind: 'copy', id: t.id })} title="복사해서 새 업무 만들기">복사</Button>
        </div>
      </div>
    );
  };

  // ── 접는 묶음 ──
  const sec = (id: string, head: ReactNode, rows: PmTask[], defOpen: boolean, cap: number, sub: '' | 'stage' | 'k') => {
    const open = id in folds ? folds[id] : defOpen;
    const vis = more.has(id) ? rows : rows.slice(0, cap);
    return (
      <section key={id} className="border-b border-border last:border-b-0">
        <button
          type="button"
          onClick={() => setFolds((x) => ({ ...x, [id]: !open }))}
          title={open ? '접기' : '펼치기'}
          className="flex w-full items-center gap-2 bg-panel-alt px-3 py-2 text-left text-[12px] hover:bg-border/40"
        >
          <span className="w-3 text-ink3">{open ? '▾' : '▸'}</span>
          {head}
        </button>
        {open && (
          <div>
            {vis.map((t) => row(t, sub))}
            {rows.length > vis.length && (
              <button type="button" onClick={() => setMore((s) => new Set(s).add(id))} className="w-full border-t border-border py-2 text-[11.5px] font-bold text-teal hover:bg-panel-alt">
                나머지 {rows.length - vis.length}건 더 보기
              </button>
            )}
          </div>
        )}
      </section>
    );
  };
  const lateP = (n: number) => (n ? <Tag tone="bad">지연 {n}</Tag> : null);
  const isLt = (t: PmTask) => isLate(t, L(t), today);
  const setAllFold = (open: boolean, ids: string[]) => setFolds((x) => ({ ...x, ...Object.fromEntries(ids.map((i) => [i, open])) }));

  // ── 도구 막대 ──
  const toolbar = (homeBar: boolean) => (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
      {homeBar ? (
        <span className="text-[13px] font-bold text-ink">사업 <span className="ml-1 text-[11.5px] font-normal text-ink3">{projects.length}개</span></span>
      ) : (
        <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border-hi">
          {PM_PERIOD_TABS.map(([v, label], i) => (
            <button
              key={v}
              type="button"
              onClick={() => setF((x) => ({ ...x, period: v }))}
              title={v === 'rec' ? '7일 안에 시작하는 미완료 · 티켓 미발행 업무' : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-bold ${i ? 'border-l border-border-hi' : ''} ${filter.period === v ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}
            >
              {label}
              <b className={`text-[10.5px] ${filter.period === v ? 'text-white' : 'text-ink3'}`}>{cnt[v].toLocaleString()}</b>
            </button>
          ))}
        </div>
      )}
      <span className="flex-1" />
      <label className="flex items-center gap-1.5 rounded-lg border border-border-hi bg-panel px-2 py-1 text-[12px]">
        <span aria-hidden>🔍</span>
        <input
          className="w-44 bg-transparent outline-none"
          placeholder="업무 · 산출물 · 담당 검색"
          value={f.q}
          onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))}
        />
      </label>
      {!homeBar && (
        <>
          <div className="relative">
            <Button size="sm" onClick={() => setFltOpen((o) => !o)}>필터{nAct ? ` ${nAct}` : ''} ▾</Button>
            {fltOpen && (
              <div className="absolute right-0 z-20 mt-1 grid w-64 gap-2 rounded-lg border border-border-hi bg-panel p-3 text-[12px] shadow-lg">
                <label className="grid gap-1">사업
                  <select className="rounded border border-border-hi px-2 py-1" value={k} onChange={(e) => pick(e.target.value)}>
                    <option value="all">전체 사업</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{nameP(p)} · {p.company}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">담당
                  <select className="rounded border border-border-hi px-2 py-1" value={f.who} onChange={(e) => setF((x) => ({ ...x, who: e.target.value }))}>
                    <option value="all">전체 담당자</option>
                    <option value="__none">담당 지정 필요</option>
                    {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">상태
                  <select
                    className="rounded border border-border-hi px-2 py-1 disabled:opacity-50"
                    value={f.st}
                    disabled={filter.period === 'done' || board}
                    onChange={(e) => setF((x) => ({ ...x, st: e.target.value as PmFilter['st'] }))}
                  >
                    {([['open', '미완료'], ['계획', '계획'], ['진행중', '진행중'], ['완료', '완료'], ['all', '전체 상태']] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.mine} onChange={(e) => setF((x) => ({ ...x, mine: e.target.checked ? 'me' : '' }))} />내 업무만</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={f.milestoneOnly} onChange={(e) => setF((x) => ({ ...x, milestoneOnly: e.target.checked }))} />◆ 마일스톤만</label>
                {nAct > 0 && <Button size="sm" onClick={() => clearChip('all')}>조건 모두 지우기</Button>}
              </div>
            )}
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-border-hi">
            {([[false, '목록'], [true, '보드']] as const).map(([v, l], i) => (
              <button key={l} type="button" onClick={() => setBoard(v)} className={`px-2.5 py-1.5 text-[11.5px] font-bold ${i ? 'border-l border-border-hi' : ''} ${board === v ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'}`}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
  const chipRow = chips.length > 0 && (
    <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
      {chips.map(([key, txt]) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">
          {txt}
          <button type="button" onClick={() => clearChip(key)} title="이 조건 빼기" className="text-teal hover:text-ink">×</button>
        </span>
      ))}
    </div>
  );
  const sectionIds: string[] = [];
  const listHead = (n: number) => (
    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11.5px] text-ink3">
      <span>{n.toLocaleString()}건{filter.period === 'done' ? ' · 2주 안에 완료 · 최근 순' : ''}</span>
      {filter.period === 'rec' && list.length > 0 && (
        <button type="button" className="font-bold text-teal" onClick={() => setSel(new Set(list.map((t) => t.id)))}>발행 추천 모두 선택</button>
      )}
      <span className="flex-1" />
      {!board && (
        <>
          <button type="button" className="font-bold text-teal" onClick={() => setAllFold(false, sectionIds)}>모두 접기</button>
          <button type="button" className="font-bold text-teal" onClick={() => setAllFold(true, sectionIds)}>모두 펼치기</button>
        </>
      )}
    </div>
  );
  const foot = (
    <div className="border-t border-border px-3 py-2 text-[10.5px] text-ink3">
      {snap.sourceVersion} · 사업 {projects.length}개 · 업무 {tasks.length.toLocaleString()}건 · 티켓 0건 (2단계) · 저장: 메모리(새로 고침하면 처음 데이터로)
    </div>
  );
  const emptyBody = (
    <EmptyHint
      title={filter.period === 'all' ? '조건에 맞는 업무가 없습니다' : `${PM_PERIOD_TABS.find((x) => x[0] === filter.period)?.[1]} 업무가 없습니다`}
      hint={EMPTY_WHY[filter.period]}
    />
  );

  let main: ReactNode;
  if (isHome) {
    main = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {KPIS.map(([v, label, desc]) => (
            <button
              key={v}
              type="button"
              onClick={() => setPeriod(v)}
              title="눌러서 이 업무 목록 보기"
              className="rounded-xl border border-border bg-panel px-3 py-2.5 text-left shadow-sm hover:border-teal"
            >
              <span className="text-[11.5px] font-bold text-ink2">{label}</span>
              <b className={`block text-[22px] leading-tight ${v === 'late' && cnt.late ? 'text-danger' : 'text-ink'}`}>{(cnt[v] ?? 0).toLocaleString()}</b>
              <small className="text-[10.5px] text-ink3">{desc}</small>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-panel">
          {toolbar(true)}
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => <ProjectCardView key={p.id} p={p} d={d} name={nameP(p)} onOpen={() => pick(p.id)} />)}
          </div>
          {foot}
        </div>
      </>
    );
  } else if (k !== 'all') {
    const P = projOf(k);
    const TP = tasks.filter((t) => t.projectId === k);
    const SG = stagesOf(TP, liveMap, today);
    const [ps0, pe0] = spanOf(TP);
    const pst = P?.start || ps0;
    const pen = P?.end || pe0;
    const ptp = timePct(pst, pen, today);
    const cur = currentStage(SG, today);
    const aP = mdAvg(TP, liveMap);
    const lateN = TP.filter(isLt).length;
    const G = groupsOf(TP, liveMap)
      .map((g) => ({ ...g, rows: list.filter((t) => (t.group || t.stage) === g.group) }))
      .filter((g) => g.rows.length);
    G.forEach((g) => sectionIds.push(`g:${k}:${g.group}`));
    const body = board ? (
      <WbsBoard list={list} d={d} people={people} shortOf={shortOf} onOpen={setOpenId} mut={mut} />
    ) : G.length ? (
      G.map((g, i) =>
        sec(
          `g:${k}:${g.group}`,
          <>
            <b className="text-ink">{g.group}</b>
            <span className="text-[11px] text-ink3">{g.rows.length}{g.rows.length !== g.n ? ` / ${g.n}` : ''}</span>
            {lateP(g.rows.filter(isLt).length)}
            <span className="flex-1" />
            <span className="text-[11px] text-ink3">완료 {g.done}/{g.n} · {g.md} MD</span>
            <MiniBar pct={g.pct} />
            <span className="w-9 text-right text-[11.5px] font-bold text-ink">{g.pct}%</span>
          </>,
          g.rows,
          !!filter.q.trim() || filter.stage !== 'all' || i === 0,
          30,
          '',
        ),
      )
    ) : TP.length ? (
      emptyBody
    ) : (
      <EmptyHint title="이 사업은 아직 업무 목록이 없습니다" hint="개발 TASK 목록을 만들면 여기에 들어갑니다. [+ 업무 추가]로 직접 넣을 수도 있습니다." />
    );
    main = (
      <>
        <div className="mb-3 rounded-xl border border-border bg-panel p-4">
          <div className="mb-2 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => pick('all')}>← 전체 사업</Button>
            <span className="flex-1" />
            <select className="rounded border border-border-hi px-2 py-1 text-[12px]" value={k} onChange={(e) => pick(e.target.value)} title="다른 사업으로 바꾸기">
              {projects.map((p) => <option key={p.id} value={p.id}>{nameP(p)} · {p.company}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ProjectTag>{P ? nameP(P) : k}</ProjectTag>
                <h3 className="text-[16px] font-bold text-ink">{P?.company || k}</h3>
                {lateP(lateN)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink3">{P?.biz}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-ink2">
                <span>{pst || '-'} ~ {pen || '-'}</span>
                {P?.pmName && <span>PM {P.pmName}</span>}
                <span>업무 {TP.length}건{TP.some((t) => t.md) ? ` · 공수 ${mdSum(TP)} MD` : ''}</span>
                <span>{cur ? <>지금 업무 · <b>{cur.stage}</b></> : TP.length ? '모든 단계 완료' : ''}</span>
              </div>
            </div>
            <div className="flex w-64 items-center gap-3">
              <div className="text-[28px] font-bold leading-none text-ink">{TP.length ? aP : '-'}<small className="text-[13px]">{TP.length ? '%' : ''}</small></div>
              <div className="flex-1">
                <ProgressBar pct={aP} todayPct={ptp} big />
                <div className="mt-1 flex justify-between text-[10.5px] text-ink3"><span>진행률</span><span>{ptp != null ? `기간 ${ptp}% 지남` : ''}</span></div>
              </div>
            </div>
          </div>
          {SG.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {SG.map((x, i) => (
                <button
                  key={x.stage}
                  type="button"
                  onClick={() => setF((y) => ({ ...y, stage: y.stage === x.stage ? 'all' : x.stage }))}
                  title={`${x.stage} · ${x.n}건 · ${x.pct}%${x.late ? ` · 지연 ${x.late}` : ''} — 눌러서 이 단계만 보기`}
                  className={`flex min-w-[132px] flex-none flex-col gap-1 rounded-lg border px-2.5 py-2 text-left ${filter.stage === x.stage ? 'border-teal bg-teal-soft' : x === cur ? 'border-navy' : 'border-border'} ${x.allDone ? 'opacity-70' : ''}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`grid h-4 w-4 place-items-center rounded-full text-[9.5px] font-bold ${x.allDone ? 'bg-ok text-white' : x === cur ? 'bg-navy text-white' : 'bg-border text-ink2'}`}>{x.allDone ? '✓' : i + 1}</span>
                    <b className="truncate text-[11.5px] text-ink">{x.stage}</b>
                  </span>
                  <small className="text-[10.5px] text-ink3">
                    {x.start ? `${monthDay(x.start)} – ${monthDay(x.end)}` : `업무 ${x.n}건${x.tasks.some((t) => t.md) ? ` · ${mdSum(x.tasks)} MD` : ''}`}
                  </small>
                  <span className="flex items-center gap-1.5"><MiniBar pct={x.pct} w={70} /><span className="text-[10.5px] font-bold text-ink2">{x.pct}%</span>{x.late ? <em className="text-[10.5px] font-bold not-italic text-danger">지연 {x.late}</em> : null}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-panel">
          {toolbar(false)}
          {chipRow}
          {listHead(list.length)}
          <div>{body}</div>
          {foot}
        </div>
      </>
    );
  } else {
    const groups = projects.map((p) => ({ p, rows: list.filter((t) => t.projectId === p.id) })).filter((g) => g.rows.length);
    groups.forEach((g) => sectionIds.push(`k:${g.p.id}`));
    const body = board ? (
      <WbsBoard list={list} d={d} people={people} shortOf={shortOf} onOpen={setOpenId} mut={mut} />
    ) : groups.length ? (
      groups.map(({ p, rows }) =>
        sec(
          `k:${p.id}`,
          <>
            <ProjectTag>{nameP(p)}</ProjectTag>
            <b className="text-ink">{p.company}</b>
            <span className="text-[11px] text-ink3">{rows.length}</span>
            {lateP(rows.filter(isLt).length)}
            <span className="flex-1" />
            <span role="link" tabIndex={0} className="text-[11px] font-bold text-teal" onClick={(e) => { e.stopPropagation(); pick(p.id); }} onKeyDown={(e) => { if (e.key === 'Enter') pick(p.id); }}>이 사업 열기 →</span>
          </>,
          rows,
          true,
          8,
          'stage',
        ),
      )
    ) : (
      emptyBody
    );
    main = (
      <>
        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-ink3">
          <Button size="sm" variant="ghost" onClick={() => pick('all')}>← 사업 카드로</Button>
          <span>전체 사업의 업무를 사업별로 묶어 보여 줍니다</span>
        </div>
        <div className="rounded-xl border border-border bg-panel">
          {toolbar(false)}
          {chipRow}
          {listHead(list.length)}
          <div>{body}</div>
          {foot}
        </div>
      </>
    );
  }

  const selTasks = [...sel].map((id) => d.taskMap.get(id)).filter((t): t is PmTask => !!t);
  const needA = selTasks.filter((t) => !defaultAssignee(t)).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold text-ink">업무 목록</h2>
        <button type="button" onClick={() => setHelp((o) => !o)} title={help ? '설명 닫기' : '이 화면 설명 보기'} className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] font-bold ${help ? 'border-teal bg-teal text-white' : 'border-border-hi text-ink3'}`}>?</button>
        <span className="flex-1" />
        <Button size="sm" onClick={() => setLogOpen(true)}>🕘 변경 이력</Button>
        <Button size="sm" onClick={() => exportTasksCsv(tasks, d, people.nameOf, shortOf)} title="전체 업무를 엑셀(CSV)로 받습니다">⬇ 엑셀 내보내기</Button>
        <Button size="sm" variant="primary" onClick={() => setForm({ kind: 'new', projectId: k === 'all' ? projects[0]?.id ?? '' : k, stage: filter.stage !== 'all' ? filter.stage : '' })}>+ 업무 추가</Button>
      </div>
      {help && (
        <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] leading-relaxed text-ink2">
          첫 화면은 사업 카드입니다. 카드를 누르면 그 사업의 단계 흐름과 묶음별 업무가 열리고, 첫 묶음만 펼쳐집니다. 업무 앞 동그라미는 진행률(초록 = 완료, 빨강 = 지연)이고, 줄을 누르면 상세가 열립니다. 체크해서 일괄 수정합니다 (티켓 발행은 2단계).
          위 숫자 칸을 누르면 그 업무 목록이 열립니다.
        </p>
      )}
      {main}

      {sel.size > 0 && (
        <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal bg-panel px-4 py-2.5 shadow-lg">
          <b className="text-[12.5px]">선택 {sel.size}건</b>
          {needA > 0 && <Tag tone="bad">담당자 지정 필요 {needA}건</Tag>}
          <span className="text-[11px] text-ink3">{[...new Set(selTasks.map((t) => shortOf(t.projectId)))].join(', ')}</span>
          <span className="flex-1" />
          <Button size="sm" onClick={() => setSel(new Set())}>선택 해제</Button>
          <Button size="sm" onClick={() => setBulk(true)}>✏ 일괄 수정</Button>
          <Button size="sm" variant="primary" disabled title="티켓은 2단계에서 옮깁니다">🎫 티켓 발행 ({sel.size}건) — 2단계</Button>
        </div>
      )}

      {openId && (
        <TaskDetailModal
          id={openId}
          d={d}
          people={people}
          mut={mut}
          shortOf={shortOf}
          onClose={() => setOpenId(null)}
          onEdit={() => { setForm({ kind: 'edit', id: openId }); setOpenId(null); }}
        />
      )}
      {form && <TaskFormModal mode={form} d={d} people={people} mut={mut} shortOf={shortOf} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); if (id) setOpenId(id); }} />}
      {bulk && <BulkEditModal ids={[...sel]} d={d} people={people} mut={mut} onClose={() => setBulk(false)} onDone={() => { setBulk(false); setSel(new Set()); }} />}
      {logOpen && <ChangeLogModal d={d} people={people} shortOf={shortOf} projectId={k} onClose={() => setLogOpen(false)} />}
    </div>
  );
}

/** 사업 카드 (pcard 1723) */
function ProjectCardView({ p, d, name, onOpen }: { p: PmProject; d: PmDerived; name: string; onOpen: () => void }) {
  const { today, liveMap } = d;
  const ts = d.snap.tasks.filter((t) => t.projectId === p.id);
  const c = projectCard(p, ts, liveMap, today);
  const has = c.n > 0;
  return (
    <button type="button" onClick={onOpen} title={`${p.company} 업무 보기`} className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-3 text-left shadow-sm hover:border-teal">
      <div className="flex items-center gap-2">
        <ProjectTag>{name}</ProjectTag>
        <b className="truncate text-[13px] text-ink">{p.company || name}</b>
        <span className="flex-1" />
        {c.late > 0 && <Tag tone="bad">지연 {c.late}</Tag>}
      </div>
      <div className="truncate text-[11px] text-ink3">{p.biz || ' '}</div>
      <div className="flex items-center gap-3">
        <div className={`text-[26px] font-bold leading-none ${has ? 'text-ink' : 'text-ink3'}`}>{has ? c.pct : '-'}{has && <small className="text-[12px]">%</small>}</div>
        <div className="flex-1">
          <ProgressBar pct={has ? c.pct : 0} todayPct={c.timePct} />
          <div className="mt-1 flex justify-between text-[10px] text-ink3">
            <span>{yearMonth(c.start)}</span>
            <span>{c.timePct != null ? `기간 ${c.timePct}% 지남` : ''}</span>
            <span>{yearMonth(c.end)}</span>
          </div>
        </div>
      </div>
      <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-border">
        {has ? c.stages.map((x) => (
          <i
            key={x.stage}
            title={`${x.stage} · ${x.n}건 · ${x.pct}%${x.late ? ` · 지연 ${x.late}` : ''}`}
            className={`block h-full ${x.allDone ? 'bg-ok' : x.late ? 'bg-danger' : x.pct > 0 ? 'bg-teal' : 'bg-border-hi'} ${x === c.current ? 'outline outline-1 outline-navy' : ''}`}
            style={{ flex: x.n }}
          />
        )) : <i className="block flex-1" />}
      </div>
      <div className="text-[11.5px] text-ink2">
        {has ? (c.current ? <><span className="text-ink3">지금 업무 </span><b>{c.current.stage}</b></> : '모든 단계 완료') : <span className="text-ink3">업무 목록 작성 전</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 border-t border-border pt-2 text-[11px] text-ink3">
        <span>업무 <b className={has ? 'text-ink' : 'text-amber'}>{has ? c.n : '없음'}</b></span>
        {has && <span>진행 중 <b className="text-ink">{c.now}</b></span>}
        {has && <span>7일 내 마감 <b className={c.due7 ? 'text-amber' : 'text-ink'}>{c.due7}</b></span>}
        {has && c.noAssignee > 0 && <span>담당 없음 <b className="text-amber">{c.noAssignee}</b></span>}
        <span className="flex-1" />
        <span className="font-bold text-teal">열기 →</span>
      </div>
    </button>
  );
}

