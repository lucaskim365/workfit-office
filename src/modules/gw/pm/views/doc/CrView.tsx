import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { monthDay, shortName, todayStr } from '@/domain/pm/rules';
import { crConflict, crFlow, crList, crTaskPreset, type CrSt } from '@/domain/pm/cr';
import { nextMilestone } from '@/domain/pm/my';
import { dday } from '@/domain/pm/site';
import type { PmChangeRequest } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, usePmSiteMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, ProjectTag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { TaskFormModal } from '../wbs/TaskFormModal';
import { CrFormModal, CrReviewModal } from './CrModals';
import { pmBase } from '@/data/pm/pm.store';

/**
 * 점검 · 요구사항 · 산출물 › 요구사항(CR) (데모 siteCR 3616) — 변경 장부:
 * 위 '접수 → 검토 → 승인 · 반려' 흐름과 승인된 변경의 누적 영향(일정 · 비용), 아래는 날짜순 한 줄.
 * 주소 `?cr=CR-001` = 그 CR 창, `&review=1` = 검토 창 (🔔 알림 · 검색 · 내 업무 승인 대기에서).
 */
type Pop = { kind: 'form'; c: PmChangeRequest | null } | { kind: 'review'; c: PmChangeRequest } | { kind: 'task'; c: PmChangeRequest };
const inp = 'rounded border border-border bg-panel px-2 py-1 text-[12px] text-ink';
const ST_TONE = { 검토중: 'border-l-amber', 승인: 'border-l-ok', 반려: 'border-l-border-hi' } as const;

