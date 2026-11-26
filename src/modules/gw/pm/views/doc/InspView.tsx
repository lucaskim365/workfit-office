import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { monthDay, shortName } from '@/domain/pm/rules';
import { fnSt, GOV_FOLLOW_OF, govItems, govResTone } from '@/domain/pm/site';
import { INSP_LV, INSP_NM, inspBoard, inspInfo, inspSpan, type InspInfo, type InspLv } from '@/domain/pm/insp';
import { usePmDerived, usePmMutations, usePmSiteMutations, usePmSites } from '@/features/pm/usePm';
import type { PmTask } from '@/domain/pm/schema';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { FixItemsModal, GovResultModal } from '../dash/SiteModals';

/**
 * 점검 · 요구사항 · 산출물 › 점검 · 감리 대비 (데모 pInsp 7134 · inspDetail 7168) — D-day 카운트다운:
 * 위 일정 띠(한 달 전 ~ 6개월 반 뒤) + 점검마다 준비도 4칸 카드, 누르면 무엇이 부족한지 펼침.
 * 새 입력 칸 없음. 결과 기록 · 지적 사항 창은 사업별 화면 것을 그대로 씀.
 */
const LV_TONE: Record<InspLv, 'bad' | 'warn' | 'ok' | 'plain'> = { bad: 'bad', warn: 'warn', ok: 'ok', none: 'plain' };
const LV_DOT = { bad: 'bg-danger', warn: 'bg-amber', ok: 'bg-ok', none: 'bg-ok' } as const;
const LV_BORDER = { bad: 'border-l-danger', warn: 'border-l-amber', ok: 'border-l-ok', none: 'border-l-ok' } as const;
type Only = '' | 'bad' | 'warn' | 'soon' | 'gi';
type Pop = { kind: 'res' | 'fix'; k: string; id: string };
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function InspView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [, setParams] = useSearchParams();
  const [openK, setOpenK] = useState('');
  const [only, setOnly] = useState<Only>('');
  const [pop, setPop] = useState<Pop | null>(null);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });

  const all = useMemo(() => (d && S ? S.all.map((r) => inspInfo(r.c, d.snap.planFunctions[r.p.id], (t) => d.docOf(t).st)).filter((x): x is InspInfo => !!x) : []), [d, S]);
  const head = <ScreenHead title="점검 · 감리 대비" desc="정부사업마다 다음 중간점검 · 최종점검(감리)과 그때까지 무엇이 준비 안 됐는지 봅니다 · 점검일이 가까운 순. 새로 적는 칸은 없고, 점검 일정 · 판정 기록 · 계획서 약속 기능 · 보완 지적 사항 · 산출물 제출 상태를 모아 보여 줍니다." />;
  if (!d || !S) return <>{head}<EmptyHint title="점검 일정을 불러오는 중입니다" /></>;
  if (!all.length) return <div className="space-y-4">{head}<EmptyHint title="점검 일정을 계산할 정부사업이 없습니다" hint="정부일반형 · 부처협업형 · 제조AI 사업에 협약 시작 · 종료일이 있으면 여기에 나옵니다." /></div>;

  const go = (v: string, k: string) => setParams(new URLSearchParams({ v, k }));
  const b = inspBoard(all);
  const sp = inspSpan(d.today);
  const pass = (x: InspInfo) => !only || (only === 'soon' ? x.days != null && x.days <= 30 : only === 'gi' ? x.gi.length > 0 : x.lv === only);
  const up = b.up.filter(pass);
  const dots = b.up.filter((x) => x.g!.due && x.g!.due >= sp.a && x.g!.due <= sp.b);
  const toggle = (k: string) => setOpenK((o) => (o === k ? '' : k));
  const pick = (o: Only) => setOnly((x) => (x === o ? '' : o));
  const pmOf = (x: InspInfo) => (x.c.p.pmUserId ? people.nameOf(x.c.p.pmUserId) : x.c.p.pmName) || '-';
  const popRow = pop && all.find((x) => x.c.p.id === pop.k);
  const G = popRow ? govItems(popRow.c) : null;
  const gOf = (id: string) => G?.find((x) => x.id === id);

  return (
    <div className="space-y-4">
      {head}
      {/* 점검 일정 띠 */}
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5">
          <b className="text-[13px] text-ink">점검 일정</b>
          <Pill on={only === 'bad'} tone="bad" onClick={() => pick('bad')} title="14일 안에 점검인데 준비 문제가 있는 사업만 보기">위험 {b.nBad}</Pill>
          <Pill on={only === 'warn'} tone="warn" onClick={() => pick('warn')} title="준비 문제가 있는 사업만 보기">주의 {b.nWarn}</Pill>
          <Pill on={only === 'soon'} onClick={() => pick('soon')} title="점검일이 30일 안(지난 것 포함)인 사업만 보기">30일 안 {b.soon}건</Pill>
          <Pill on={only === 'gi'} onClick={() => pick('gi')} title="보완 지적 사항이 남은 사업만 보기">보완 미조치 {b.nGi}건</Pill>
          {only && <Button size="sm" variant="secondary" onClick={() => setOnly('')}>모두 보기</Button>}
          <span className="flex-1" />
          <small className="text-[11px] text-ink3">한 달 전 ~ 6개월 반 뒤</small>
        </div>
        <div className="relative mx-6 mb-3 mt-2 h-[120px]">
          <div className="absolute bottom-6 left-0 right-0 h-px bg-border-hi" />
          {sp.mons.map(([p, l]) => (
            <span key={l + p} className="absolute bottom-0 border-l border-border pl-1 text-[11px] text-ink3" style={{ left: `${p}%`, height: 30 }}>{l}</span>
          ))}
          <span className="absolute bottom-6 top-3 w-0.5 bg-danger/70" style={{ left: `${sp.P(d.today)}%` }}>
            <em className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-danger px-1 text-[10px] not-italic font-bold text-white">오늘</em>
          </span>
          {dots.map((x, i) => (
            <button key={x.c.p.id} type="button" onClick={() => toggle(x.c.p.id)} title={`${shortOf(x.c.p.id)} · ${INSP_NM[x.g!.id]} · ${x.g!.due}`}
              className="absolute flex -translate-x-1/2 flex-col items-center" style={{ left: `${sp.P(x.g!.due)}%`, bottom: 18 }}>
              <span className="mb-1 whitespace-nowrap rounded border border-border bg-panel px-1.5 text-[11px] font-bold text-ink shadow-sm" style={{ marginBottom: 4 + (i % 3) * 22 }}>{shortOf(x.c.p.id)}</span>
              <i className={`block h-3.5 w-3.5 rounded-full border-2 border-white ${LV_DOT[x.lv]}`} />
            </button>
          ))}
        </div>
      </section>

      {/* 점검 카드 */}
      {up.length ? up.map((x) => {
        const g = x.g!;
        const open = openK === x.c.p.id;
        const dd = x.days;
        const fnP = x.dev && x.dev.length ? (x.fnDone / x.dev.length) * 100 : 0;
        const outP = x.outs.length ? ((x.outs.length - x.outLeft.length) / x.outs.length) * 100 : 0;
        return (
          <section key={x.c.p.id} className={`rounded-xl border border-l-4 border-border bg-panel shadow-sm ${LV_BORDER[x.lv]}`}>
            <button type="button" onClick={() => toggle(x.c.p.id)} title={open ? '접기' : '무엇이 부족한지 펼쳐 보기'} className="flex w-full items-center gap-4 px-4 py-3 text-left">
              <div className={`flex w-[96px] flex-none flex-col items-center rounded-lg py-2 ${x.lv === 'bad' ? 'bg-danger/10 text-danger' : x.lv === 'warn' ? 'bg-amber-soft text-amber' : 'bg-ok/10 text-ok'}`}>
                <b className="text-[22px] leading-tight">{dd == null ? '미정' : dd < 0 ? `D+${-dd}` : dd === 0 ? 'D-DAY' : `D-${dd}`}</b>
                <span className="text-[11.5px]">{g.due ? monthDay(g.due) : '날짜 미정'}</span>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2 whitespace-nowrap"><ProjectTag>{shortOf(x.c.p.id)}</ProjectTag><b className="text-[14px] text-ink">{INSP_NM[g.id]}</b><Tag tone={LV_TONE[x.lv]}>{INSP_LV[x.lv]}</Tag></div>
                <div className="mt-0.5 truncate text-[11.5px] text-ink3">{x.c.p.biz} · PM {pmOf(x)} · <span title={g.dueTxt}>{trunc(g.dueTxt, 34)}</span></div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {x.probs.length ? x.probs.map((p) => <Tag key={p} tone={x.lv === 'bad' ? 'bad' : 'warn'}>{p}</Tag>) : <Tag tone="ok">준비 문제 없음</Tag>}
                </div>
              </div>
              <div className="grid w-[46%] max-w-[600px] flex-none grid-cols-4 gap-3">
                <Meter lb="약속 기능" val={x.dev ? <>{x.fnDone}<em>/{x.dev.length}</em></> : '-'} sub={x.dev ? (x.fnLate.length ? `지연 ${x.fnLate.length}` : '완료 기준') : '계획서 없음'} pct={fnP} bad={x.fnLate.length > 0} />
                <Meter lb="업무 진척" val={<>{Math.round(x.ps.act)}<em>%</em></>} sub={`계획 ${Math.round(x.ps.plan)}%${x.ps.late.length ? ` · 지연 ${x.ps.late.length}` : ''}`} pct={x.ps.act} bad={x.ps.act + 3 < x.ps.plan} />
                <Meter lb="보완 미조치" val={<>{x.gi.length}<em>건</em></>} sub={x.gi.length ? '조치 필요' : '없음'} pct={x.gi.length ? 100 : 0} bad={x.gi.length > 0} />
                <Meter lb="산출물 제출" val={x.outs.length ? <>{x.outs.length - x.outLeft.length}<em>/{x.outs.length}</em></> : '-'} sub={x.outs.length ? `남은 ${x.outLeft.length}` : '대상 없음'} pct={outP} />
              </div>
              <span className="w-4 flex-none text-ink3">{open ? '▴' : '▾'}</span>
            </button>
            {open && <Detail x={x} nameOf={people.nameOf} docSt={(t) => d.docOf(t).st} onRes={() => setPop({ kind: 'res', k: x.c.p.id, id: g.id })} onFix={(id) => setPop({ kind: 'fix', k: x.c.p.id, id })}
              onSite={() => go('dash/site', x.c.p.id)} onDoc={() => go('doc/audit', x.c.p.id)} />}
          </section>
        );
      }) : <section className="rounded-xl border border-border bg-panel shadow-sm"><EmptyHint title={b.up.length ? '조건에 맞는 점검이 없습니다' : '남은 점검이 없습니다'} hint={b.up.length ? '위쪽 [모두 보기]를 누르세요.' : '모든 정부사업의 점검 결과가 기록되었습니다.'} /></section>}
      <p className="text-[11px] text-ink3">※ 준비 상태: 업무 지연 · 점검 일정이 규정 기한보다 늦음 · 약속 기능 지연 · 보완 지적 미조치 · (최종점검 60일 전부터) 최종점검 준비 · 산출물 미제출 · 결과 미기록 중 하나라도 있으면 <b>주의</b>, 점검이 14일 안이면 <b>위험</b>.</p>

      {b.fin.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
          <b className="text-[12.5px] text-ink">점검을 모두 마친 사업 {b.fin.length}</b>
          {b.fin.map((x) => (
            <Button key={x.c.p.id} size="sm" variant="secondary" onClick={() => go('dash/site', x.c.p.id)}>{shortOf(x.c.p.id)} · {x.last ? `${x.last.nm} · ${x.last.v}` : '완료'}</Button>
          ))}
        </section>
      )}

      {pop?.kind === 'res' && popRow && gOf(pop.id) && (
        <GovResultModal c={popRow.c} g={gOf(pop.id)!} short={shortOf(pop.k)} people={people.people} me={people.me}
          onSave={(v, base) => smut.setGovResult.mutateAsync({ projectId: pop.k, itemId: pop.id, x: v, base })}
          onRemove={() => smut.removeGovResult.mutateAsync({ projectId: pop.k, itemId: pop.id })} onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'fix' && popRow && gOf(pop.id) && popRow.c.gov.get(pop.id) && (
        <FixItemsModal c={popRow.c} g={gOf(pop.id)!} fol={G?.find((x) => GOV_FOLLOW_OF[x.id] === pop.id)} r={popRow.c.gov.get(pop.id)!} short={shortOf(pop.k)} nameOf={people.nameOf}
          onAct={(fixId, action, note) => smut.setFixItemState.mutateAsync({ projectId: pop.k, itemId: pop.id, fixId, action, note })}
          onEdit={() => setPop({ kind: 'res', k: pop.k, id: pop.id })} onClose={() => setPop(null)} />
      )}
      {modals.node}
    </div>
  );
}

