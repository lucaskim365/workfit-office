import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { addDays, isDone, leftText, monthDay, shortName } from '@/domain/pm/rules';
import { agoText, weekStart } from '@/domain/pm/site';
import { UPD_WHY, updWhat, type UpdInputs } from '@/domain/pm/my';
import { planMarkTask, planRecentIdx, planUpdDates } from '@/domain/pm/plan';
import { updSortStable, wcBoard, wcPeople } from '@/domain/pm/weekly';
import type { PmProject, PmTask } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, usePmSiteMutations, usePmSites } from '@/features/pm/usePm';
import { planDayEdit, usePmPlanCtx } from '@/features/pm/usePmPlan';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, ScreenHead } from '../dash/parts';
import { PctInput } from '../dash/MyView';

/**
 * 이슈 · 회의 · 보고 › 주간 진행률 · 보고서 › 진행률 갱신 (데모 pWeekCheck 7915) — 이번 주 체크인 판:
 * 사업마다 이번 주 갱신할 업무(마감 지남 · 이번 주 마감 · 2주 넘게 갱신 없음 · 최근 업무계획) 중 갱신한 비율,
 * 사업을 고르면 사람별 갱신 현황 · [요청 보내기] · [내가 입력], 아래 이번 주 특이사항 (주간 보고서 6번).
 * 주소 `&k=` = 고른 사업 (🔔 '이번 주 진행률 갱신' · 사업별 화면 '이번 주 특이사항 쓰기').
 */
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3';
const td = 'px-3 py-2 align-middle';
const ta = 'min-h-[84px] w-full rounded border border-border bg-panel px-2.5 py-2 text-[12.5px] text-ink';

function Ring({ p, size = 56, children }: { p: number; size?: number; children: ReactNode }) {
  return (
    <span className="relative grid flex-none place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(var(--color-ok, #16a34a) ${p * 3.6}deg, var(--color-panel-alt, #eef2f6) 0)` }}>
      <span className="grid place-items-center rounded-full bg-panel text-center leading-tight" style={{ width: size - 10, height: size - 10 }}>{children}</span>
    </span>
  );
}

