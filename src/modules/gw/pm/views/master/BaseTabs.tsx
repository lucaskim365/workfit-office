import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { monthDay, todayStr } from '@/domain/pm/rules';
import { ST_SYS } from '@/domain/pm/master';
import { bizUse, codeDelBlock, genPlan, linkData, orgUse, stageUse, stagesOfBiz, statusUse, stdOf, stdUse, sugList, sugPick, type GenOpt, type LinkStage, type Sug } from '@/domain/pm/masterLink';
import { PM_ORG_TYPES, type PmCode, type PmOrg, type PmProject, type PmStdTask } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { hasV, MissBar } from './BaseView';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';
import { pmBase } from '@/data/pm/pm.store';

/**
 * 기준정보 › 사업 · 인력 · 코드의 나머지 탭 (데모 baseLink 3815 · baseGen 3882 · baseOrgs 3740 · baseUsers 3749 · baseCodes 3768 · baseStdTasks 3947)
 * + 창 (orgForm 3988 · codeForm 4022 · stdForm 3958 · 추천 일괄 연결 sugShow 3918). 고치기는 pm.manage.
 */
const th = 'px-3 py-2 text-left text-[11.5px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-middle';
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const byKey = (a: readonly PmProject[]) => [...a].sort((x, y) => Number(x.id.replace(/\D/g, '')) - Number(y.id.replace(/\D/g, '')));
type Mut = ReturnType<typeof usePmMutations>;
type People = ReturnType<typeof usePmPeople>;
interface TabProps { d: PmDerived; mut: Mut; people: People; manage: boolean; shortOf: (id: string) => string; say: (t: string, bad?: boolean) => void; openTask: (id: string) => void }

const Chips = ({ ids, shortOf }: { ids: string[]; shortOf: (id: string) => string }) => (ids.length ? <span className="flex flex-wrap gap-1">{ids.map((k) => <ProjectTag key={k}>{shortOf(k)}</ProjectTag>)}</span> : <span className="text-[11px] text-ink3">사용 안 함</span>);
function F({ label, req, full, bad, help, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; help?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
      {help && <small className="font-normal text-ink3">{help}</small>}
    </label>
  );
}
const Foot = ({ err, onDel, onClose, onSave, lock }: { err: string; onDel?: () => void; onClose: () => void; onSave: () => void; lock?: boolean }) => (
  <div className="flex w-full items-center gap-2">
    {onDel && <Button variant="secondary" onClick={onDel}>삭제</Button>}
    <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{lock ? PARTIAL_LOCK_MSG : err}</span>
    <Button variant="secondary" onClick={onClose}>취소</Button>
    <Button disabled={lock} onClick={onSave}>저장</Button>
  </div>
);
const SiteBtns = ({ d, cur, onPick, shortOf }: { d: PmDerived; cur: string; onPick: (k: string) => void; shortOf: (id: string) => string }) => (
  <div className="flex flex-wrap gap-1.5">{byKey(d.snap.projects).map((p) => <Button key={p.id} size="sm" variant={p.id === cur ? 'primary' : 'secondary'} onClick={() => onPick(p.id)}>{shortOf(p.id)}</Button>)}</div>
);

// ── 사업 › 단계 › 업무 ────────────────────────────────

