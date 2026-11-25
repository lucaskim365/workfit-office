import { useState, type MouseEvent, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { diffDays, leftText, monthDay, shortName, stripTitle } from '@/domain/pm/rules';
import { agoText, dday, dlEff, lateActions, msAlerts, msOld, type Deadline } from '@/domain/pm/site';
import { usePmDerived, usePmMutations, usePmSiteMutations, usePmSites, type PmSiteRow } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, SIGNAL_BG, ScreenHead, SiteStatusTag, StagePill, signalOf } from './parts';
import { DeadlineListModal, PastModal, TaskListModal } from './DashModals';

/**
 * 대시보드 › 통합 사업 현황 › 전체 사업 (데모 pDash 3391) — 관제 보드.
 * 사업마다 신호등 + 진척(계획 대비) + 다음 기한 + 챙길 것 칩. 줄을 누르면 그 사업 화면.
 * 숫자는 모두 협약일·종료일·계획서 내장 데이터·업무 목록으로 계산한다 (입력 칸 없음).
 */
type Pop =
  | { kind: 'soon' | 'buyer' | 'fix' | 'agr' | 'stale' }
  | { kind: 'past'; only?: string }
  | { kind: 'late'; k: string }
  | { kind: 'oldMs' };

export function OverviewView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  const [urgent, setUrgent] = useState(false);
  // 검색 '지난 기한 정리'에서 오면 ?pop=past (한 번만 읽음, 데모 pastOpen)
  const [pop, setPop] = useState<Pop | null>(() => (params.get('pop') === 'past' ? { kind: 'past' } : null));
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });

  if (!d || !S) return <EmptyHint title="사업 현황을 불러오는 중입니다" />;
  const { rows, all } = S;
  const today = d.today;

  const go = (v: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    next.set('v', v);
    for (const [a, b] of Object.entries(extra)) next.set(a, b);
    setParams(next);
    void params;
  };
  const openSite = (id: string, extra: Record<string, string> = {}) => go('dash/site', { k: id, ...extra });

  if (!rows.length) {
    return <EmptyHint title="등록된 사업이 없습니다" hint="기준정보 › 사업에서 사업을 등록하거나(6단계), 업무 목록에 업무가 들어오면 여기 나옵니다." />;
  }

  const sumN = (f: (r: PmSiteRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const nSoon = sumN((r) => r.b.soon.length);
  const nPast = sumN((r) => r.b.past.length);
  const nBuyer = sumN((r) => r.b.buyer.length);
  const nFix = sumN((r) => r.b.fix.length);
  const nFixW = sumN((r) => r.b.fixWait);
  const nAgr = rows.filter((r) => r.b.agr).length;
  const nStale = rows.filter((r) => r.b.stale).length;

  // 확인 필요: 표에 없는 것만 — 2주 안·최근에 지난 마일스톤, 기한 지난 액션 아이템. 14일 넘게 지난 마일스톤은 한 줄로 묶음
  const ctxOf = new Map(rows.map((r) => [r.p.id, r.c]));
  const ms = msAlerts(rows.map((r) => r.c), new Map(d.snap.msOk.map((m) => [m.id, m])))
    .filter((a) => a.lv !== 'ok' && !(rows.find((r) => r.p.id === a.p.id)?.b.next?.taskId === a.t.id));
  const oldMs = ms.filter((a) => msOld(ctxOf.get(a.p.id)!, a.t));
  const warn: Array<{ lv: 'bad' | 'warn'; tag: string; who: string; title: string; meta: string; act: () => void }> = [
    ...ms.filter((a) => !msOld(ctxOf.get(a.p.id)!, a.t)).map((a) => ({ lv: a.lv as 'bad' | 'warn', tag: '◆ 마일스톤', who: shortOf(a.p.id), title: a.t.name, meta: leftText(a.t.end, today), act: () => modals.openTask(a.t.id) })),
    ...lateActions(d.snap.actions, today).map((a) => ({ lv: 'warn' as const, tag: '액션 아이템', who: people.nameOf(a.whoId) || '담당 없음', title: a.text, meta: `기한 ${diffDays(a.due, today)}일 경과`, act: () => go('doc/meet') })),
  ];

  const order = urgent ? [...rows].sort((a, b) => b.b.score - a.b.score || a.b.stats.gap - b.b.stats.gap) : rows;
  const groupsOf = (f: (r: PmSiteRow) => Deadline[]) => rows.map((r) => ({ projectId: r.p.id, L: f(r) }));

  const kpi = (label: string, v: number, unit: string, sub: ReactNode, onClick: () => void, bad = false) => (
    <button type="button" onClick={onClick} title="눌러서 목록 보기" className="rounded-xl border border-border bg-panel px-4 py-3 text-left shadow-sm hover:border-teal">
      <span className="text-[11.5px] font-bold text-ink2">{label}</span>
      <b className={`block text-[24px] leading-tight ${bad ? 'text-danger' : 'text-ink'}`}>{v}<small className="ml-0.5 text-[12px] font-bold text-ink3">{unit}</small></b>
      <small className="text-[10.5px] text-ink3">{sub}</small>
    </button>
  );

  return (
    <div className="space-y-4">
      <ScreenHead title="통합 사업 현황" desc="사업마다 기한 · 보완 · 협약변경 · 갱신 상태를 한 줄로 보고, 줄을 누르면 그 사업 화면으로 들어갑니다">
        <Button size="sm" variant="secondary" disabled title="사업 등록은 기준정보 › 사업 화면과 같이 6단계에서 옮깁니다">+ 사업 등록 (6단계)</Button>
        <Button size="sm" variant="secondary" disabled title="이슈 등록은 이슈 화면과 같이 5단계에서 옮깁니다">+ 이슈 등록 (5단계)</Button>
      </ScreenHead>

      <SiteChips rows={rows} all={all} cur={null} shortOf={shortOf} onAll={() => go('dash/overview')} onPick={(id) => openSite(id)} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpi('2주 안 기한', nSoon, '건', '관리기준 · 계획서 약속 · 마일스톤 (내부 마감 기준)', () => setPop({ kind: 'soon' }))}
        {kpi('도입기업 챙길 일', nBuyer, '건', '지났거나 2주 안 · 도입기업이 할 일', () => setPop({ kind: 'buyer' }))}
        {kpi('보완 미조치', nFix, '건', `점검 지적 사항 · 확인 대기 ${nFixW}건`, () => setPop({ kind: 'fix' }), nFix > 0)}
        <div className="grid grid-cols-2 rounded-xl border border-border bg-panel shadow-sm">
          <button type="button" onClick={() => setPop({ kind: 'agr' })} className="px-4 py-3 text-left hover:bg-panel-alt" title="업무 목록이 협약 종료일보다 늦게 끝나는 사업">
            <span className="text-[11.5px] font-bold text-ink2">협약변경 필요</span>
            <b className={`block text-[24px] leading-tight ${nAgr ? 'text-danger' : 'text-ink'}`}>{nAgr}<small className="ml-0.5 text-[12px] text-ink3">개</small></b>
          </button>
          <button type="button" onClick={() => setPop({ kind: 'stale' })} className="border-l border-border px-4 py-3 text-left hover:bg-panel-alt" title="2주 넘게 진행률 갱신이 없는 사업 — 진척률을 믿기 어려움">
            <span className="whitespace-nowrap text-[11.5px] font-bold text-ink2">2주 넘게 갱신 없음</span>
            <b className={`block text-[24px] leading-tight ${nStale ? 'text-amber' : 'text-ink'}`}>{nStale}<small className="ml-0.5 text-[12px] text-ink3">개</small></b>
          </button>
        </div>
      </div>
      {nPast > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[12px]">
          <span className="font-bold text-danger">지난 기한 {nPast}건</span>
          <span className="flex-1 text-ink2">날짜가 지났는데 완료 체크가 안 된 관리기준 · 계획서 약속 · 마일스톤입니다. 이미 한 일이면 한 번에 완료 처리하세요.</span>
          <Button size="sm" variant="danger" onClick={() => setPop({ kind: 'past' })}>지난 기한 {nPast}건 정리 ›</Button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <CardHead title="사업 현황">
          <Button size="sm" variant={urgent ? 'primary' : 'secondary'} onClick={() => setUrgent((x) => !x)} title="지난 기한 · 협약변경 · 보완 미조치 · 임박 기한 · 갱신 안 됨 · 지연 순으로 급한 사업 먼저">
            {urgent ? '기본 순서로' : '급한 순'}
          </Button>
          <span className="flex-1" />
          <span className="text-[11px] text-ink3">왼쪽 점 = 상태 신호 · 막대 = 실적, 세로선 = 오늘 계획 · 줄을 누르면 그 사업 화면</span>
        </CardHead>
        <div>
          {order.map((r) => (
            <Lane key={r.p.id} r={r} today={today} short={shortOf(r.p.id)}
              onOpen={() => openSite(r.p.id)}
              onLate={() => setPop({ kind: 'late', k: r.p.id })}
              onBuyer={() => openSite(r.p.id, { side: 'buyer' })}
              onIssue={() => go('risk/issue')} />
          ))}
        </div>
        <div className="border-t border-border px-4 py-2.5 text-[11px] text-ink3">
          ※ 진척률 · 상태는 오늘({today}) 기준 계획 대비 실적 · 집계 대상은 엑셀 통합관제와 같음 (협약 이전 · 프로젝트관리 · [FP] 묶음 줄 제외) · 업무 목록 엑셀 최종 갱신일 {d.snap.baseDate}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <CardHead title="확인 필요">
          <span className="flex-1" />
          <span className="text-[11px] text-ink3" title="위 표에 칸이 없는 것만: 2주 안 · 지난 지 14일 안 된 마일스톤, 기한 지난 액션 아이템">{warn.length}건 · 표에 없는 것만</span>
        </CardHead>
        <div className="px-4 py-2">
          {warn.length ? warn.map((w, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border py-1.5 text-[12px] last:border-b-0">
              <span className={`h-2 w-2 flex-none rounded-full ${w.lv === 'bad' ? 'bg-danger' : 'bg-amber'}`} />
              <Tag>{w.tag}</Tag>
              <b className="text-ink">{w.who}</b>
              <span className="min-w-0 flex-1 truncate">{w.title}</span>
              <span className={`whitespace-nowrap text-[11px] ${w.lv === 'bad' ? 'text-danger' : 'text-ink3'}`}>{w.meta}</span>
              <Button size="sm" variant="secondary" onClick={w.act}>보기</Button>
            </div>
          )) : (
            <p className="py-2 text-[11.5px] text-ink3">2주 안 · 최근에 지난 마일스톤과 기한 지난 액션 아이템이 없습니다. 업무에 마일스톤(◆)과 종료일을 넣거나, 회의록에서 액션 아이템에 기한을 넣으면 여기 나옵니다.</p>
          )}
        </div>
        {oldMs.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-[12px]">
            <span className="flex-1 text-ink2">오래 지난 마일스톤 (예정일이 14일 넘게 지났는데 완료 안 됨)</span>
            <Button size="sm" variant="secondary" onClick={() => setPop({ kind: 'oldMs' })}>{oldMs.length}건 ›</Button>
          </div>
        )}
      </section>

      {pop?.kind === 'soon' && (
        <DeadlineListModal title="2주 안 기한" hint="아직 안 지났고 내부 마감(없으면 기한)까지 14일 이하인 것" groups={groupsOf((r) => r.b.soon)} today={today} shortOf={shortOf} onOpenSite={(k) => openSite(k)} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'buyer' && (
        <DeadlineListModal title="도입기업 챙길 일" hint="도입기업이 해야 하는(함께 하는 일 포함) 기한 중 지났거나 내부 마감까지 14일 이하 — PM이 챙김" groups={groupsOf((r) => r.b.buyer)} today={today} shortOf={shortOf} onOpenSite={(k) => openSite(k, { side: 'buyer' })} onClose={() => setPop(null)} />
      )}
      {(pop?.kind === 'fix' || pop?.kind === 'agr' || pop?.kind === 'stale') && (
        <SiteSignalModal kind={pop.kind} rows={rows} today={today} shortOf={shortOf} onOpenSite={(k) => openSite(k)} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'past' && (
        <PastModal rows={rows} only={pop.only} today={today} shortOf={shortOf}
          onDone={(items, date) => smut.checkDeadlines.mutateAsync({ items, date, bulk: true })}
          onOpenTask={(id) => modals.openTask(id)} onOpenSite={(k) => openSite(k)} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'late' && (
        <TaskListModal title={`${shortOf(pop.k)} · 지연 업무`} hint="종료일이 오늘보다 지났는데 끝나지 않은 업무 · 오래된 순" d={d} shortOf={shortOf}
          tasks={rows.find((r) => r.p.id === pop.k)?.b.stats.late ?? []} onOpenTask={(id) => modals.openTask(id)} onClose={() => setPop(null)}
          footer={<Button onClick={() => go('task/wbs', { k: pop.k, period: 'late' })}>업무 목록에서 보기 →</Button>} />
      )}
      {pop?.kind === 'oldMs' && (
        <TaskListModal title="오래 지난 마일스톤" hint="예정일이 14일 넘게 지났는데 완료 안 된 마일스톤 · 오래된 순. 실제로 끝났으면 업무 목록에서 완료 처리하면 빠집니다" d={d} shortOf={shortOf}
          tasks={oldMs.map((a) => a.t)} extra={(t) => <span className="text-[11px] text-danger">{diffDays(t.end, today)}일 경과</span>} onOpenTask={(id) => modals.openTask(id)} onClose={() => setPop(null)} />
      )}
      {modals.node}
    </div>
  );
}

/** 사업 칩 줄: [전체 n] · 사업들 · | 탈락 (siteChips) */
export function SiteChips({ rows, all, cur, shortOf, onAll, onPick }: {
  rows: PmSiteRow[];
  all: PmSiteRow[];
  cur: string | null;
  shortOf: (id: string) => string;
  onAll: () => void;
  onPick: (id: string) => void;
}) {
  const dropped = all.filter((r) => !rows.includes(r));
  const chip = (on: boolean, children: ReactNode, onClick: () => void, title?: string, strike = false) => (
    <button type="button" onClick={onClick} title={title}
      className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-bold ${on ? 'border-teal bg-teal text-white' : 'border-border-hi bg-panel text-ink2 hover:border-teal'} ${strike && !on ? 'line-through opacity-55' : ''}`}>
      {children}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chip(!cur, `전체 ${rows.length}`, onAll, '모든 사업을 한 줄씩 비교')}
      {rows.map((r) => <span key={r.p.id}>{chip(cur === r.p.id, shortOf(r.p.id), () => onPick(r.p.id), `${r.p.company} · ${r.p.biz}`)}</span>)}
      {dropped.length > 0 && <span className="mx-1 text-ink3">| 탈락</span>}
      {dropped.map((r) => <span key={r.p.id}>{chip(cur === r.p.id, shortOf(r.p.id), () => onPick(r.p.id), `탈락 · ${r.p.company}`, true)}</span>)}
    </div>
  );
}

/** 관제 보드 한 줄 (lane) */
function Lane({ r, today, short, onOpen, onLate, onBuyer, onIssue }: {
  r: PmSiteRow;
  today: string;
  short: string;
  onOpen: () => void;
  onLate: () => void;
  onBuyer: () => void;
  onIssue: () => void;
}) {
  const { p, b, stage } = r;
  const sig = signalOf(b.status);
  const nx = b.next;
  const nxL = nx ? diffDays(today, dlEff(nx)) : null;
  const iss = r.c.issues.filter((i) => i.status !== '해결');
  const stop = (f: () => void) => (e: MouseEvent) => { e.stopPropagation(); f(); };
  const chips: ReactNode[] = [];
  const chipCls = (tone: 'plain' | 'bad' | 'warn') => `inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
    tone === 'bad' ? 'border-danger/30 bg-danger/10 text-danger' : tone === 'warn' ? 'border-amber/30 bg-amber-soft text-amber' : 'border-border-hi bg-panel text-ink2'}`;
  if (b.buyer.length) chips.push(<button key="b" type="button" className={`${chipCls('plain')} hover:border-teal`} onClick={stop(onBuyer)} title="지났거나 2주 안인 도입기업 몫 기한">도입기업 챙길 일 <b className="text-ink">{b.buyer.length}</b></button>);
  if (b.fix.length) chips.push(<button key="f" type="button" className={chipCls('bad')} onClick={stop(onOpen)} title="점검 보완 지적 중 확인 안 된 것">보완 미조치 <b>{b.fix.length}</b></button>);
  if (b.agr) chips.push(<span key="a" className={chipCls(b.agr.kind === '승인' ? 'bad' : 'warn')} title={`업무 목록이 협약 종료일보다 ${b.agr.days}일 늦게 끝남`}>협약변경 {b.agr.kind} 필요</span>);
  if (b.miss) chips.push(<button key="m" type="button" className={`${chipCls('plain')} hover:border-teal`} onClick={stop(onOpen)} title="업무 목록에 없거나 날짜가 없는 관리기준 필수 TASK — 사업 화면에서 연결">필수 TASK 빠짐 <b className="text-ink">{b.miss}</b></button>);
  if (iss.length) chips.push(<button key="i" type="button" className={chipCls(iss.some((i) => i.sev === '긴급') ? 'bad' : 'plain')} onClick={stop(onIssue)} title="미해결 이슈">이슈 <b>{iss.length}</b></button>);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      title={`${p.summary || p.company} — 누르면 이 사업 화면`}
      className="grid cursor-pointer grid-cols-1 gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-panel-alt lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${SIGNAL_BG[sig]}`} title={b.status} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <ProjectTag>{short}</ProjectTag>
            <b className="text-[13px] text-ink">{p.company}</b>
            <StagePill s={stage} />
          </div>
          <div className="mt-0.5 truncate text-[11px] text-ink3">
            {p.biz} · {p.pmName ? p.pmName.split(/[,·]/).map(stripTitle).join(', ') : 'PM 미정'}{p.end ? ` · 종료 ${dday(p.end, today)}` : ''}
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <b className="text-[17px] text-ink">{Math.round(b.stats.act)}<small className="text-[11px]">%</small></b>
          <span className="text-[11px] text-ink3">계획 {Math.round(b.stats.plan)}%</span>
          <span className="flex-1" />
          <SiteStatusTag st={b.status} />
        </div>
        <div className="relative mt-1 h-1.5 rounded-full bg-border">
          <i className="block h-full rounded-full bg-teal" style={{ width: `${Math.min(100, b.stats.act)}%` }} />
          <em className="absolute -top-1 block h-3.5 w-0.5 rounded bg-navy" style={{ left: `${Math.min(100, b.stats.plan)}%` }} title={`오늘 계획 ${Math.round(b.stats.plan)}%`} />
        </div>
        <div className="mt-1">
          {b.stats.late.length
            ? <button type="button" onClick={stop(onLate)} className="text-[11px] font-bold text-danger hover:underline" title="지연 업무 목록">지연 업무 {b.stats.late.length} ›</button>
            : <span className="text-[11px] text-ink3">지연 업무 없음</span>}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        {nx ? (
          <>
            <div className={`flex-none rounded-lg border px-2.5 py-1 text-center leading-tight ${nxL != null && nxL <= 7 ? 'border-amber/40 bg-amber-soft' : 'border-border bg-panel-alt'}`}>
              <b className="block text-[14px] text-ink">{monthDay(nx.due)}</b>
              <span className={`text-[10.5px] ${nxL != null && nxL < 0 ? 'text-danger' : 'text-ink3'}`}>{leftText(dlEff(nx), today)}</span>
            </div>
            <div className="min-w-0">
              <small className="block text-[10.5px] text-ink3">{nx.src}{nx.inner ? ` · 내부 ${monthDay(nx.inner)}` : ''}</small>
              <span className="line-clamp-2 text-[12px] font-bold text-ink" title={nx.t}>{nx.t}</span>
            </div>
          </>
        ) : <span className="text-[11.5px] text-ink3">다음 기한 없음</span>}
      </div>
      <div>
        <div className="flex flex-wrap gap-1">{chips.length ? chips : <span className="inline-flex items-center rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok">✓ 챙길 것 없음</span>}</div>
        <div className="mt-1 text-[11px] text-ink3" title={`최종 갱신 ${b.upd}${b.stale ? ' · 2주 넘게 갱신 없음 — 진척률을 그대로 믿기 어렵습니다' : ''}`}>
          갱신 <span className={b.stale ? 'font-bold text-amber' : ''}>{agoText(b.upd, today)}</span>
        </div>
      </div>
    </div>
  );
}

/** 보완 미조치 · 협약변경 필요 · 2주 넘게 갱신 없음 — 사업 목록 팝업 */
function SiteSignalModal({ kind, rows, today, shortOf, onOpenSite, onClose }: {
  kind: 'fix' | 'agr' | 'stale';
  rows: PmSiteRow[];
  today: string;
  shortOf: (id: string) => string;
  onOpenSite: (id: string) => void;
  onClose: () => void;
}) {
  const T = { fix: ['보완 미조치', '점검 판정이 보완일 때 적은 지적 사항 중 확인 안 된 것. 사업 화면의 기한 목록 [결과 기록]에서 지적 사항을 적고 조치 상태를 바꿉니다.'], agr: ['협약변경 필요', '업무 목록의 마지막 종료일이 협약 종료일보다 늦은 사업. 3개월 이상이면 승인, 미만이면 등록 (세부관리기준 24조).'], stale: ['2주 넘게 갱신 없음', '업무 목록 기준일 · 변경 이력 · 티켓 처리 중 가장 최근 날이 14일 넘게 지난 사업 — 진척률을 그대로 믿기 어렵습니다.'] }[kind];
  const L = rows.filter((r) => (kind === 'fix' ? r.b.fix.length : kind === 'agr' ? r.b.agr : r.b.stale));
  return (
    <Modal open onClose={onClose} width={760} title={`${T[0]} — ${L.length}${kind === 'fix' ? '개 사업' : '개'}`} footer={<><span className="flex-1 text-[11px] text-ink3">{T[1]}</span><Button onClick={onClose}>닫기</Button></>}>
      {L.length ? L.map((r) => (
        <div key={r.p.id} className="flex items-center gap-2 border-b border-border py-2 text-[12px]">
          <ProjectTag>{shortOf(r.p.id)}</ProjectTag>
          <span className="flex-1">
            {kind === 'fix' && `지적 ${r.b.fix.length}건 · 확인 대기 ${r.b.fixWait}건`}
            {kind === 'agr' && r.b.agr && `업무 목록이 ${r.b.agr.days}일 늦게 끝남 (${monthDay(r.b.agr.end)}) → ${r.b.agr.kind} 필요`}
            {kind === 'stale' && `최종 갱신 ${r.b.upd} (${agoText(r.b.upd, today)})`}
          </span>
          <Button size="sm" variant="secondary" onClick={() => onOpenSite(r.p.id)}>사업 화면 ›</Button>
        </div>
      )) : <EmptyHint title={`${T[0]} 사업이 없습니다`} hint={T[1]} />}
    </Modal>
  );
}