function Pill({ children, on, tone, onClick, title }: { children: ReactNode; on: boolean; tone?: 'bad' | 'warn'; onClick: () => void; title: string }) {
  const c = tone === 'bad' ? 'border-danger/30 bg-danger/10 text-danger' : tone === 'warn' ? 'border-amber/30 bg-amber-soft text-amber' : 'border-border-hi bg-panel text-ink2';
  return <button type="button" onClick={onClick} title={title} className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${c} ${on ? 'ring-2 ring-navy' : 'hover:border-teal'}`}>{children}</button>;
}

function Meter({ lb, val, sub, pct, bad }: { lb: string; val: ReactNode; sub: string; pct: number; bad?: boolean }) {
  return (
    <div className="min-w-0">
      <small className="text-[11px] text-ink3">{lb}</small>
      <div className={`text-[18px] font-extrabold leading-tight [&_em]:ml-0.5 [&_em]:text-[12px] [&_em]:font-bold [&_em]:not-italic [&_em]:text-ink3 ${bad ? 'text-danger' : 'text-ink'}`}>{val}</div>
      <div className="my-1 h-1.5 overflow-hidden rounded-full bg-panel-alt"><i className={`block h-full ${bad ? 'bg-danger' : 'bg-blue'}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <span className={`text-[11px] ${bad ? 'text-danger' : 'text-ink3'}`}>{sub}</span>
    </div>
  );
}