export function LinkTab({ d, mut, manage, shortOf, say, openTask, onNewTask }: TabProps & { onNewTask: (projectId: string, stage: string) => void }) {
  const { snap } = d;
  const sites = byKey(snap.projects);
  const [k, setK] = useState(sites[0]?.id ?? '');
  const [stage, setStage] = useState('');
  const [f, setF] = useState<'all' | 'link' | 'std' | 'prj'>('all');
  const [sug, setSug] = useState<{ all: boolean } | null>(null);
  const tl = useMemo(() => new Map(snap.tlinks.map((l) => [l.id, l.stdId])), [snap.tlinks]);
  const p = sites.find((x) => x.id === k) ?? sites[0];
  if (!p) return <EmptyHint title="등록된 사업이 없습니다" />;
  const L = linkData(p, snap.tasks, snap.codes, snap.stdTasks, tl);
  const curName = L.some((x) => x.name === stage) ? stage : (L.find((x) => x.nPrj || x.nStd) ?? L[0])?.name ?? '';
  const cur = L.find((x) => x.name === curName);
  const tot = L.reduce((a, x) => ({ std: a.std + x.nStd, prj: a.prj + x.nPrj, link: a.link + x.nLink }), { std: 0, prj: 0, link: 0 });
  const nSug = L.reduce((a, x) => a + x.rows.filter((r) => !r.std && r.sug).length, 0);
  const miss = cur ? cur.rows.filter((r) => r.std && !r.t) : [];
  const grp = (r: LinkStage['rows'][number]) => (r.std && r.t ? 0 : !r.std ? 1 : 2);
  const rows = cur ? cur.rows.map((r, i) => ({ r, i })).filter(({ r }) => f === 'all' || (f === 'link' && r.std && r.t) || (f === 'std' && r.std && !r.t) || (f === 'prj' && !r.std)).sort((a, b) => grp(a.r) - grp(b.r) || a.i - b.i).map((x) => x.r) : [];
  const freeStd = cur ? cur.rows.filter((r) => r.std && !r.t).map((r) => r.std!) : [];
  const freePrj = cur ? cur.rows.filter((r) => !r.std).length : 0;
  const addStd = async (ids: string[], note: string) => { const n = await mut.addStdToProject.mutateAsync({ projectId: p.id, rows: ids.map((stdId) => ({ stdId })), note }); say(`${shortOf(p.id)} 업무 목록에 ${n}건 추가`); };
  const stBadge = (r: LinkStage['rows'][number]) => (r.std && r.t ? <Tag tone="ok">연결</Tag> : r.std ? <Tag tone="warn">표준만</Tag> : <Tag tone="run">사업 고유</Tag>);
  const pick = (kk: string) => { setK(kk); setStage(''); setF('all'); };
  return (
    <div className="space-y-3">
      <SiteBtns d={d} cur={p.id} onPick={pick} shortOf={shortOf} />
      <div className={`${card} flex flex-wrap items-center gap-3 px-4 py-3 text-[12px]`}>
        <ProjectTag>{shortOf(p.id)}</ProjectTag><b>{p.company}</b><span className="text-ink3">{p.biz || '사업구분 없음'} · {p.start || '-'} ~ {p.end || '-'}</span>
        <span className="flex-1" />
        <span>단계 <b>{L.length}</b></span><span>표준 업무 <b>{tot.std}</b></span><span>사업 업무 <b>{tot.prj}</b></span><span>연결 <b className="text-ok">{tot.link}</b></span>
        <span className="text-ink3">표준만 {tot.std - tot.link} · 사업 고유 {tot.prj - tot.link}</span>
        {nSug > 0 && <Button size="sm" disabled={!manage} onClick={() => setSug({ all: false })}>추천 일괄 연결 ({nSug}건)</Button>}
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[200px_1fr]">
        <section className={card}>
          <div className="flex items-center border-b border-border px-3 py-2 text-[12px]"><b>단계</b><span className="flex-1" /><span className="text-[11px] text-ink3">표준 / 사업</span></div>
          <div className="max-h-[560px] overflow-y-auto p-1.5">
            {L.map((x) => (
              <button key={x.name} type="button" onClick={() => { setStage(x.name); setF('all'); }} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[12px] ${x.name === curName ? 'bg-blue-soft' : 'hover:bg-panel-alt'}`}>
                <span className="min-w-0 flex-1 truncate"><b>{x.name}</b>{!x.isStd && <Tag tone="run" title="이 사업구분의 표준 단계에 없음">고유</Tag>}</span>
                <span className="text-[11px] tabular-nums text-ink2">{x.nStd} / {x.nPrj}</span>
                <i className={`h-1.5 w-1.5 rounded-full ${x.nStd && x.nLink < x.nStd ? 'bg-amber' : ''}`} title={x.nStd && x.nLink < x.nStd ? '빠진 표준 업무 있음' : ''} />
              </button>
            ))}
            {L.some((x) => !x.isStd) && <p className="px-2 pt-2 text-[11px] text-ink3">고유 = 사업 업무 목록에만 있는 단계</p>}
          </div>
        </section>
        <section className={`${card} min-w-0`}>
          {cur ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                <b className="text-[13px]">{cur.name}</b>
                {!cur.isStd && <Button size="sm" variant="secondary" disabled={!manage} title={`이 단계를 ${p.biz} 표준 단계로 등록`}
                  onClick={async () => { if (!p.biz) { say('사업구분이 없는 사업입니다', true); return; } await mut.saveCode.mutateAsync({ c: { id: `g:${p.biz}|${cur.name}`, group: 'stage', name: cur.name, biz: p.biz, track: '', ord: 0, note: '', auto: false }, base: [] /* 새로 만들기 */ }); say(`'${cur.name}'을(를) ${p.biz} 표준 단계로 등록`); }}>표준 단계로 등록</Button>}
                <span className="flex-1" />
                {miss.length > 0 && !freePrj && <Button size="sm" variant="secondary" disabled={!manage} onClick={() => { if (confirm(`빠진 표준 업무 ${miss.length}개를 ${shortOf(p.id)} 업무 목록에 추가할까요?`)) void addStd(miss.map((r) => r.std!.id), '표준 세부 TASK 추가'); }}>빠진 표준 업무 {miss.length}개 모두 사업에 추가</Button>}
                <Button size="sm" disabled={!manage} onClick={() => onNewTask(p.id, cur.name)}>+ 사업 업무 추가</Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2">
                {([['all', '전체', cur.rows.length], ['link', '연결', cur.nLink], ['std', '표준만', cur.nStd - cur.nLink], ['prj', '사업 고유', cur.nPrj - cur.nLink]] as const).map(([v, l, n]) => <Button key={v} size="sm" variant={f === v ? 'primary' : 'secondary'} onClick={() => setF(v)}>{l} {n}</Button>)}
                {freePrj > 0 && freeStd.length > 0 && <span className="ml-1.5 text-[11px] text-ink3">이름이 달라 연결 안 된 사업 업무가 있습니다. 같은 일이면 표준과 연결하세요 (추천 참고)</span>}
              </div>
              <table className="w-full table-fixed text-[12px]">
                <colgroup><col className="w-[11%]" /><col className="w-[36%]" /><col className="w-[35%]" /><col className="w-[18%]" /></colgroup>
                <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>연결</th><th className={th}>이 사업 업무</th><th className={th}>표준 세부 업무</th><th className={th} /></tr></thead>
                <tbody>
                  {rows.length ? rows.map((r, i) => {
                    const t = r.t;
                    const x = r.std;
                    return (
                      <tr key={(t?.id ?? '') + (x?.id ?? '') + i} className="border-b border-border last:border-b-0 align-top">
                        <td className={td}>{stBadge(r)}{r.how && <div className="text-[11px] text-ink3">{r.how}</div>}</td>
                        <td className={td}>{t ? <><button type="button" className="text-left font-bold hover:underline" onClick={() => openTask(t.id)}>{t.name}</button>{t.milestone && <b className="text-amber"> ◆</b>}<div className="text-[11px] text-ink3">{t.code} · {t.start || t.end ? `${monthDay(t.start)}~${monthDay(t.end)}` : '일정 없음'} · {(d.liveMap.get(t.id)?.pct ?? t.actualPct)}%</div></> : <span className="text-[11px] text-ink3">— 이 사업 업무 목록에 없음</span>}</td>
                        <td className={td}>{x ? <><span>{x.name}</span>{x.milestone && <b className="text-amber"> ◆</b>}<div className="text-[11px] text-ink3">{x.code || '-'} · 착수 후 {x.off}일 · {x.dur}일{x.output ? ` · ${trunc(x.output, 20)}` : ''}</div></>
                          : r.sug ? <><Tag tone="warn">추천</Tag> <span className="text-ink2">{r.sug.name}</span><div className="text-[11px] text-ink3">{r.sug.code || '-'}</div></> : <span className="text-[11px] text-ink3">—</span>}</td>
                        <td className={td}>
                          {manage && <div className="flex flex-col gap-1">
                            {x && !t && <Button size="sm" onClick={() => void addStd([x.id], '표준 세부 TASK 추가')}>사업에 추가</Button>}
                            {t && x && r.how === '직접' && <Button size="sm" variant="secondary" onClick={() => { void mut.setTlinks.mutateAsync([[t.id, null]]); say('연결을 풀었습니다'); }}>연결 해제</Button>}
                            {t && !x && r.sug && <Button size="sm" onClick={() => { void mut.setTlinks.mutateAsync([[t.id, r.sug!.id]]); say('표준 업무와 연결했습니다'); }}>추천과 연결</Button>}
                            {t && !x && freeStd.length > 0 && (
                              <select className="w-full rounded border border-border bg-panel px-1.5 py-1 text-[11.5px]" value="" onChange={(e) => { if (e.target.value) { void mut.setTlinks.mutateAsync([[t.id, e.target.value]]); say('표준 업무와 연결했습니다'); } }} aria-label="다른 표준">
                                <option value="">다른 표준 ▾</option>{freeStd.map((y) => <option key={y.id} value={y.id}>{y.code ? `${y.code} ` : ''}{trunc(y.name, 30)}</option>)}
                              </select>
                            )}
                            {t && !x && <Button size="sm" variant="secondary" disabled={!cur.isStd} title={cur.isStd ? undefined : '먼저 표준 단계로 등록하세요'} onClick={async () => { try { await mut.stdFromTask.mutateAsync(t.id); say(`'${t.name}'을(를) ${p.biz} 표준에 추가`); } catch (e) { say((e as Error).message, true); } }}>표준에 추가</Button>}
                          </div>}
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan={4}><EmptyHint title="해당하는 업무가 없습니다" /></td></tr>}
                </tbody>
              </table>
            </>
          ) : <EmptyHint title="단계를 고르세요" />}
        </section>
      </div>
      <p className="text-[11px] text-ink3">연결 = 같은 단계 안에서 업무 이름이 같은 것 (띄어쓰기 무시). 표준은 [코드] 탭의 단계 › 세부 업무에서 관리합니다.</p>
      {sug && <SugModal d={d} k={p.id} all={sug.all} tl={tl} shortOf={shortOf} onScope={(all) => setSug({ all })} onClose={() => setSug(null)}
        onApply={async (pick) => { const { pairs, skip } = sugPick(pick); await mut.setTlinks.mutateAsync(pairs); setSug(null); say(`${pairs.length}건 연결${skip ? ` · 같은 표준에 겹친 ${skip}건은 건너뜀` : ''}`); }} />}
    </div>
  );
}

function SugModal({ d, k, all, tl, shortOf, onScope, onClose, onApply }: { d: PmDerived; k: string; all: boolean; tl: ReadonlyMap<string, string>; shortOf: (id: string) => string; onScope: (all: boolean) => void; onClose: () => void; onApply: (pick: Sug[]) => Promise<void> }) {
  const { snap } = d;
  const L = useMemo(() => sugList(all ? byKey(snap.projects) : snap.projects.filter((p) => p.id === k), (p) => linkData(p, snap.tasks, snap.codes, snap.stdTasks, tl)), [all, k, snap, tl]);
  const [on, setOn] = useState<boolean[]>(() => L.map((x) => x.on));
  const cur = on.length === L.length ? on : L.map((x) => x.on);
  const tog = (i: number) => setOn(cur.map((v, j) => (j === i ? !v : v)));
  return (
    <Modal open onClose={onClose} width={960} title="추천 일괄 연결"
      footer={<div className="flex w-full items-center gap-2"><span className="text-[12px] text-ink3">선택 {cur.filter(Boolean).length} / {L.length}</span><span className="flex-1" /><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={() => { const pick = L.filter((_, i) => cur[i]); if (!pick.length) return; void onApply(pick); }}>선택한 짝 연결</Button></div>}>
      <p className="mb-2 text-[12px] text-ink2">이름이 비슷한 표준 업무를 짝으로 추천했습니다. 같은 일이 맞는 것만 체크하고 [선택한 짝 연결]을 누르세요. 유사도 50% 이상은 미리 체크해 두었습니다.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant={all ? 'secondary' : 'primary'} onClick={() => { onScope(false); setOn([]); }}>{shortOf(k)}만</Button>
        <Button size="sm" variant={all ? 'primary' : 'secondary'} onClick={() => { onScope(true); setOn([]); }}>모든 사업</Button>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onClick={() => setOn(L.map(() => true))}>전체 선택</Button>
        <Button size="sm" variant="secondary" onClick={() => setOn(L.map(() => false))}>전체 해제</Button>
      </div>
      <div className="max-h-[56vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th} />{all && <th className={th}>사업</th>}<th className={th}>단계</th><th className={th}>이 사업 업무</th><th className={th}>추천 표준 업무</th><th className={th}>유사도</th></tr></thead>
          <tbody>{L.length ? L.map((x, i) => (
            <tr key={x.t.id} className={`border-b border-border last:border-b-0 ${x.dup ? 'opacity-55' : ''}`}>
              <td className={td}><input type="checkbox" checked={!!cur[i]} onChange={() => tog(i)} /></td>
              {all && <td className={td}><ProjectTag>{shortOf(x.k)}</ProjectTag></td>}
              <td className={td}>{x.stage}</td>
              <td className={td}><b>{x.t.name}</b><div className="text-[11px] text-ink3">{x.t.code}</div></td>
              <td className={td}>{x.sug.name}<div className="text-[11px] text-ink3">{x.sug.code || '-'}{x.dup && <span className="text-amber"> · 다른 업무가 더 비슷함</span>}</div></td>
              <td className={td}><Tag tone={x.sc >= 0.5 ? 'ok' : 'warn'}>{Math.min(100, Math.round(x.sc * 100))}%</Tag></td>
            </tr>
          )) : <tr><td colSpan={6}><EmptyHint title="추천할 짝이 없습니다" /></td></tr>}</tbody>
        </table>
      </div>
    </Modal>
  );
}

// ── 업무 목록 생성 ────────────────────────────────────

export function GenTab({ d, mut, manage, shortOf, say, onGoLink }: TabProps & { onGoLink: (k: string) => void }) {
  const { snap } = d;
  const sites = byKey(snap.projects);
  const [k, setK] = useState(sites[0]?.id ?? '');
  const [g, setG] = useState<GenOpt>({ start: '', end: '', fit: true, pre: true, renum: false });
  const tl = useMemo(() => new Map(snap.tlinks.map((l) => [l.id, l.stdId])), [snap.tlinks]);
  const p = sites.find((x) => x.id === k) ?? sites[0];
  if (!p) return <EmptyHint title="등록된 사업이 없습니다" />;
  const P = genPlan(p, snap.tasks, snap.codes, snap.stdTasks, tl, g, todayStr());
  const { rows } = P;
  const stages = [...new Set(rows.map((r) => r.stage))];
  const lastEnd = rows.reduce((a, r) => (r.end > a ? r.end : a), '');
  const over = lastEnd > (g.end || p.end || '9');
  const addN = rows.length - P.nHave;
  const csv = () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['사업키', '사업구분', '도입기업', '단계', '번호', '세부 업무', '산출물', 'PM', '실행담당', '개발담당자', '시작일', '종료일', '기간(일)', 'M/S', '상태', '계획진행률', '실적진행률'];
    const body = rows.map((r) => [p.id, p.biz, p.company, r.stage, r.code, r.name, r.output, p.pmName, '', '', r.start, r.end, r.dur, r.milestone ? '◆' : '', '계획', '0%', '0%']);
    const text = `﻿${[head, ...body].map((r) => r.map(q).join(',')).join('\r\n')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `업무목록생성_${shortOf(p.id)}_${todayStr()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    say(`업무 ${rows.length}건 내려받기 — 통합 업무 목록 열 순서와 같습니다`);
  };
  const apply = async () => {
    const add = rows.filter((r) => !r.have);
    if (!add.length || !confirm(`${shortOf(p.id)} 업무 목록에 업무 ${add.length}건을 추가할까요?${P.nPrj ? ` (기존 ${P.nPrj}건은 그대로)` : ''}`)) return;
    const n = await mut.addStdToProject.mutateAsync({ projectId: p.id, rows: add.map((r) => ({ stdId: r.std.id, code: r.code, start: r.start, end: r.end })), note: '기준정보로 WBS 생성' });
    say(`${shortOf(p.id)} 업무 목록에 업무 ${n}건 추가`);
  };
  return (
    <div className="space-y-3">
      <SiteBtns d={d} cur={p.id} onPick={(x) => { setK(x); setG((o) => ({ ...o, start: '', end: '' })); }} shortOf={shortOf} />
      <section className={`${card} px-4 py-3 text-[12px]`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <ProjectTag>{shortOf(p.id)}</ProjectTag><b>{p.company}</b><span className="text-ink3">{p.biz || '사업구분 없음'} · PM {p.pmName || '-'}</span>
          <span className="flex-1" />
          <label className="flex items-center gap-1">시작일 <input type="date" className="rounded border border-border px-1.5 py-0.5" value={P.start} onChange={(e) => setG((o) => ({ ...o, start: e.target.value }))} /></label>
          <label className="flex items-center gap-1">종료일 <input type="date" className="rounded border border-border px-1.5 py-0.5" value={P.end} onChange={(e) => setG((o) => ({ ...o, end: e.target.value }))} /></label>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-4">
          <label className="flex items-center gap-1"><input type="checkbox" checked={g.fit} onChange={(e) => setG((o) => ({ ...o, fit: e.target.checked }))} />협약 기간에 맞춰 일정 늘리고 줄이기 <span className="text-ink3">(표준 {P.span}일 → {P.days}일, ×{P.f.toFixed(2)})</span></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={g.pre} onChange={(e) => setG((o) => ({ ...o, pre: e.target.checked }))} />협약 이전 단계 포함</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={g.renum} onChange={(e) => setG((o) => ({ ...o, renum: e.target.checked }))} />업무 번호 새로 매기기 (단계.순번)</label>
        </div>
      </section>
      {!rows.length ? (
        <section className={card}><EmptyHint title={`${p.biz || '이 사업구분'}에 표준 세부 업무가 없습니다`} hint="[코드] 탭의 단계 › 세부 업무에서 표준을 등록하면 여기서 업무 목록을 만들 수 있습니다." /></section>
      ) : (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-[12px]">
            <b className="text-[13px]">생성될 업무 목록</b>
            <span className="text-ink3">단계 {stages.length} · 업무 {rows.length} · M/S {rows.filter((r) => r.milestone).length} · {rows[0].start} ~ {lastEnd}</span>
            {P.nPrj ? <span>이 사업 업무 {P.nPrj}건 중 <b className="text-ok">{P.nHave}</b>건과 같음 · 새로 생길 업무 <b>{addN}</b>건</span> : <Tag tone="run">이 사업은 업무 목록이 비어 있음</Tag>}
            <span className="flex-1" />
            <Button size="sm" variant="secondary" onClick={csv}>엑셀(CSV) 내려받기</Button>
            <Button size="sm" disabled={!manage || !addN} onClick={() => void apply()}>{P.nPrj ? `새 업무 ${addN}건 업무 목록에 추가` : `업무 목록 ${rows.length}건 생성`}</Button>
          </div>
          {P.nPrj > P.nHave && <div className="mx-4 my-2.5 rounded-lg border border-amber/30 bg-amber-soft px-3 py-2 text-[12px] text-ink">이 사업 업무 목록에 표준과 연결 안 된 업무가 <b>{P.nPrj - P.nHave}건</b> 있습니다. 이름만 다른 같은 일이면 '새로 생김'으로 잘못 보여 중복으로 추가됩니다. 먼저 <Button size="sm" variant="secondary" onClick={() => onGoLink(p.id)}>사업 › 단계 › 업무에서 연결</Button>하세요.</div>}
          {over && <div className="mx-4 my-2.5 rounded-lg border border-amber/30 bg-amber-soft px-3 py-2 text-[12px]">마지막 업무가 종료일({g.end || p.end}) 뒤에 끝납니다. '협약 기간에 맞춤'을 켜거나 종료일을 확인하세요.</div>}
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 border-b border-border bg-panel-alt"><tr><th className={th}>번호</th><th className={th}>세부 업무</th><th className={th}>산출물</th><th className={th}>시작</th><th className={th}>종료</th><th className={`${th} text-right`}>기간</th><th className={th}>M/S</th><th className={th}>이 사업 업무 목록</th></tr></thead>
              <tbody>
                {stages.map((st) => {
                  const rs = rows.filter((r) => r.stage === st);
                  return [
                    <tr key={`h${st}`} className="bg-panel-alt"><td colSpan={8} className={td}><b>{st}</b> <span className="text-[11px] text-ink3">{rs.length}건 · {rs.reduce((a, r) => (r.start < a ? r.start : a), '9')} ~ {rs.reduce((a, r) => (r.end > a ? r.end : a), '')}</span></td></tr>,
                    ...rs.map((r) => (
                      <tr key={r.std.id} className={`border-b border-border ${r.have ? 'opacity-60' : ''}`}>
                        <td className={`${td} tabular-nums`}>{r.code}</td><td className={td}>{r.name}</td><td className={`${td} text-ink3`}>{r.output || '-'}</td>
                        <td className={`${td} tabular-nums`}>{r.start}</td><td className={`${td} tabular-nums`}>{r.end}</td><td className={`${td} text-right`}>{r.dur}일</td><td className={td}>{r.milestone && <b className="text-amber">◆</b>}</td>
                        <td className={td}>{r.have ? <Tag tone="ok" title={`${r.have.code} ${r.have.name}`}>있음 · {r.have.code}</Tag> : <Tag tone="run">새로 생김</Tag>}</td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-[11px] text-ink3">반영하면 '새로 생김' 업무만 이 사업 업무 목록에 추가됩니다 (기존 업무는 그대로, 변경 이력에 남음). 사업구분의 단계 순서와 표준 세부 업무는 [코드] 탭에서 고칩니다.</p>
        </section>
      )}
    </div>
  );
}

// ── 기업 · 기관 ───────────────────────────────────────

const ORG_MF = [['bizRegNo', '사업자번호', (o: PmOrg) => hasV(o.bizRegNo)], ['ceo', '대표자', (o: PmOrg) => hasV(o.ceo)], ['region', '소재지', (o: PmOrg) => hasV(o.region)], ['contact', '담당자 · 연락처', (o: PmOrg) => hasV(o.contact) || hasV(o.phone)]] as const;
export function OrgTab({ d, mut, manage, shortOf, say, q, editing, setEditing }: TabProps & { q: (...xs: string[]) => boolean; editing: PmOrg | 'new' | null; setEditing: (o: PmOrg | 'new' | null) => void }) {
  const { snap } = d;
  const [type, setType] = useState<'all' | PmOrg['type']>('all');
  const [miss, setMiss] = useState('');
  const pool = snap.orgs.filter((o) => type === 'all' || o.type === type);
  const cur = ORG_MF.find((f) => f[0] === miss);
  const list = pool.filter((o) => q(o.type, o.name, o.ceo, o.region, o.contact, o.bizRegNo)).filter((o) => !cur || !cur[2](o));
  const dash = <span className="text-ink3">-</span>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...PM_ORG_TYPES] as const).map((t) => <Button key={t} size="sm" variant={type === t ? 'primary' : 'secondary'} onClick={() => setType(t)}>{t === 'all' ? '전체' : t} {t === 'all' ? snap.orgs.length : snap.orgs.filter((o) => o.type === t).length}</Button>)}
      </div>
      <MissBar all={pool} fields={ORG_MF} what="곳" on={miss} onPick={setMiss} />
      <section className={`${card} overflow-x-auto`}>
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>구분</th><th className={th}>이름</th><th className={th}>사업자번호</th><th className={th}>대표자</th><th className={th}>소재지</th><th className={th}>담당자 · 연락처</th><th className={th}>쓰는 사업</th><th className={th} /></tr></thead>
          <tbody>
            {list.length ? list.map((o) => (
              <tr key={o.id} onClick={manage ? () => setEditing(o) : undefined} className={`border-b border-border last:border-b-0 ${manage ? 'cursor-pointer hover:bg-panel-alt' : ''}`}>
                <td className={td}><Tag tone={o.type === '도입기업' ? 'run' : o.type === '공급기업' ? 'ok' : 'plain'}>{o.type}</Tag></td>
                <td className={td}><b>{o.name}</b></td>
                <td className={`${td} tabular-nums`}>{o.bizRegNo || dash}</td><td className={td}>{o.ceo || dash}</td><td className={td}>{o.region ? trunc(o.region, 24) : dash}</td>
                <td className={td}>{[o.contact, o.phone].filter(Boolean).join(' · ') || dash}</td>
                <td className={td}><Chips ids={orgUse(o, snap.projects).map((p) => p.id)} shortOf={shortOf} /></td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setEditing(o); }}>수정</Button>}</td>
              </tr>
            )) : <tr><td colSpan={8}><EmptyHint title="조건에 맞는 기업 · 기관이 없습니다" /></td></tr>}
          </tbody>
        </table>
      </section>
      {editing && <OrgFormModal o={editing === 'new' ? null : editing} defType={type === 'all' ? '도입기업' : type} d={d} shortOf={shortOf}
        onSave={async (o) => { const n = await mut.saveOrg.mutateAsync({ o, base: editing === 'new' ? [] : [pmBase('orgs', editing.id, editing)] }); /* 기준표 = 창을 연 그 기록 (F5) */ say(n ? `${o.name} 수정 — 사업 ${n}개도 함께 바뀜` : `${o.name} ${editing === 'new' ? '등록' : '수정'}`); setEditing(null); }}
        onRemove={async (o) => { await mut.removeOrg.mutateAsync(o.id); say(`${o.name} 삭제됨`); setEditing(null); }} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OrgFormModal({ o, defType, d, shortOf, onSave, onRemove, onClose }: { o: PmOrg | null; defType: PmOrg['type']; d: PmDerived; shortOf: (id: string) => string; onSave: (o: PmOrg) => Promise<void>; onRemove: (o: PmOrg) => Promise<void>; onClose: () => void }) {
  const isNew = !o;
  const lock = usePmPartialLock() && isNew;
  const used = o ? orgUse(o, d.snap.projects) : [];
  const [v, setV] = useState<PmOrg>(() => o ?? { id: '', type: defType, name: '', bizRegNo: '', ceo: '', region: '', contact: '', phone: '', email: '', note: '', auto: false });
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof PmOrg>(k: K, x: PmOrg[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    if (!v.name.trim()) { setErr(['이름을 입력해 주세요', 'name']); return; }
    if (d.snap.orgs.some((x) => x.id !== v.id && x.type === v.type && x.name === v.name.trim())) { setErr(['같은 구분에 같은 이름이 이미 있습니다', 'name']); return; }
    if (!isNew && used.length && v.type !== o.type) { setErr(['사업에서 쓰는 중이라 구분을 바꿀 수 없습니다', 'type']); return; }
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { setErr(['이메일 형식이 올바르지 않습니다', 'email']); return; }
    try { await onSave({ ...v, name: v.name.trim() }); } catch (e) { setErr([(e as Error).message, '']); }
  };
  const del = async () => {
    if (!o) return;
    if (used.length) { setErr([`사업 ${used.length}개(${used.map((p) => shortOf(p.id)).join(', ')})에서 쓰는 중이라 지울 수 없습니다`, '']); return; }
    if (confirm(`${o.name}을(를) 지울까요?`)) await onRemove(o);
  };
  const bad = (f: string) => err?.[1] === f;
  return (
    <Modal open onClose={onClose} width={680} title={isNew ? '기업 · 기관 등록' : `기업 · 기관 수정 — ${o.name}`} footer={<Foot lock={lock} err={err?.[0] ?? ''} onDel={isNew ? undefined : () => void del()} onClose={onClose} onSave={() => void save()} />}>
      {!isNew && used.length > 0 && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">사업 {used.length}개({used.map((p) => shortOf(p.id)).join(', ')})의 {o.type} 칸에 쓰입니다. 이름을 바꾸면 그 사업들도 함께 바뀝니다.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="구분" req bad={bad('type')}><select className={inp} value={v.type} onChange={(e) => set('type', e.target.value as PmOrg['type'])}>{PM_ORG_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
        <F label="이름" req bad={bad('name')}><input className={inp} value={v.name} placeholder="예: ㈜OO정밀, 경남TP" onChange={(e) => set('name', e.target.value)} /></F>
        <F label="사업자등록번호"><input className={inp} value={v.bizRegNo} placeholder="000-00-00000" onChange={(e) => set('bizRegNo', e.target.value)} /></F>
        <F label="대표자"><input className={inp} value={v.ceo} onChange={(e) => set('ceo', e.target.value)} /></F>
        <F label="소재지" full><input className={inp} value={v.region} placeholder="예: 경남 창원시 OO로 12" onChange={(e) => set('region', e.target.value)} /></F>
        <F label="담당자"><input className={inp} value={v.contact} placeholder="예: 홍길동 과장" onChange={(e) => set('contact', e.target.value)} /></F>
        <F label="연락처"><input type="tel" className={inp} value={v.phone} placeholder="010-0000-0000" onChange={(e) => set('phone', e.target.value)} /></F>
        <F label="이메일" bad={bad('email')}><input type="email" className={inp} value={v.email} onChange={(e) => set('email', e.target.value)} /></F>
        <F label="메모" full><textarea className={`${inp} min-h-[60px]`} value={v.note} onChange={(e) => set('note', e.target.value)} /></F>
      </div>
    </Modal>
  );
}

// ── 인력 (그룹웨어 사용자 — 읽기만) ───────────────────

export function UserTab({ d, people, shortOf, q }: TabProps & { q: (...xs: string[]) => boolean }) {
  const { snap } = d;
  const list = people.people.filter((u) => q(u.name, u.position, u.dept, u.jobTitle));
  const groups: Array<{ k: string; L: typeof list }> = [];
  for (const u of list) { const k = u.dept || '소속 없음'; let g = groups.find((x) => x.k === k); if (!g) groups.push((g = { k, L: [] })); g.L.push(u); }
  const nTask = (id: string) => snap.tasks.filter((t) => t.assigneeIds.includes(id)).length;
  const pmOf = (id: string, label: string) => snap.projects.filter((p) => p.pmUserId === id || (!!p.pmName && p.pmName.split(/[\s/,]+/)[0] === label.split(' ')[0]));
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">인력은 그룹웨어 사용자입니다. 등록 · 직급 · 연락처 수정은 관리자 콘솔 › 사용자 · 인사 정보에서 합니다 (프로젝트 관리에서 고치지 않음).</p>
      <section className={`${card} overflow-x-auto`}>
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>이름</th><th className={th}>직급</th><th className={th}>역할</th><th className={`${th} text-right`}>담당 업무</th><th className={th}>PM 사업</th></tr></thead>
          <tbody>
            {groups.length ? groups.map((g) => [
              <tr key={`g${g.k}`} className="bg-panel-alt"><td colSpan={5} className={td}><b>{g.k}</b> <span className="ml-2 text-[11px] text-ink3">{g.L.length}명 · 담당 업무 {g.L.reduce((a, u) => a + nTask(u.id), 0).toLocaleString()}건</span></td></tr>,
              ...g.L.map((u) => { const pm = pmOf(u.id, u.name); return (
                <tr key={u.id} className="border-b border-border">
                  <td className={td}><b>{u.name}</b></td><td className={td}>{u.position || <span className="text-ink3">-</span>}</td>
                  <td className={td}>{pm.length ? <Tag tone="navy">PM</Tag> : <Tag>팀원</Tag>}</td>
                  <td className={`${td} text-right tabular-nums`}>{nTask(u.id)}</td>
                  <td className={td}><Chips ids={pm.map((p) => p.id)} shortOf={shortOf} /></td>
                </tr>
              ); }),
            ]) : <tr><td colSpan={5}><EmptyHint title="조건에 맞는 인력이 없습니다" /></td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ── 코드 (사업구분 · 트랙 / 업무 상태 / 단계 / 표준 세부 업무) ─

type CodeEdit = { g: PmCode['group']; c: PmCode | null } | null;
export function CodeTab({ d, mut, manage, shortOf, say }: TabProps) {
  const { snap } = d;
  const C = (g: PmCode['group']) => snap.codes.filter((c) => c.group === g);
  const bizs = C('biz').map((c) => c.name);
  const [biz, setBiz] = useState(bizs[0] ?? '');
  const [sel, setSel] = useState('');
  const [edit, setEdit] = useState<CodeEdit>(null);
  const [std, setStd] = useState<PmStdTask | 'new' | null>(null);
  const b = bizs.includes(biz) ? biz : bizs[0] ?? '';
  const stages = stagesOfBiz(snap.codes, b);
  const st = stages.find((c) => c.id === sel) ?? stages[0];
  const sts = st ? stdOf(snap.stdTasks, st.biz, st.name) : [];
  const btn = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div className="space-y-3">
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section className={card}>
          <div className="flex items-center border-b border-border px-4 py-2.5"><b className="text-[13px]">사업구분 · 트랙</b><span className="flex-1" />{manage && <Button size="sm" variant="secondary" onClick={() => setEdit({ g: 'biz', c: null })}>+ 추가</Button>}</div>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>트랙</th><th className={th}>사업구분</th><th className={th}>쓰는 사업</th><th className={`${th} text-right`}>단계</th><th className={th} /></tr></thead>
            <tbody>{[...C('biz')].sort((x, y) => ((x.track || '힣') < (y.track || '힣') ? -1 : 1)).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className={td}><b>{c.track || '-'}</b></td><td className={td}>{c.name}</td><td className={td}><Chips ids={bizUse(c, snap.projects).map((p) => p.id)} shortOf={shortOf} /></td>
                <td className={`${td} text-right`}>{C('stage').filter((s) => s.biz === c.name).length}</td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={() => setEdit({ g: 'biz', c })}>수정</Button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
        <section className={card}>
          <div className="flex items-center border-b border-border px-4 py-2.5"><b className="text-[13px]">업무 상태</b><span className="flex-1" />{manage && <Button size="sm" variant="secondary" onClick={() => setEdit({ g: 'status', c: null })}>+ 추가</Button>}</div>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>상태</th><th className={th}>설명</th><th className={`${th} text-right`}>업무</th><th className={th} /></tr></thead>
            <tbody>{C('status').map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className={td}><b>{c.name}</b>{(ST_SYS as readonly string[]).includes(c.name) && <Tag title="화면 계산에 쓰여 이름을 바꿀 수 없습니다">기본</Tag>}</td>
                <td className={`${td} text-ink3`}>{c.note || '-'}</td><td className={`${td} text-right`}>{statusUse(c, snap.tasks).length}</td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={() => setEdit({ g: 'status', c })}>수정</Button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      </div>
      <section className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <b className="text-[13px]">단계</b>
          <select className="rounded border border-border bg-panel px-2 py-1 text-[12px]" value={b} onChange={(e) => { setBiz(e.target.value); setSel(''); }} aria-label="사업구분">{bizs.map((x) => <option key={x}>{x}</option>)}</select>
          <span className="text-[11px] text-ink3">사업구분마다 업무 목록 단계가 다릅니다</span><span className="flex-1" />
          {manage && <Button size="sm" variant="secondary" onClick={() => setEdit({ g: 'stage', c: null })}>+ 단계 추가</Button>}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b border-border bg-panel-alt"><tr><th className={th}>순서</th><th className={th}>단계명</th><th className={`${th} text-right`}>표준 세부 업무</th><th className={`${th} text-right`}>업무</th><th className={th}>쓰는 사업</th><th className={th} /></tr></thead>
            <tbody>{stages.length ? stages.map((c, i) => { const u = stageUse(c, snap.tasks, snap.projects); return (
              <tr key={c.id} onClick={() => setSel(c.id)} className={`cursor-pointer border-b border-border last:border-b-0 ${c.id === st?.id ? 'bg-blue-soft' : 'hover:bg-panel-alt'}`}>
                <td className={td}><span className="flex items-center gap-1"><span className="w-5">{i + 1}</span>{manage && <><Button size="sm" variant="secondary" disabled={!i} onClick={btn(() => void mut.moveStage.mutateAsync({ id: c.id, dir: -1 }))}>위로</Button><Button size="sm" variant="secondary" disabled={i >= stages.length - 1} onClick={btn(() => void mut.moveStage.mutateAsync({ id: c.id, dir: 1 }))}>아래로</Button></>}</span></td>
                <td className={td}><b>{c.name}</b></td>
                <td className={`${td} text-right`}>{stdOf(snap.stdTasks, c.biz, c.name).length} <span className="text-ink3">›</span></td>
                <td className={`${td} text-right`}>{u.length}</td>
                <td className={td}><Chips ids={[...new Set(u.map((t) => t.projectId))]} shortOf={shortOf} /></td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={btn(() => setEdit({ g: 'stage', c }))}>수정</Button>}</td>
              </tr>
            ); }) : <tr><td colSpan={6}><EmptyHint title="이 사업구분에 단계가 없습니다" /></td></tr>}</tbody>
          </table>
        </div>
      </section>
      {st && (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <b className="text-[13px]">세부 업무</b><span className="text-[12px] text-ink3">{st.biz} › <b className="text-ink">{st.name}</b> · 새 사업에 쓰는 표준 목록 · 고쳐도 진행 중인 사업 업무 목록은 그대로</span>
            <span className="flex-1" />{manage && <Button size="sm" onClick={() => setStd('new')}>+ 세부 업무 추가</Button>}
          </div>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>순서</th><th className={th}>번호</th><th className={th}>세부 업무</th><th className={th}>산출물</th><th className={`${th} text-right`}>착수 후</th><th className={`${th} text-right`}>기간</th><th className={th}>M/S</th><th className={th}>같은 업무 쓰는 사업</th><th className={th} /></tr></thead>
            <tbody>{sts.length ? sts.map((t, i) => (
              <tr key={t.id} className="border-b border-border last:border-b-0">
                <td className={td}><span className="flex items-center gap-1"><span className="w-5">{i + 1}</span>{manage && <><Button size="sm" variant="secondary" disabled={!i} onClick={() => void mut.moveStd.mutateAsync({ id: t.id, dir: -1 })}>위로</Button><Button size="sm" variant="secondary" disabled={i >= sts.length - 1} onClick={() => void mut.moveStd.mutateAsync({ id: t.id, dir: 1 })}>아래로</Button></>}</span></td>
                <td className={`${td} tabular-nums`}>{t.code || '-'}</td><td className={td}><b>{t.name}</b></td><td className={`${td} text-ink3`}>{t.output || '-'}</td>
                <td className={`${td} text-right`}>{t.off}일</td><td className={`${td} text-right`}>{t.dur}일</td><td className={td}>{t.milestone && <b className="text-amber">◆</b>}</td>
                <td className={td}><Chips ids={[...new Set(stdUse(t, snap.tasks, snap.projects).map((x) => x.projectId))]} shortOf={shortOf} /></td>
                <td className={td}>{manage && <Button size="sm" variant="secondary" onClick={() => setStd(t)}>수정</Button>}</td>
              </tr>
            )) : <tr><td colSpan={9}><EmptyHint title="이 단계에 표준 세부 업무가 없습니다" hint={manage ? '[+ 세부 업무 추가]로 넣거나, 사업 › 단계 › 업무 탭에서 사업 업무를 [표준에 추가]하세요.' : undefined} /></td></tr>}</tbody>
          </table>
          {sts.length > 0 && <p className="px-4 py-2 text-[11px] text-ink3">단계 기간: 착수 후 {Math.min(...sts.map((t) => t.off))}일 ~ {Math.max(...sts.map((t) => t.off + t.dur))}일 · M/S {sts.filter((t) => t.milestone).length}개</p>}
        </section>
      )}
      {edit && <CodeFormModal g={edit.g} c={edit.c} defBiz={b} d={d} onClose={() => setEdit(null)}
        onSave={async (c) => { const n = await mut.saveCode.mutateAsync({ c, base: edit.c ? [pmBase('codes', edit.c.id, edit.c)] : [] }); say(edit.c ? `${c.name} 수정${n ? ` — ${n}곳 함께 바뀜` : ''}` : `'${c.name}' 추가`); setEdit(null); }}
        onRemove={async (c) => { await mut.removeCode.mutateAsync(c.id); say(`'${c.name}' 삭제됨`); setEdit(null); }} />}
      {std && st && <StdFormModal t={std === 'new' ? null : std} biz={st.biz} stage={st.name} d={d} onClose={() => setStd(null)}
        onSave={async (x) => { await mut.saveStd.mutateAsync({ x, base: std === 'new' ? [] : [pmBase('stdTasks', std.id, std)] }); say(std === 'new' ? `세부 업무 '${x.name}' 추가` : '세부 업무 수정'); setStd(null); }}
        onRemove={async (x) => { await mut.removeStd.mutateAsync(x.id); say('세부 업무 삭제됨'); setStd(null); }} />}
    </div>
  );
}

function CodeFormModal({ g, c, defBiz, d, onSave, onRemove, onClose }: { g: PmCode['group']; c: PmCode | null; defBiz: string; d: PmDerived; onSave: (c: PmCode) => Promise<void>; onRemove: (c: PmCode) => Promise<void>; onClose: () => void }) {
  const { snap } = d;
  const isNew = !c;
  const T = { biz: '사업구분', stage: '단계', status: '업무 상태' }[g];
  const used = !c ? 0 : g === 'biz' ? bizUse(c, snap.projects).length : g === 'stage' ? stageUse(c, snap.tasks, snap.projects).length : statusUse(c, snap.tasks).length;
  const lock = g === 'status' && !!c && (ST_SYS as readonly string[]).includes(c.name);
  const [v, setV] = useState<PmCode>(() => c ?? { id: `${g[0]}${Date.now().toString(36)}`, group: g, name: '', track: '', biz: g === 'stage' ? defBiz : '', ord: 0, note: '', auto: false });
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof PmCode>(k: K, x: PmCode[K]) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    if (!v.name.trim()) { setErr([`${T} 이름을 입력해 주세요`, 'name']); return; }
    const pool = snap.codes.filter((x) => x.group === g && (g !== 'stage' || x.biz === v.biz));
    if (pool.some((x) => x.id !== v.id && x.name === v.name.trim())) { setErr(['같은 이름이 이미 있습니다', 'name']); return; }
    if (g === 'status' && c && used && v.name !== c.name) { setErr(['업무에서 쓰는 상태는 이름을 바꿀 수 없습니다 (업무 상태를 먼저 바꾸세요)', 'name']); return; }
    await onSave({ ...v, name: v.name.trim() });
  };
  const del = async () => {
    if (!c) return;
    const why = codeDelBlock(c, snap);
    if (why) { setErr([why, '']); return; }
    if (!confirm(`${T} '${c.name}'을(를) 지울까요?`)) return;
    try { await onRemove(c); } catch (e) { setErr([(e as Error).message, '']); }
  };
  return (
    <Modal open onClose={onClose} width={560} title={isNew ? `${T} 추가` : `${T} 수정 — ${c.name}`} footer={<Foot err={err?.[0] ?? ''} onDel={isNew ? undefined : () => void del()} onClose={onClose} onSave={() => void save()} />}>
      {!isNew && used > 0 && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">{g === 'biz' ? `사업 ${used}개에서 씁니다. 이름을 바꾸면 사업과 단계의 사업구분도 함께 바뀝니다.` : g === 'stage' ? `업무 ${used}건에서 씁니다. 이름을 바꾸면 그 업무들의 단계도 함께 바뀌고 변경 이력에 남습니다.` : `업무 ${used}건에서 씁니다.`}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {g === 'biz' && <><F label="트랙"><input className={inp} value={v.track} placeholder="예: 가, 나, 다" onChange={(e) => set('track', e.target.value)} /></F><F label="사업구분" req bad={err?.[1] === 'name'}><input className={inp} value={v.name} placeholder="예: 정부일반형" onChange={(e) => set('name', e.target.value)} /></F><F label="메모" full><input className={inp} value={v.note} onChange={(e) => set('note', e.target.value)} /></F></>}
        {g === 'stage' && <><F label="사업구분" req><select className={inp} value={v.biz} disabled={!isNew} onChange={(e) => set('biz', e.target.value)}>{snap.codes.filter((x) => x.group === 'biz').map((x) => <option key={x.id}>{x.name}</option>)}</select></F><F label="단계명" req bad={err?.[1] === 'name'}><input className={inp} value={v.name} placeholder="예: 설계" onChange={(e) => set('name', e.target.value)} /></F></>}
        {g === 'status' && <><F label="상태" req bad={err?.[1] === 'name'} help={lock ? '화면 계산(진행률 · 지연)에 쓰이는 기본 상태라 이름을 바꿀 수 없습니다' : undefined}><input className={inp} value={v.name} readOnly={lock} onChange={(e) => set('name', e.target.value)} /></F><F label="설명" full><input className={inp} value={v.note} onChange={(e) => set('note', e.target.value)} /></F></>}
      </div>
    </Modal>
  );
}

function StdFormModal({ t, biz, stage, d, onSave, onRemove, onClose }: { t: PmStdTask | null; biz: string; stage: string; d: PmDerived; onSave: (x: PmStdTask) => Promise<void>; onRemove: (x: PmStdTask) => Promise<void>; onClose: () => void }) {
  const { snap } = d;
  const isNew = !t;
  const lock = usePmPartialLock() && isNew;
  const used = t ? stdUse(t, snap.tasks, snap.projects) : [];
  const [v, setV] = useState<PmStdTask & { offS: string; durS: string }>(() => ({ ...(t ?? { id: '', biz, stage, ord: 0, code: '', name: '', output: '', off: 0, dur: 5, milestone: false, from: '' }), offS: String(t?.off ?? 0), durS: String(t?.dur ?? 5) }));
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((p) => ({ ...p, [k]: x }));
  const stageOpts = stagesOfBiz(snap.codes, biz).map((c) => c.name);
  const save = async () => {
    if (!v.name.trim()) { setErr(['세부 업무 이름을 입력해 주세요', 'name']); return; }
    if (v.offS.trim() === '' || Number.isNaN(+v.offS)) { setErr(['착수 후 시작(일)을 숫자로 넣어 주세요', 'off']); return; }
    if (!(+v.durS >= 1)) { setErr(['기간은 1일 이상으로 넣어 주세요', 'dur']); return; }
    if (stdOf(snap.stdTasks, biz, v.stage).some((x) => x.id !== v.id && x.name === v.name.trim())) { setErr(['이 단계에 같은 이름의 세부 업무가 있습니다', 'name']); return; }
    const { offS, durS, ...x } = v;
    await onSave({ ...x, name: x.name.trim(), off: Math.round(+offS), dur: Math.round(+durS) });
  };
  const bad = (f: string) => err?.[1] === f;
  return (
    <Modal open onClose={onClose} width={640} title={isNew ? `세부 업무 추가 — ${biz}` : `세부 업무 수정 — ${t.name}`}
      footer={<Foot lock={lock} err={err?.[0] ?? ''} onDel={isNew ? undefined : () => { if (t && confirm(`세부 업무 '${t.name}'을(를) 표준 목록에서 지울까요? (진행 중인 사업 업무 목록은 그대로)`)) void onRemove(t); }} onClose={onClose} onSave={() => void save()} />}>
      <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">새 사업을 등록할 때 쓰는 표준 목록입니다. 여기서 고쳐도 이미 진행 중인 사업의 업무 목록은 바뀌지 않습니다.{used.length ? ` (같은 이름 업무가 사업 ${new Set(used.map((x) => x.projectId)).size}개 업무 목록에 있음)` : ''}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="단계" req><select className={inp} value={v.stage} onChange={(e) => set('stage', e.target.value)}>{[...new Set([...stageOpts, v.stage])].map((x) => <option key={x}>{x}</option>)}</select></F>
        <F label="번호"><input className={inp} value={v.code} placeholder="예: 2.1.3" onChange={(e) => set('code', e.target.value)} /></F>
        <F label="세부 업무" req full bad={bad('name')}><input className={inp} value={v.name} placeholder="예: 화면 설계서 작성" onChange={(e) => set('name', e.target.value)} /></F>
        <F label="산출물" full><input className={inp} value={v.output} placeholder="예: 화면설계서(SF-TD3)" onChange={(e) => set('output', e.target.value)} /></F>
        <F label="착수 후 시작 (일)" req bad={bad('off')} help="협약 시작일로부터 며칠 뒤 시작하는지 (협약 이전 업무는 음수)"><input type="number" className={inp} value={v.offS} onChange={(e) => set('offS', e.target.value)} /></F>
        <F label="기간 (일)" req bad={bad('dur')}><input type="number" min={1} className={inp} value={v.durS} onChange={(e) => set('durS', e.target.value)} /></F>
        <label className="flex items-center gap-2 text-[12px] text-ink2"><input type="checkbox" checked={v.milestone} onChange={(e) => set('milestone', e.target.checked)} />마일스톤(M/S)</label>
      </div>
    </Modal>
  );
}
