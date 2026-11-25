import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { diffDays, monthDay, shortName } from '@/domain/pm/rules';
import {
  agoText, agrWarn, weekStart, dday, dlStat, fnLinks, fnSt, GOV_FOLLOW_OF, GOV_INNER, govItems, govResTone, siteUpdates, sumDeadlines, type Deadline, type FnState,
} from '@/domain/pm/site';
import type { PmAgreementChange } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, usePmSiteMutations, usePmSites, type PmSiteRow } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { usePmAccess } from '@/features/pm/usePmAccess';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, DeadlineRow, ScreenHead, SiteStatusTag } from './parts';
import { PastModal, TaskListModal } from './DashModals';
import { SiteChips } from './OverviewView';
import { AfterCard, AgreementCard, BidCard, Card, FlowCard, FnCard, GovWbsCard, InfoCard, UpdatesCard } from './SiteCards';
import { AgreementModal, FixItemsModal, GovDateModal, GovLinkModal, GovResultModal } from './SiteModals';

/**
 * 대시보드 › 통합 사업 현황 › 사업별 (데모 pSiteSum 7611) — 사업 하나의 흐름 단계 · 기한 · 필수 TASK · 계획서 약속 기능.
 * URL `k` = 사업, `side=buyer` = 도입기업 챙길 일 먼저.
 */
type Pop =
  | { kind: 'past' }
  | { kind: 'late' }
  | { kind: 'res'; id: string }
  | { kind: 'fix'; id: string }
  | { kind: 'link'; id: string }
  | { kind: 'date'; id: string }
  | { kind: 'agr'; x: PmAgreementChange | null };

