import { useMemo, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { SYSTEM } from '@/domain/pm/ticket';
import { ACT_PER, actFilter, activityAll, type ActFilter, type ActRow } from '@/domain/pm/actlog';
import { usePmDerived } from '@/features/pm/usePm';
import { usePmAccess } from '@/features/pm/usePmAccess';
import { usePmPeople } from '../../usePmPeople';
import { usePmShell } from '../../ui/PmShell';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { canTeamPdf } from '../plan/PlanView';

/**
 * 기준정보 › 활동 기록 (master/log, 데모 pActLog 8156) — 6-3.
 * 전체를 보는 사람: pm.manage(데모 '관리자') · 직책 · 직급에 팀장 · 사업 PM (데모 actCanAll). 나머지는 자기 기록만.
 * 최근 300건만 표, [보기] = 그 기록이 있는 곳(업무 · 티켓 창, 사업별 화면, 이슈 · CR · 회의록 · 액션 창, 주간 진행률).
 */
const card = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-top text-[12px]';
const sel = 'rounded border border-border bg-panel px-2 py-1 text-[12px]';
const MAX = 300;

export function ActLogView() {
  const people = usePmPeople();
  const { me } = people;
  const d = usePmDerived(people.nameOf);
  const access = usePmAccess();
  const shell = usePmShell();
  const [f, setF] = useState<ActFilter>({ per: '30', who: 'all', k: 'all', cat: 'all', q: '' });
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const rows = useMemo(() => {
    if (!d) return [] as ActRow[];
    const s = d.snap;
    return activityAll({
      tasks: s.tasks, liveMap: d.liveMap, plans: s.plans, gov: s.gov, planChecks: s.planChecks, govLinks: s.govLinks, agreements: s.agreements,
      baselines: s.baselines, issues: s.issues, reports: s.reports, projects: s.projects, logs: s.logs, tickets: s.tickets, subtasks: s.subtasks,
      weekChecks: s.weekChecks, docs: s.docs, crs: s.crs, meetings: s.meetings, actions: s.actions, today: d.today, nameOf: people.nameOf,
    });
  }, [d, people.nameOf]);

  if (!d) return <EmptyHint title="활동 기록을 불러오는 중입니다" />;
  const all = access.manage || canTeamPdf(me, people, d);
  const who = (id: string) => (id === SYSTEM ? '시스템' : id ? people.labelOf(id) : '');
  const L0 = all ? rows : rows.filter((x) => x.who === me);
  const cats = [...new Set(L0.map((x) => x.cat))];
  const whos = [...new Set(L0.map((x) => x.who).filter(Boolean))];
  const ks = [...new Set(L0.map((x) => x.k).filter(Boolean))].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
  const L = actFilter(L0, f, d.today, who, shortOf);
  const shown = L.slice(0, MAX);
  const set = <K extends keyof ActFilter>(k: K, v: ActFilter[K]) => setF((o) => ({ ...o, [k]: v }));

  return (
    <div className="space-y-3">
      <ScreenHead title="활동 기록" desc={`${all ? '모든 사람의' : '내'} 기록을 최근 순으로 모아 봅니다 — 업무 목록 변경 · 티켓 처리 · 점검 결과 · 완료 체크 · 협약변경 · 주간 특이사항 · 이슈 · CR · 회의록 · 액션 아이템 · 세부 작업 · 산출물`} />
      {!all && <p className="rounded-lg border border-blue/30 bg-blue-soft px-3 py-2 text-[12px] text-ink">전체 기록은 관리자 · 팀장 · PM만 봅니다. 지금은 <b>{people.labelOf(me)}</b>님 기록만 보입니다.</p>}
      <section className={card}>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5">
          <select className={sel} value={f.per} onChange={(e) => set('per', e.target.value as ActFilter['per'])} aria-label="기간">{ACT_PER.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {all && <select className={sel} value={f.who} onChange={(e) => set('who', e.target.value)} aria-label="사람"><option value="all">모든 사람</option>{whos.map((n) => <option key={n} value={n}>{who(n)}</option>)}</select>}
          <select className={sel} value={f.k} onChange={(e) => set('k', e.target.value)} aria-label="사업"><option value="all">모든 사업</option>{ks.map((k) => <option key={k} value={k}>{shortOf(k)}</option>)}</select>
          <select className={sel} value={f.cat} onChange={(e) => set('cat', e.target.value)} aria-label="종류"><option value="all">모든 종류</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input className={`${sel} w-[190px]`} placeholder="내용 · 사람 검색" value={f.q} onChange={(e) => set('q', e.target.value)} />
          <span className="flex-1" />
          <span className="text-[11px] text-ink3">{L.length.toLocaleString()}건{L.length > MAX ? ` · 최근 ${MAX}건만 표시` : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={`${th} w-[90px]`}>날짜</th><th className={`${th} w-[110px]`}>누가</th><th className={`${th} w-[110px]`}>종류</th><th className={`${th} w-[90px]`}>사업</th><th className={th}>내용</th><th className={`${th} w-[60px]`} /></tr></thead>
            <tbody>
              {shown.length ? shown.map((x, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{x.d}</td>
                  <td className={`${td} whitespace-nowrap`}>{who(x.who) || <span className="text-ink3">-</span>}</td>
                  <td className={td}><Tag>{x.cat}</Tag></td>
                  <td className={td}>{x.k ? <ProjectTag>{shortOf(x.k)}</ProjectTag> : <span className="text-ink3">-</span>}</td>
                  <td className={td}>{x.txt}</td>
                  <td className={td}>{x.go && shell && <Button size="sm" variant="secondary" onClick={() => shell.go(x.go!)}>보기</Button>}</td>
                </tr>
              )) : <tr><td colSpan={6}><EmptyHint title="조건에 맞는 기록이 없습니다" /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