export function CrView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  const [site, setSite] = useState('all');
  const [st, setSt] = useState<CrSt>('all');
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  // 주소의 cr 값이 바뀔 때마다 한 번 열기 (같은 화면에서 알림을 다시 눌러도 열리게)
  const [seenP, setSeenP] = useState('');
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const projects = useMemo(() => (d ? [...d.snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))) : []), [d]);

  // 알림 · 검색 · 승인 대기에서 오면 그 CR 창 (한 번만) — 검토중이 아니면 검토 대신 수정 창 (데모 crReview)
  const crP = params.get('cr') ?? '';
  const keyP = crP ? `${crP}|${params.get('review') ?? ''}` : '';
  if (d && keyP !== seenP) {
    setSeenP(keyP);
    const c = crP ? d.snap.crs.find((x) => x.id === crP) : undefined;
    if (c) setPop(params.get('review') && c.status === '검토중' ? { kind: 'review', c } : { kind: 'form', c });
  }
  const close = () => {
    setPop(null);
    if (params.get('cr')) { const n = new URLSearchParams(params); n.delete('cr'); n.delete('review'); setParams(n, { replace: true }); }
  };

  const head = (
    <ScreenHead title="요구사항(CR)" desc="현장 요구사항을 접수해 검토하고, 승인하면 업무 목록에 업무로 추가합니다. 위 칸은 접수 → 검토 → 승인 · 반려 흐름과 승인된 변경이 사업에 준 일정 · 비용 영향입니다.">
      <Button onClick={() => setPop({ kind: 'form', c: null })} disabled={!projects.length}>+ CR 접수</Button>
    </ScreenHead>
  );
  if (!d) return <>{head}<EmptyHint title="요구사항을 불러오는 중입니다" /></>;
  const all = d.snap.crs;
  const f = crFlow(all);
  const list = crList(all, site, st);
  const today = d.today;
  const nextMsOf = (k: string) => nextMilestone(d.snap.tasks.filter((t) => t.projectId === k), d.liveMap);
  const defSite = site !== 'all' ? site : (projects.find((p) => d.snap.tasks.some((t) => t.projectId === p.id)) ?? projects[0])?.id ?? '';
  const step = (k: PmChangeRequest['status'], lb: string, sub: string, tone: string) => (
    <button type="button" onClick={() => setSt((x) => (x === k ? 'all' : k))} title={`${lb}만 보기 (다시 누르면 전체)`}
      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left ${st === k ? 'border-navy bg-blue-soft' : 'border-border bg-panel-alt hover:border-teal'}`}>
      <b className={`min-w-[30px] text-[24px] font-extrabold ${tone}`}>{f.n[k]}</b>
      <span className="leading-tight"><span className="block text-[12.5px] font-bold text-ink">{lb}</span><small className="text-[11px] text-ink3">{sub}</small></span>
    </button>
  );
  const say = (t: string, bad?: boolean) => setMsg({ t, bad });

  return (
    <div className="space-y-4">
      {head}
      {msg && <div className={`rounded-lg border px-3 py-2 text-[12px] font-bold ${msg.bad ? 'border-danger/30 bg-danger/10 text-danger' : 'border-ok/30 bg-ok/10 text-ok'}`}>{msg.t}</div>}

      {/* 흐름 + 누적 영향 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(320px,38%)]">
        <section className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
          <div className="flex-1">{step('검토중', '검토 중', '접수 후 결정 전', 'text-amber')}</div>
          <span className="text-[18px] text-ink3">→</span>
          <div className="grid flex-1 gap-2">
            {step('승인', '승인', f.noTask ? `업무 반영 전 ${f.noTask}건` : '업무 반영', 'text-ok')}
            {step('반려', '반려', '하지 않기로 함', 'text-ink3')}
          </div>
        </section>
        <section className="flex flex-col justify-center rounded-xl bg-navy px-5 py-4 text-white shadow-sm">
          <small className="text-[12px] font-bold opacity-85">승인된 변경이 사업에 준 영향</small>
          <div className="mt-2 flex gap-10">
            <div><b className={`text-[28px] font-extrabold ${f.days >= 7 ? 'text-amber-soft' : ''}`}>+{f.days}<em className="ml-0.5 text-[13px] not-italic">일</em></b><div className="text-[11.5px] opacity-85">일정</div></div>
            <div><b className="text-[28px] font-extrabold">+{f.cost.toLocaleString()}<em className="ml-0.5 text-[13px] not-italic">만원</em></b><div className="text-[11.5px] opacity-85">비용</div></div>
          </div>
        </section>
      </div>

      {/* 변경 장부 */}
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <h3 className="text-[13px] font-bold text-ink">변경 장부</h3>
          <span className="text-[11px] text-ink3">최근 접수 순</span>
          <span className="flex-1" />
          <label className="flex items-center gap-1.5 text-[12px] text-ink2">사업
            <select className={inp} value={site} onChange={(e) => setSite(e.target.value)} aria-label="사업">
              <option value="all">전체 사업</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)}</option>)}
            </select>
          </label>
          <select className={inp} value={st} onChange={(e) => setSt(e.target.value as CrSt)} aria-label="상태">
            {(['all', '검토중', '승인', '반려'] as const).map((x) => <option key={x} value={x}>{x === 'all' ? '전체 상태' : x}</option>)}
          </select>
        </div>
        {!all.length ? (
          <div className="px-6 py-10 text-center">
            <h3 className="text-[15px] font-bold text-ink">아직 접수된 변경 요청이 없어요</h3>
            <p className="mx-auto mt-2 max-w-[560px] text-[12px] leading-relaxed text-ink2">도입기업이 기능 추가 · 변경을 요청하면 여기에 접수하세요. 검토해서 승인하면 일정 · 비용 영향이 위에 쌓이고, 바로 업무 목록에 업무로 넣을 수 있어요.</p>
            <div className="my-4 flex items-center justify-center gap-2 text-[12px] text-ink2">
              <Step n={1}>요청 접수</Step><span className="text-ink3">→</span><Step n={2}>영향 검토</Step><span className="text-ink3">→</span><Step n={3}>승인 · 업무 반영</Step>
            </div>
            <Button onClick={() => setPop({ kind: 'form', c: null })}>+ 첫 CR 접수</Button>
          </div>
        ) : list.length ? list.map((c) => {
          const task = c.taskId ? d.taskMap.get(c.taskId) : undefined;
          return (
            <div key={c.id} role="button" tabIndex={0} onClick={() => setPop({ kind: 'form', c })} onKeyDown={(e) => { if (e.key === 'Enter') setPop({ kind: 'form', c }); }}
              className={`flex cursor-pointer items-center gap-4 border-b border-l-[3px] border-b-border px-4 py-2.5 text-[12px] last:border-b-0 hover:bg-panel-alt ${ST_TONE[c.status]}`}>
              <div className="w-[64px] flex-none leading-tight"><b className="block text-[13px] text-ink">{c.date ? monthDay(c.date) : '-'}</b><span className="text-[11px] text-ink3">{c.id}</span></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><ProjectTag>{shortOf(c.projectId)}</ProjectTag><b className="truncate text-[12.5px] text-ink">{c.title}</b></div>
                <div className="mt-0.5 truncate text-[11px] text-ink3">{c.cat || '분류 없음'} · 요청 {c.req || '-'}{c.comment ? ` · 의견: ${c.comment}` : ''}{c.taskId ? ` · 업무 ${task?.code ?? c.taskId.split('|')[1]}` : ''}</div>
              </div>
              <div className="flex w-[180px] flex-none flex-col items-end leading-tight text-ink2">
                <span className={c.days >= 7 ? 'font-bold text-danger' : ''}>일정 +{c.days}일</span>
                <span>비용 +{c.cost.toLocaleString()}만원</span>
              </div>
              <div className="flex w-[190px] flex-none items-center justify-end gap-2">
                <b className={c.status === '승인' ? 'text-ok' : c.status === '반려' ? 'text-ink3' : 'text-amber'}>{c.status}</b>
                {c.status === '검토중' ? <Button size="sm" onClick={(e) => { e.stopPropagation(); setPop({ kind: 'review', c }); }}>검토 · 승인</Button>
                  : c.status === '승인' && !c.taskId ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setPop({ kind: 'task', c }); }}>업무 추가</Button>
                    : task ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); modals.openTask(task.id); }}>업무 보기</Button> : null}
              </div>
            </div>
          );
        }) : <EmptyHint title="조건에 맞는 CR이 없습니다" hint="위쪽 사업 · 상태 고르기를 '전체'로 바꿔 보세요." />}
      </section>

      {pop?.kind === 'form' && (
        <CrFormModal c={pop.c} projects={projects} shortOf={shortOf} defSite={defSite} today={todayStr()}
          onSave={async (x) => {
            if (pop.c) { await smut.updateCr.mutateAsync({ id: pop.c.id, x, base: [pmBase('crs', pop.c.id, pop.c)] }); say(`${pop.c.id} 수정 완료`); return; }
            const c = await smut.addCr.mutateAsync(x);
            const m = nextMsOf(c.projectId);
            say(crConflict(m, c.days, today) ? `${c.id} 접수 완료 — 검토중 · ⚠ 반영 시 마일스톤 '${m!.name.slice(0, 20)}'(${dday(m!.end, today)}) 일정 충돌 위험` : `${c.id} 접수 완료 — 검토중`, crConflict(m, c.days, today));
          }}
          onRemove={async () => { if (pop.c) { await smut.removeCr.mutateAsync(pop.c.id); say(`${pop.c.id} 삭제됨`); } }}
          onClose={close} />
      )}
      {pop?.kind === 'review' && (
        <CrReviewModal c={pop.c} company={d.snap.projects.find((p) => p.id === pop.c.projectId)?.company ?? shortOf(pop.c.projectId)} nextMs={nextMsOf(pop.c.projectId)} today={today}
          onSave={async ({ decision, comment, makeTask }) => {
            const c = pop.c;
            try { await smut.reviewCr.mutateAsync({ id: c.id, decision, comment, base: [pmBase('crs', c.id, c)] }); /* 열 때 본 일정 · 비용 영향 그대로일 때만 (M2) */ } catch (e) { say((e as Error).message, true); close(); return; }
            say(`${c.id} ${decision} 처리`);
            close();
            if (decision === '승인' && makeTask) setPop({ kind: 'task', c: { ...c, status: '승인' } });
          }}
          onClose={close} />
      )}
      {pop?.kind === 'task' && (
        <TaskFormModal mode={{ kind: 'new', projectId: pop.c.projectId, stage: '', preset: crTaskPreset(pop.c, today) }} d={d} people={people} mut={mut} shortOf={shortOf}
          onClose={() => setPop(null)}
          onSaved={(id) => {
            const c = pop.c;
            setPop(null);
            if (id) { void smut.linkCrTask.mutateAsync({ id: c.id, taskId: id }); say(`${shortOf(c.projectId)} 업무 ${id.split('|')[1]} 추가 · ${c.id} 연결`); }
          }} />
      )}
      {modals.node}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full border border-border bg-panel-alt px-2.5 py-1"><b className="grid h-4 w-4 place-items-center rounded-full bg-navy text-[10px] text-white">{n}</b>{children}</span>;
}