export function SiteView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  // 🔔 '보완 조치' 알림에서 오면 ?fix=점검 항목 → 지적 사항 창 (한 번만 읽음, 데모 govItemsGo)
  const [pop, setPop] = useState<Pop | null>(null);
  // 주소의 fix 값이 바뀔 때마다 한 번 열기 — 이미 사업별 화면에 있을 때 알림을 눌러도 열리게 (CR 창과 같은 방식)
  const fixP = params.get('fix') ?? '';
  const [seenFix, setSeenFix] = useState('');
  if (fixP !== seenFix) { setSeenFix(fixP); if (fixP) setPop({ kind: 'fix', id: fixP }); }
  const [dlAll, setDlAll] = useState(false);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const access = usePmAccess();

  // 사업 고르기: URL k → 없거나 틀리면 계획서 있는 첫 사업 → 탈락 아닌 첫 사업 (pSiteSum)
  // 주소의 사업이 지워졌으면(이 화면에서 삭제) 통합 사업 현황으로
  const kP = params.get('k');
  const gone = !!d && !!kP && !d.snap.projects.some((x) => x.id === kP);
  useEffect(() => { if (gone) setParams(new URLSearchParams({ v: 'dash/overview' }), { replace: true }); }, [gone, setParams]);
  const cur = useMemo<PmSiteRow | null>(() => {
    if (!S) return null;
    const k = params.get('k');
    return S.all.find((r) => r.p.id === k) ?? S.rows.find((r) => r.c.plan) ?? S.rows[0] ?? S.all[0] ?? null;
  }, [S, params]);

  if (!d || !S) return <EmptyHint title="사업 현황을 불러오는 중입니다" />;
  if (!cur) return <EmptyHint title="등록된 사업이 없습니다" hint="업무 목록에 업무가 들어오거나 협약 시작일이 있는 사업이 여기 나옵니다. 사업 등록은 6단계에서 옮깁니다." />;

  const side = (params.get('side') ?? '') as '' | 'buyer' | 'us';
  const go = (v: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    next.set('v', v);
    for (const [a, b] of Object.entries(extra)) next.set(a, b);
    setParams(next);
  };
  const pick = (id: string, extra: Record<string, string> = {}) => go('dash/site', { k: id, ...extra });
  const setSide = (v: string) => pick(cur.p.id, v ? { side: v } : {});

  const { p, c, b, stage } = cur;
  const k = p.id;
  const short = shortOf(k);
  const today = d.today;
  const st = b.stats;
  const total = p.start && p.end ? diffDays(p.start, p.end) : 0;
  const el = p.start ? Math.max(0, Math.min(total, diffDays(p.start, today))) : 0;
  const elP = total ? Math.round((el / total) * 100) : 0;
  const aw = agrWarn(c);
  const fl = fnLinks(c, d.snap.planFunctions[k]);
  const dev = fl ? fl.filter((f) => f.kind !== '기존') : [];
  const cnt: Partial<Record<FnState, number>> = {};
  dev.forEach((f) => { const s = fnSt(c, f); cnt[s] = (cnt[s] ?? 0) + 1; });
  const G = govItems(c);

  // 기한 카드 (dlCard)
  const dl = sumDeadlines(c);
  const dst = dlStat(c, dl);
  const sideOk = (x: Deadline) => !side || x.side === side || x.side === 'both';
  const dlF = dl.filter(sideOk);
  const isB = side === 'buyer';
  const openF = isB ? dst.buyer : dl.filter((x) => !x.done).filter(sideOk);
  const shown = dlAll ? dlF : openF;
  const upd = b.upd;
  const updN = upd ? diffDays(upd, today) : 99;

  const recText = (x: Deadline) => {
    if (x.gov) return 'autoCodes' in x.gov ? `업무 ${x.gov.autoCodes} 완료` : `${monthDay(x.gov.rec.date)} ${people.nameOf(x.gov.rec.by)}`;
    if (x.duty) return 'pre' in x.duty ? x.duty.pre : `${monthDay(x.duty.check.date)} ${people.nameOf(x.duty.check.by)}`;
    return '완료';
  };
  const ctl = (x: Deadline) => {
    const parent = x.pid ? c.gov.get(x.pid) : undefined;
    const gi = parent?.items ?? [];
    const giOk = gi.filter((it) => it.st === '확인').length;
    const auto = !!x.gov && 'autoCodes' in x.gov;
    const rec = x.gov && 'rec' in x.gov ? x.gov.rec : null;
    return (
      <span className="flex flex-none items-center gap-1 whitespace-nowrap">
        {gi.length > 0 && <Button size="sm" variant={giOk === gi.length ? 'secondary' : 'primary'} onClick={() => setPop({ kind: 'fix', id: x.pid! })} title="지적 사항별 조치 상태">지적 {giOk}/{gi.length} 확인</Button>}
        {x.res ? (
          <>
            {rec?.v ? <Tag tone={govResTone(rec.v)} title={`${rec.memo ? `${rec.memo} — ` : ''}${people.nameOf(rec.by)}`}>{rec.v} · {monthDay(rec.date)}</Tag>
              : auto ? <span className="text-[11px] text-ink3">{recText(x)}</span> : null}
            <Button size="sm" variant="secondary" onClick={() => setPop({ kind: 'res', id: x.id! })}>{rec?.v ? '수정' : '결과 기록'}</Button>
          </>
        ) : x.chk ? (
          <label className="flex cursor-pointer items-center gap-1 text-[11.5px] text-ink2" title={auto ? '같은 일을 하는 업무가 완료되어 자동으로 완료 처리됨' : '끝났으면 체크'}>
            <input type="checkbox" checked={x.done} disabled={auto || ('pre' in (x.duty ?? {}))}
              onChange={(e) => {
                if (e.target.checked) void smut.checkDeadlines.mutateAsync({ items: [{ projectId: k, kind: x.chk!, id: x.id! }], date: today, bulk: false });
                else void smut.uncheckDeadline.mutateAsync({ projectId: k, kind: x.chk!, id: x.id! });
              }} />
            {x.done ? recText(x) : '완료'}
          </label>
        ) : (
          <>
            {!!x.shift && !x.done && x.taskId && <Button size="sm" variant="secondary" onClick={() => revert(x.taskId!)} title="기준선(최초 계획) 날짜로 되돌리기">원래대로</Button>}
            {x.taskId && <Button size="sm" variant="secondary" onClick={() => modals.openTask(x.taskId!)}>보기</Button>}
          </>
        )}
      </span>
    );
  };
  /** 최초 계획으로 되돌리기 (msRevert) */
  const revert = (taskId: string) => {
    const t = d.taskMap.get(taskId);
    const base = c.baseline?.map[taskId];
    if (!t || !base) return;
    if (!confirm(`'${t.name}' 일정을 최초 계획으로 되돌릴까요?\n\n지금: ${t.start || '-'} ~ ${t.end || '-'}\n최초 계획: ${base.start || '-'} ~ ${base.end || '-'}`)) return;
    void smut.setTaskDates.mutateAsync({ items: [{ id: taskId, start: base.start || t.start, end: base.end }], note: '최초 계획으로 되돌림' });
  };
  const bidRes = (v: '' | '선정' | '탈락') => {
    const ev = p.evalDate || p.annDue;
    if (v && ev && today < ev && !confirm(`${p.evalDate ? `선정평가일(${monthDay(p.evalDate)})` : `공고 마감일(${monthDay(p.annDue)})`}이 아직 지나지 않았습니다.\n그래도 '${v}'(으)로 기록할까요?`)) return;
    if (v === '탈락' && !confirm(`'${short}' 사업을 탈락으로 기록할까요?\n\n통합 사업 현황 · 알림 · 내 업무 · 진행률 갱신 · 팀 현황에서 빠집니다.\n업무와 기록은 지우지 않으며, [결과 지우기]로 되돌릴 수 있습니다.`)) return;
    void smut.setBidResult.mutateAsync({ projectId: k, v });
  };

  const gOf = (id: string) => G?.find((x) => x.id === id);
  /** 지적 사항 창 닫기 — 알림으로 열었으면 주소의 fix 도 지움 (다시 눌러도 열리게 · 새로 고침에 다시 안 뜨게) */
  const closeFix = () => {
    setPop(null);
    if (params.get('fix')) { const n = new URLSearchParams(params); n.delete('fix'); setParams(n, { replace: true }); }
  };
  const sideBtn = (v: '' | 'buyer' | 'us', l: string, title: string) => <Button size="sm" variant={side === v ? 'primary' : 'secondary'} onClick={() => setSide(v)} title={title}>{l}</Button>;

  return (
    <div className="space-y-4">
      <ScreenHead title={<><ProjectTag>{shortOf(k)}</ProjectTag> <span className="ml-1">{p.company}</span></>} desc="사업 하나의 기한 · 점검 · 약속 기능 진척을 한 화면에서 보고 처리합니다 · [전체]로 돌아가면 모든 사업을 비교" />
      <SiteChips rows={S.rows} all={S.all} cur={k} shortOf={shortOf} onAll={() => go('dash/overview')} onPick={(id) => pick(id)} />

      <FlowCard c={c} st={stage} nameOf={people.nameOf} onOpenTask={modals.openTask} onGoWbs={() => go('task/wbs', { k })}
        docOf={d.docOf} onSetDoc={(taskId, st) => void smut.setDoc.mutateAsync({ taskId, st })} onGoDoc={() => go('doc/audit', { k })} />
      {stage.i === 0 && <BidCard c={c} nameOf={people.nameOf} onBidRes={bidRes} />}
      {stage.i === 4 && <AfterCard c={c} nameOf={people.nameOf} onAsAdd={() => modals.openIssue(null, k)} />}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="px-4 py-3">
          <div className="text-[11.5px] font-bold text-ink2">협약 기간</div>
          <b className="block text-[24px] leading-tight text-ink">{p.end ? dday(p.end, today) : '-'}<small className="ml-1 text-[12px] font-bold text-ink3">종료까지</small></b>
          <small className="text-[11px] text-ink3">{p.start || '-'} ~ {p.end || '-'} · 기간 {elP}% 지남
            {aw && <span className="text-danger" title="업무 목록 마지막 업무가 협약 종료일보다 늦음"> · 업무 {aw.days}일 초과 → {aw.kind === '승인' ? '협약변경 승인 필요' : '등록 필요'}</span>}</small>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-[11.5px] font-bold text-ink2">업무 진척 (실적 / 오늘 계획) · 갱신 <span className={updN > 14 ? 'text-danger' : 'text-ink3'} title={upd ? `최종 갱신 ${upd}${updN > 14 ? ' · 2주 넘게 갱신 없음 — 진척률을 그대로 믿기 어렵습니다' : ''}` : '갱신 기록 없음'}>{agoText(upd, today)}</span></div>
          <b className="block text-[24px] leading-tight text-ink">{Math.round(st.act)}<small className="text-[12px] font-bold text-ink3">% / {Math.round(st.plan)}%</small></b>
          <span className="flex items-center gap-1.5 text-[11px] text-ink3"><SiteStatusTag st={b.status} />
            {st.late.length ? <button type="button" className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 font-bold text-danger" onClick={() => setPop({ kind: 'late' })} title="지연 업무 목록 보기">지연 업무 {st.late.length}건 ›</button> : '지연 업무 없음'}</span>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-[11.5px] font-bold text-ink2">계획서 약속 기능 (추가 · 변경)</div>
          <b className="block text-[24px] leading-tight text-ink">{fl ? <>{cnt['완료'] ?? 0}<small className="ml-0.5 text-[12px] font-bold text-ink3">/ {dev.length}개 완료</small></> : '-'}</b>
          <small className="text-[11px] text-ink3">{fl ? <>진행 중 {cnt['진행 중'] ?? 0} · 지연 <b className={cnt['지연'] ? 'text-danger' : ''}>{cnt['지연'] ?? 0}</b> · 시작 전 {cnt['시작 전'] ?? 0}{cnt['연결 없음'] ? ` · 연결 없음 ${cnt['연결 없음']}` : ''}</> : '사업계획서 미등록'}</small>
        </Card>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <InfoCard c={c} short={short} onKpi={() => go('site/kpi', { k: c.p.id })} money={access.money} manage={access.manage} onEdit={() => modals.openSite(k)} />
          <UpdatesCard L={siteUpdates(c)} nameOf={people.nameOf} noteNow={!!d.snap.reports.find((r) => r.projectId === k && r.week === weekStart(today))?.note} onWrite={() => go('doc/check', { k })} />
          <AgreementCard c={c} onNew={() => setPop({ kind: 'agr', x: null })} onEdit={(x) => setPop({ kind: 'agr', x })} />
        </div>
        <Card className="flex min-h-[520px] min-w-0 flex-col">
          <CardHead title="기한">
            {dst.past.length > 0 && <button type="button" onClick={() => setPop({ kind: 'past' })} title="날짜가 지났는데 완료 체크가 안 된 것 — 눌러서 한 번에 정리" className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">지난 기한 {dst.past.length}건 · 정리 ›</button>}
            <span className="flex-1" />
            {sideBtn('', '전체', '')}
            {sideBtn('buyer', `도입기업 챙길 일 ${dst.buyer.length}`, '도입기업이 해야 하는데 PM이 챙겨야 하는 일 (함께 하는 일 포함) · 지났거나 2주 안')}
            {sideBtn('us', '우리 할 일', '공급기업(우리)이 하는 일 (함께 하는 일 포함)')}
          </CardHead>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 overflow-y-auto px-4 py-1.5">
              {!G && <p className="pb-2 text-[11.5px] text-ink3">{p.biz || '이 사업'}은 세부관리기준 공통 일정이 아니라 공고문 · 협약서 기준이라 관리기준 기한을 만들지 않았습니다.</p>}
              {shown.length ? shown.map((x) => <DeadlineRow key={`${x.src}${x.id ?? x.taskId ?? x.t}`} x={x} today={today} right={ctl(x)} />)
                : <p className="py-2 text-[11.5px] text-ink3">{isB ? '지났거나 2주 안인 도입기업 몫 기한이 없습니다' : '남은 기한이 없습니다'}</p>}
            </div>
          </div>
          <div className="border-t border-border px-4 py-2">
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="text-ink3">{dlAll ? `완료 포함 ${dlF.length}건` : isB ? `지났거나 2주 안 ${openF.length}건 (도입기업 몫 전체 ${dst.buyerAll.length}건)` : `남은 기한 ${openF.length}건`} · 목록 안에서 스크롤</span>
              <span className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setDlAll((v) => !v)}>{dlAll ? '남은 것만 보기' : `완료 포함 ${dlF.length}건 보기`}</Button>
            </div>
            <p className="pt-1 text-[11px] text-ink3">※ 서류를 내는 관리기준 기한은 {GOV_INNER}일 전을 내부 마감일로 잡습니다. 날짜에 마우스를 올리면 실제 기한이 보입니다.</p>
          </div>
        </Card>
      </div>

      <GovWbsCard c={c} onLink={(id) => setPop({ kind: 'link', id })} onDate={(id) => setPop({ kind: 'date', id })} />
      <FnCard c={c} fl={fl} nameOf={people.nameOf} onOpenTask={modals.openTask} />

      {pop?.kind === 'past' && (
        <PastModal rows={[cur]} only={k} today={today} shortOf={shortOf}
          onDone={(items, date) => smut.checkDeadlines.mutateAsync({ items, date, bulk: true })}
          onOpenTask={(id) => modals.openTask(id)} onOpenSite={() => setPop(null)} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'late' && (
        <TaskListModal title={`${short} · 지연 업무`} hint="종료일이 오늘보다 지났는데 끝나지 않은 업무 · 오래된 순" d={d} shortOf={shortOf} tasks={st.late}
          onOpenTask={(id) => modals.openTask(id)} onClose={() => setPop(null)} footer={<Button onClick={() => go('task/wbs', { k, period: 'late' })}>업무 목록에서 보기 →</Button>} />
      )}
      {pop?.kind === 'res' && gOf(pop.id) && (
        <GovResultModal c={c} g={gOf(pop.id)!} short={short} people={people.people} me={people.me}
          onSave={(x) => smut.setGovResult.mutateAsync({ projectId: k, itemId: pop.id, x })}
          onRemove={() => smut.removeGovResult.mutateAsync({ projectId: k, itemId: pop.id })} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'fix' && gOf(pop.id) && c.gov.get(pop.id) && (
        <FixItemsModal c={c} g={gOf(pop.id)!} fol={G?.find((x) => GOV_FOLLOW_OF[x.id] === pop.id)} r={c.gov.get(pop.id)!} short={short} nameOf={people.nameOf}
          onAct={(fixId, action, note) => smut.setFixItemState.mutateAsync({ projectId: k, itemId: pop.id, fixId, action, note })}
          onEdit={() => { const id = pop.id; closeFix(); setPop({ kind: 'res', id }); }} onClose={closeFix} />
      )}
      {pop?.kind === 'link' && (
        <GovLinkModal c={c} itemId={pop.id} short={short} onSave={(taskIds) => smut.setGovLink.mutateAsync({ projectId: k, itemId: pop.id, taskIds })} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'date' && (
        <GovDateModal c={c} itemId={pop.id} short={short} onSave={(items) => smut.setTaskDates.mutateAsync({ items, note: '관리기준 필수 TASK' })} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'agr' && (
        <AgreementModal c={c} x={pop.x} short={short} onSave={(x) => smut.saveAgreement.mutateAsync(x)} onRemove={(id) => smut.removeAgreement.mutateAsync(id)} onClose={() => setPop(null)} />
      )}
      {modals.node}
    </div>
  );
}