/** 펼친 내용 (inspDetail) — 약속 기능 지연 · 연결 없음 / 보완 지적 미조치 / 산출물 미제출 / 최종점검 준비 */
function Detail({ x, nameOf, docSt, onRes, onFix, onSite, onDoc }: { x: InspInfo; nameOf: (id: string) => string; docSt: (t: PmTask) => string; onRes: () => void; onFix: (id: string) => void; onSite: () => void; onDoc: () => void }) {
  const fnBad = [...x.fnLate, ...x.fnNone];
  const list = <T,>(arr: T[], f: (v: T, i: number) => ReactNode, more?: string) => (arr.length ? (
    <ul className="ml-4 mt-1 list-disc space-y-0.5">
      {arr.slice(0, 6).map(f)}
      {arr.length > 6 && <li className="text-ink3">외 {arr.length - 6}건{more ? ` — ${more}` : ''}</li>}
    </ul>
  ) : <div className="text-ok">✓ 없음</div>);
  const box = (t: string, body: ReactNode) => <div className="min-w-[220px] flex-1"><div className="mb-0.5 font-bold text-ink">{t}</div><div>{body}</div></div>;
  return (
    <div className="border-t border-border px-4 py-3 text-[12px] text-ink2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {x.last ? <>지난 점검: <b>{x.last.nm}</b> <Tag tone={govResTone(x.last.v)}>{x.last.v}</Tag> {monthDay(x.last.d)}</> : <span className="text-ink3">지난 점검 기록 없음</span>}
        <span className="flex-1" />
        {x.recBtn && <Button size="sm" onClick={onRes} title="점검 판정을 기록합니다">{INSP_NM[x.g!.id]} 결과 기록</Button>}
        <Button size="sm" variant="secondary" onClick={onSite}>사업별 현황 열기 →</Button>
        <Button size="sm" variant="secondary" onClick={onDoc}>산출물 보기 →</Button>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {box(`약속 기능 — 지연 · 연결 없음 ${fnBad.length}`, x.dev
          ? list(fnBad, (f, i) => { const st = fnSt(x.c, f); return <li key={i}>{f.mod} · {f.name} <span className={st === '지연' ? 'text-danger' : 'text-ink3'}>{st}{f.t?.end ? ` · 마감 ${monthDay(f.t.end)}` : ''}</span></li>; }, '사업별 현황에서 전체 보기')
          : <span className="text-ink3">사업계획서 미등록 — 약속 기능을 비교할 수 없음</span>)}
        {box(`보완 지적 미조치 ${x.gi.length}`, list(x.gi, (it) => (
          <li key={it.id}><button type="button" className="text-left hover:underline" onClick={() => onFix(it.pid)} title="지적 사항 창 열기">{it.text}</button> <span className="text-ink3">{it.pnm} · {it.whoId ? nameOf(it.whoId) : '담당 미정'} · {it.st}</span></li>
        )))}
        {box(`산출물 미제출 ${x.outLeft.length}${x.outs.length ? ` / ${x.outs.length}` : ''}`, x.outs.length
          ? list(x.outLeft, (t) => <li key={t.id}>{t.output} <span className="text-ink3">{docSt(t)}</span></li>, '산출물 화면에서 전체 보기')
          : <span className="text-ink3">업무 목록에 산출물이 적힌 업무가 없음</span>)}
        {x.isAudit && box('최종점검 준비', x.readyOk ? <div className="text-ok">✓ 완료로 기록됨</div> : <div className="text-danger">아직 — 실데이터 입력 · 로그 수집 · 운영현황보고서 · 시연 시나리오 (구축완료 30일 전까지)</div>)}
      </div>
    </div>
  );
}
