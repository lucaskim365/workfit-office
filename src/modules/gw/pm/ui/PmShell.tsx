import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { alertSeen, myAlerts, type AlertGo, type PmAlert } from '@/domain/pm/alerts';
import { gsFind, type SearchHit } from '@/domain/pm/search';
import { planRecentIdx, planUpdDates } from '@/domain/pm/plan';
import type { PmProject } from '@/domain/pm/schema';
import { usePmDerived, usePmSiteMutations, usePmSites } from '@/features/pm/usePm';
import { planCtxOf } from '@/features/pm/usePmPlan';
import { PM_MENUS } from '../menu';
import type { usePmPeople } from '../usePmPeople';

/**
 * PM 화면 공통 — 위쪽 검색칸(Ctrl+K) · 🔔 내 알림 · ☆ 즐겨찾기 (데모 gsearch · bellPanel · favBox · favStar).
 * 화면 머리의 ☆ 는 PmShellContext 로 지금 화면을 알고 켜고 끈다.
 */
type People = ReturnType<typeof usePmPeople>;
export interface Fav { v: string; k: string }

interface Shell {
  /** 지금 화면 (사업별 화면이면 고른 사업 k) */
  cur: Fav;
  favs: readonly Fav[];
  toggleFav: () => void;
  go: (g: AlertGo) => void;
}
const Ctx = createContext<Shell | null>(null);
export const PmShellProvider = ({ value, children }: { value: Shell; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const usePmShell = () => useContext(Ctx);
const favSame = (a: Fav, b: Fav) => a.v === b.v && (a.k || '') === (b.k || '');

/** 즐겨찾기 이름 — 사업이면 사업 짧은 이름 · '사업', 아니면 화면(보기) 이름 · 메뉴 (favName) */
export function favName(f: Fav, projects: readonly PmProject[]): { n: string; sub: string } | null {
  if (f.k) { const p = projects.find((x) => x.id === f.k); return p ? { n: shortName(p, projects), sub: '사업' } : null; }
  for (const m of PM_MENUS) for (const s of m.screens) {
    if (s.id === f.v && !s.views?.length) return { n: s.label, sub: m.label };
    const vw = s.views?.find((x) => x.id === f.v);
    if (vw) return { n: s.views!.length > 1 ? `${s.label} · ${vw.label}` : s.label, sub: m.label };
    if (s.id === f.v) return { n: s.label, sub: m.label };
  }
  return null;
}

/** 화면 제목 옆 ☆ (favStar) */
export function FavStar() {
  const sh = usePmShell();
  if (!sh) return null;
  const on = sh.favs.some((f) => favSame(f, sh.cur));
  const what = sh.cur.k ? '이 사업' : '이 화면';
  return (
    <button type="button" onClick={sh.toggleFav} aria-pressed={on}
      title={on ? `${what}을 즐겨찾기에서 빼기` : `${what}을 왼쪽 메뉴 즐겨찾기에 추가`}
      className={`text-[16px] leading-none ${on ? 'text-amber' : 'text-ink3 hover:text-amber'}`}>{on ? '★' : '☆'}</button>
  );
}

/** 왼쪽 메뉴 맨 위 즐겨찾기 (favBox) */
export function FavBox({ projects, onRemove }: { projects: readonly PmProject[]; onRemove: (f: Fav) => void }) {
  const sh = usePmShell();
  if (!sh) return null;
  const L = sh.favs.map((f) => ({ f, nm: favName(f, projects) })).filter((x) => x.nm);
  return (
    <div className="mb-3 rounded-xl border border-border bg-panel p-2 shadow-sm">
      <div className="px-1.5 pb-1 text-[11px] font-bold text-ink3">★ 즐겨찾기</div>
      {L.map(({ f, nm }) => {
        const on = favSame(f, sh.cur);
        return (
          <div key={`${f.v}|${f.k}`} className={`group flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] ${on ? 'bg-teal-soft text-navy' : 'text-ink2 hover:bg-panel-alt'}`}>
            <button type="button" className="min-w-0 flex-1 truncate text-left font-bold" title={`${nm!.sub} › ${nm!.n}`}
              onClick={() => sh.go({ kind: 'view', v: f.v, ...(f.k ? { params: { k: f.k } } : {}) })}>
              {nm!.n} <span className="text-[10.5px] font-normal text-ink3">{nm!.sub}</span>
            </button>
            <button type="button" onClick={() => onRemove(f)} title="즐겨찾기에서 빼기" className="text-[11px] text-ink3 hover:text-danger">빼기</button>
          </div>
        );
      })}
      {!L.length && <div className="px-1.5 py-1 text-[11px] text-ink3">화면 제목 옆 ☆을 누르면 여기에 추가</div>}
    </div>
  );
}

/** 위쪽 검색칸 — 글자를 넣으면 0.15초 뒤 찾고, ↑↓ · Enter · Esc, 어디서든 Ctrl+K (gsShow) */
export function PmSearch({ people }: { people: People }) {
  const sh = usePmShell();
  const d = usePmDerived(people.nameOf);
  const [q, setQ] = useState('');
  const [deb, setDeb] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setDeb(q), 150); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const key = (ev: KeyboardEvent) => { if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); inp.current?.focus(); inp.current?.select(); } };
    const down = (ev: MouseEvent) => { if (box.current && !box.current.contains(ev.target as Node)) setOpen(false); };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, []);
  const screens = useMemo(() => PM_MENUS.flatMap((m) => m.screens.filter((s) => !s.hidden).flatMap((s) =>
    [[s.id, s.label, m.label] as const, ...(s.views ?? []).filter((x) => x.id !== s.id).map((x) => [x.id, x.label, m.label] as const)])), []);
  const list: SearchHit[] = useMemo(() => {
    if (!d || !deb.trim()) return [];
    const shortOf = (id: string) => { const p = d.snap.projects.find((x) => x.id === id); return p ? shortName(p, d.snap.projects) : id; };
    return gsFind(deb, { today: d.today, screens, projects: d.snap.projects, tasks: d.snap.tasks, liveMap: d.liveMap, tickets: d.snap.tickets,
      issues: d.snap.issues, actions: d.snap.actions, crs: d.snap.crs, people: people.people, shortOf, nameOf: people.nameOf });
  }, [d, deb, screens, people.people, people.nameOf]);
  useEffect(() => setSel(0), [deb]);
  const close = () => { setOpen(false); setQ(''); setDeb(''); inp.current?.blur(); };
  const pick = (x: SearchHit | undefined) => { if (!x || !sh) return; close(); sh.go(x.go); };
  let last = '';
  return (
    <div ref={box} className="relative w-full max-w-[460px]">
      <input ref={inp} value={q} autoComplete="off" aria-label="전체 검색"
        placeholder="검색 — 하는 일 · 화면 · 사업 · 업무 · 티켓 · 이슈 · 사람  (Ctrl+K)"
        className="w-full rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink3"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => q.trim() && setOpen(true)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape') { close(); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.length) setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length); return; }
          if (e.key === 'Enter') {
            e.preventDefault();
            // 아직 안 찾았으면 지금 찾은 목록으로
            if (deb !== q) { setDeb(q); return; }
            pick(list[sel]);
          }
        }} />
      {open && q.trim() && deb === q && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[460px] overflow-auto rounded-xl border border-border bg-panel py-1 shadow-lg">
          {list.map((x, i) => {
            const h = x.grp !== last ? <div className="px-3 pb-0.5 pt-2 text-[10.5px] font-bold text-ink3">{x.grp}</div> : null;
            last = x.grp;
            return (
              <div key={i}>
                {h}
                <button type="button" onMouseEnter={() => setSel(i)} onClick={() => pick(x)}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[12.5px] ${i === sel ? 'bg-teal-soft' : ''}`}>
                  <span className="min-w-0 flex-1 truncate font-bold text-ink">{x.label}</span>
                  <span className="max-w-[45%] truncate text-[11px] text-ink3">{x.sub}</span>
                </button>
              </div>
            );
          })}
          {!list.length && <div className="px-3 py-3 text-[12px] text-ink3">'{q}'에 맞는 것이 없습니다</div>}
        </div>
      )}
    </div>
  );
}

const DOT = { bad: 'bg-danger', ok: 'bg-ok', warn: 'bg-amber' } as const;

/** 🔔 내 알림 (bell · bellPanel) */
export function PmBell({ people }: { people: People }) {
  const sh = usePmShell();
  const { me } = people;
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const smut = usePmSiteMutations(me);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (ev: MouseEvent) => { if (box.current && !box.current.contains(ev.target as Node)) { setOpen(false); setAll(false); } };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, []);
  const alerts: PmAlert[] = useMemo(() => {
    if (!d || !S || !me) return [];
    const projects = d.snap.projects;
    const shortOf = (id: string) => { const p = projects.find((x) => x.id === id); return p ? shortName(p, projects) : id; };
    const pmOf = (p: PmProject) => [...new Set([p.pmUserId, people.idByName(p.pmName)].filter(Boolean))];
    const sitePm = (id: string) => { const p = projects.find((x) => x.id === id); return p ? pmOf(p)[0] ?? '' : ''; };
    // 업무계획 계산은 carryFrom 을 정하지 않는 쪽으로 (업무계획 · 팀 현황 · 내 업무를 처음 열 때 정함 — 3-6)
    const C = planCtxOf(d);
    return myAlerts(me, {
      tasks: d.snap.tasks, liveMap: d.liveMap, projects, today: d.today,
      logs: d.snap.logs, checks: d.snap.weekChecks, tickets: d.snap.tickets, baseDate: d.snap.baseDate, sitePm,
      more: planUpdDates(C), planRecent: planRecentIdx(C),
      subtasks: d.snap.subtasks, actions: d.snap.actions, issues: d.snap.issues,
      msOk: new Map(d.snap.msOk.map((x) => [x.id, x])), updReq: d.snap.updReq, crs: d.snap.crs,
      sites: S.all.map((r) => r.c), pmOf, shortOf, nameOf: people.nameOf,
    });
  }, [d, S, me, people.idByName, people.nameOf]);
  const seen = d?.snap.seen.find((r) => r.id === me)?.items;
  const nSeen = alerts.filter((a) => alertSeen(seen, a)).length;
  const n = alerts.length - nSeen;
  const list = all ? alerts : alerts.filter((a) => !alertSeen(seen, a));
  return (
    <div ref={box} className="relative">
      <Button size="sm" variant={n ? 'primary' : 'secondary'} onClick={() => { setOpen((o) => !o); setAll(false); }} title="내 알림 — 지연 · 배정 · 승인 대기 · 기한 등">
        알림 {n}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-[440px] rounded-xl border border-border bg-panel shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <b className="text-[13px] text-ink">알림 {n}</b>
            <span className="flex-1" />
            <span className="text-[11px] text-ink3">확인하면 목록에서 빠집니다</span>
          </div>
          <div className="max-h-[360px] overflow-auto">
            {list.map((a) => {
              const on = alertSeen(seen, a);
              return (
                <div key={a.txt} className={`flex items-start gap-2 border-b border-border px-3.5 py-2 text-[12px] last:border-b-0 ${on ? 'opacity-50' : ''}`}>
                  <span className={`mt-1.5 h-[7px] w-[7px] flex-none rounded-full ${DOT[a.lv]}`} />
                  {a.go ? (
                    <button type="button" className="min-w-0 flex-1 text-left text-ink hover:underline" title="눌러서 보기"
                      onClick={() => { setOpen(false); sh?.go(a.go!); }}>{a.txt}</button>
                  ) : <span className="min-w-0 flex-1 text-ink">{a.txt}</span>}
                  <Button size="sm" variant="secondary" onClick={() => smut.setSeen.mutate({ txt: a.txt, on: !on })}>{on ? '되돌리기' : '확인'}</Button>
                </div>
              );
            })}
            {!list.length && <div className="px-3.5 py-5 text-center text-[12px] text-ink3">새 알림이 없습니다</div>}
          </div>
          {nSeen > 0 && (
            <div className="border-t border-border px-3.5 py-2 text-right">
              <Button size="sm" variant="secondary" onClick={() => setAll((x) => !x)}>{all ? '확인한 알림 숨기기' : `확인한 알림 ${nSeen}개 보기`}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