export function WeekCheckView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const C = usePmPlanCtx(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState(false);
  const [openWho, setOpenWho] = useState('');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const me = people.me;
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const pmOf = (p: PmProject) => [...new Set([p.pmUserId, people.idByName(p.pmName)].filter(Boolean))];

  const calc = useMemo(() => {
    if (!d || !S) return null;
    const sitePm = (id: string) => { const p = d.snap.projects.find((x) => x.id === id); return p ? pmOf(p)[0] ?? '' : ''; };
    const U: UpdInputs = { tasks: d.snap.tasks, liveMap: d.liveMap, projects: d.snap.projects, today: d.today, logs: d.snap.logs, checks: d.snap.weekChecks,
      tickets: d.snap.tickets, baseDate: d.snap.baseDate, sitePm, more: C ? planUpdDates(C) : undefined, planRecent: C ? planRecentIdx(C) : undefined };
    return { U, B: wcBoard(S.rows.map((r) => r.c), U, me, (c) => pmOf(c.p), all, d.snap.reports) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, S, C, me, all, people.idByName]);

  const head = <ScreenHead title="주간 진행률 · 보고서" desc="일주일에 한 번 사업별 진행률을 갱신하면 주간 보고서가 자동으로 채워집니다. 갱신으로 치는 것: 진행률 기록 · [변동 없음] 확인 · 업무계획에서 그 업무 체크 · 메모 · 티켓 처리." />;
  if (!d || !calc) return <>{head}<EmptyHint title="주간 진행률을 불러오는 중입니다" /></>;
  const { U, B } = calc;
  if (!B.list.length) return <div className="space-y-4">{head}<EmptyHint title="진행 중인 사업이 없습니다" hint="업무 목록에 업무가 있는 사업이 여기 나옵니다." /></div>;
  const ws = weekStart(d.today);
  const we = addDays(ws, 6);
  const kP = params.get('k');
  const cur = B.list.find((r) => r.c.p.id === kP) ?? B.list.find((r) => r.items.some((x) => !x.done)) ?? B.list[0];
  const k = cur.c.p.id;
  const pick = (id: string) => { const n = new URLSearchParams(params); n.set('k', id); setParams(n, { replace: true }); setOpenWho(''); };
  const ppl = wcPeople(cur.items);
  const left = cur.items.filter((x) => !x.done).length;
  const sel = ppl.find((r) => r.who === openWho);
  const rp = d.snap.reports.find((r) => r.projectId === k && r.week === ws);
  const req = d.snap.updReq;
  const say = (t: string, bad?: boolean) => setMsg({ t, bad });
  const setPct = (t: PmTask, n: number) => {
    const was = isDone(d.liveMap.get(t.id) ?? { status: t.status, pct: t.actualPct });
    // G2: 저장 차례 때 최신 그날 목록에서 체크 맞춤
    if ((n >= 100 || was) && C) mut.setPlanDay.mutate({ make: planDayEdit(me, d.today, (a) => { const r = planMarkTask(a, t.id, n >= 100); if (!r) return false; a.splice(0, a.length, ...r); }) });
    mut.setProgress.mutate({ id: t.id, pct: n, why: '주간 진행률' });
    smut.markNoChange.mutate([t.id]);
    say(`'${t.name}' 진행률 ${n}% 기록`);
  };
  const lastUpd = (id: string) => { const r = S!.all.find((x) => x.p.id === id); return r?.b.upd ?? ''; };

  return (
    <div className="space-y-4">
      {head}
      {msg && <div className={`rounded-lg border px-3 py-2 text-[12px] font-bold ${msg.bad ? 'border-danger/30 bg-danger/10 text-danger' : 'border-ok/30 bg-ok/10 text-ok'}`}>{msg.t}</div>}

      {/* 이번 주 체크인 판 */}
      <section className={sec}>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <Ring p={B.pct} size={76}><b className="text-[18px] text-ink">{B.pct}<em className="text-[11px] not-italic text-ink3">%</em></b></Ring>
          <div className="min-w-0 flex-1">
            <small className="text-[11.5px] text-ink3">{monthDay(ws)} ~ {monthDay(we)} · 이번 주</small>
            <h3 className="text-[16px] font-extrabold text-ink">진행률 체크인 {B.okAll} / {B.tot}건</h3>
            <span className="text-[12px] text-ink2">{B.mine ? '내가 PM인 사업' : '전체 사업'} {B.list.length}개 중 다 끝난 사업 <b>{B.fin}</b>개 · 사업을 누르면 아래에서 사람별로 갱신합니다</span>
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-ink2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />전체 사업 보기</label>
        </div>
        {!all && !B.mine && <p className="px-5 pb-2 text-[11.5px] text-ink3">{people.labelOf(me)}님이 PM인 사업이 없어 전체 사업을 보여줍니다.</p>}
        <div className="grid gap-2.5 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
          {B.list.map((r) => {
            const p = r.n ? Math.round((r.ok / r.n) * 100) : 100;
            const fin = !r.n || r.ok === r.n;
            const on = r.c.p.id === k;
            const pm = pmOf(r.c.p).map(people.nameOf).filter(Boolean).join(', ') || r.c.p.pmName || '-';
            return (
              <button key={r.c.p.id} type="button" onClick={() => pick(r.c.p.id)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left ${on ? 'border-navy bg-blue-soft' : 'border-border bg-panel hover:border-teal'}`}>
                <Ring p={p}>{fin ? <b className="text-[18px] text-ok">✓</b> : <b className="text-[14px] text-ink">{r.ok}<em className="text-[10px] not-italic text-ink3">/{r.n}</em></b>}</Ring>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><ProjectTag>{shortOf(r.c.p.id)}</ProjectTag>{r.note && <Tag tone="ok" title="이번 주 특이사항 작성함">특이사항</Tag>}</span>
                  <small className="block truncate text-[11px] text-ink3">{r.c.p.biz}</small>
                  <span className="block truncate text-[11px] text-ink2">PM {pm} · 갱신 {lastUpd(r.c.p.id) ? agoText(lastUpd(r.c.p.id), d.today) : '기록 없음'}</span>
                </span>
                <span className={`flex-none text-[11.5px] font-bold ${fin ? 'text-ok' : on ? 'text-blue' : 'text-ink2'}`}>{!r.n ? '갱신할 업무 없음' : fin ? '완료' : on ? '아래에서 입력 ↓' : '갱신 시작 →'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 사람별 갱신 현황 */}
      <section className={sec}>
        <CardHead title={<><ProjectTag>{shortOf(k)}</ProjectTag> 사람별 갱신 현황</>}>
          <span className="text-[11px] text-ink3">마감 지남 · 이번 주 마감 · 2주 넘게 갱신 없는 업무만 셉니다</span>
          <span className="flex-1" /><span className="text-[11.5px] text-ink2">남은 {left} / {cur.items.length}건</span>
        </CardHead>
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>입력 책임자</th><th className={`${th} w-[26%]`}>이번 주 갱신</th><th className={th}>남은 갱신</th><th className={th}>그중</th><th className={th}>요청</th><th className={th} /></tr></thead>
          <tbody>
            {ppl.length ? ppl.map((r) => {
              const rq = r.who ? req.find((x) => x.id === r.who) : undefined;
              const open = openWho === r.who;
              return (
                <tr key={r.who || '-'} className={`border-b border-border last:border-b-0 ${open ? 'bg-blue-soft' : ''}`}>
                  <td className={td}><b>{r.who ? people.labelOf(r.who) : '미지정'}</b></td>
                  <td className={td}><div className="flex items-center gap-2"><div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-panel-alt"><i className="block h-full bg-ok" style={{ width: `${r.all.length ? ((r.all.length - r.left.length) / r.all.length) * 100 : 100}%` }} /></div><span className="whitespace-nowrap text-[11.5px]">{r.all.length - r.left.length} / {r.all.length}건</span></div></td>
                  <td className={td}>{r.left.length ? <b>{r.left.length}</b> : <span className="text-ok">끝</span>}</td>
                  <td className={`${td} text-[11.5px]`}>{r.late ? <span className="text-danger">마감 지남 {r.late}</span> : null}{r.late && r.stale ? ' · ' : ''}{r.stale ? <span className="text-ink3">2주 넘게 {r.stale}</span> : null}{!r.late && !r.stale && <span className="text-ink3">-</span>}</td>
                  <td className={`${td} text-[11.5px] text-ink3`}>{rq && rq.date >= ws ? `요청함 ${monthDay(rq.date)}` : '-'}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {r.left.length > 0 && r.who && r.who !== me && (
                      <Button size="sm" variant="secondary" title="이 사람의 내 업무 · 알림에 갱신 요청을 띄웁니다"
                        onClick={() => { mut.sendUpdRequest.mutate({ whoId: r.who, projectId: k }); say(`${people.labelOf(r.who)}님에게 진행률 갱신을 요청했습니다 — 내 업무 · 알림에 표시됩니다`); }}>요청 보내기</Button>
                    )}{' '}
                    {r.left.length > 0 && <Button size="sm" variant={open ? 'primary' : 'secondary'} onClick={() => setOpenWho(open ? '' : r.who)}>{open ? '닫기' : '내가 입력'}</Button>}
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={6}><EmptyHint title="이번 주에 갱신할 업무가 없습니다" hint="업무에 시작일 · 종료일이 들어가고 마감이 지났거나 이번 주 마감이거나 2주 넘게 갱신이 없으면 여기 나옵니다." /></td></tr>}
          </tbody>
        </table>
        {sel && (
          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px]">
              <b>{sel.who ? people.labelOf(sel.who) : '미지정'}</b>
              <span className="text-ink3">남은 {sel.left.length}건 · 이번 주 갱신 {sel.all.length - sel.left.length}건 — PM이 대신 입력 (입력한 줄은 초록색으로 남음)</span>
              <span className="flex-1" />
              {sel.left.length > 0 && <Button size="sm" variant="secondary" title="진행률을 바꾸지 않은 나머지 업무를 모두 '변동 없음'으로 확인"
                onClick={() => { smut.markNoChange.mutate(sel.left.map((x) => x.t.id)); say(`${sel.left.length}건을 '변동 없음'으로 확인했습니다`); }}>남은 {sel.left.length}건 모두 변동 없음</Button>}
            </div>
            <table className="w-full text-[12px]">
              <thead className="border-b border-border"><tr><th className={th}>왜</th><th className={th}>번호</th><th className={th}>업무</th><th className={th}>기간</th><th className={th}>마지막 갱신</th><th className={th}>진행률</th><th className={th} /></tr></thead>
              <tbody>
                {[...sel.all].sort(updSortStable).map((x) => {
                  const t = x.t;
                  const l = d.liveMap.get(t.id) ?? { status: t.status, pct: t.actualPct };
                  const late = !!t.end && t.end < d.today && !isDone(l);
                  return (
                    <tr key={t.id} className={`border-b border-border last:border-b-0 ${x.done ? 'bg-ok/10' : ''}`}>
                      <td className={`${td} whitespace-nowrap`}>{x.done ? <><b className="text-ok">✓ 갱신함</b><div className="text-[11px] text-ink3">{updWhat(t, U)}</div></> : <Tag>{UPD_WHY[x.why]}</Tag>}</td>
                      <td className={`${td} whitespace-nowrap text-ink3`}>{t.code}</td>
                      <td className={td}><button type="button" className="text-left hover:underline" title={t.name} onClick={() => modals.openTask(t.id)}>{t.name.length > 34 ? `${t.name.slice(0, 34)}…` : t.name}</button></td>
                      <td className={`${td} whitespace-nowrap text-[11.5px] ${late ? 'text-danger' : 'text-ink2'}`}>{t.start ? monthDay(t.start) : '-'} ~ {t.end ? monthDay(t.end) : '-'}{t.end ? ` · ${leftText(t.end, d.today)}` : ''}</td>
                      <td className={`${td} whitespace-nowrap text-[11.5px] text-ink3`}>{x.last ? agoText(x.last, d.today) : '기록 없음'}</td>
                      <td className={td}><PctInput pct={l.pct} onSet={(n) => setPct(t, n)} onBad={() => say('진행률은 0~100 사이 숫자로 입력하세요', true)} /></td>
                      <td className={td}>{!x.done && <Button size="sm" variant="secondary" title="진행률이 그대로면 눌러서 확인만 표시" onClick={() => { smut.markNoChange.mutate([t.id]); say(`'${t.name}' 변동 없음으로 확인`); }}>변동 없음</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-border px-4 py-2 text-[11px] text-ink3">※ 입력 책임자 = 업무의 첫 담당자 (미지정이면 사업 PM). 각자 내 업무 맨 위에서 5건씩 갱신합니다.</p>
      </section>

      {/* 이번 주 특이사항 */}
      <section className={sec}>
        <CardHead title={<><ProjectTag>{shortOf(k)}</ProjectTag> 이번 주 특이사항</>}>
          <span className="text-[11px] text-ink3">주간 보고서 6번 항목에 그대로 들어갑니다</span><span className="flex-1" />
          <Button size="sm" onClick={() => setParams(new URLSearchParams({ v: 'doc/report', k }))}>주간 보고서 보기 →</Button>
        </CardHead>
        <div key={`${k}|${ws}`} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="grid gap-1 text-[11.5px] font-bold text-ink2">금주 특이사항
            <textarea className={ta} defaultValue={rp?.note ?? ''} placeholder="예: 생산관리 화면 도입기업 시연 완료, 설비 I/F는 PLC 주소맵 회신 대기"
              onBlur={(e) => { if (e.target.value !== (rp?.note ?? '')) { mut.setReport.mutate({ projectId: k, week: ws, patch: { note: e.target.value } }); say('특이사항 저장 — 주간 보고서에 들어갑니다'); } }} />
          </label>
          <label className="grid gap-1 text-[11.5px] font-bold text-ink2">도입기업 협조 요청사항
            <textarea className={ta} defaultValue={rp?.req ?? ''} placeholder="예: 기준정보(품목 · BOM) 엑셀 11/12까지 전달 요청"
              onBlur={(e) => { if (e.target.value !== (rp?.req ?? '')) { mut.setReport.mutate({ projectId: k, week: ws, patch: { req: e.target.value } }); say('협조 요청사항 저장 — 주간 보고서에 들어갑니다'); } }} />
          </label>
        </div>
      </section>
      {modals.node}
    </div>
  );
}
