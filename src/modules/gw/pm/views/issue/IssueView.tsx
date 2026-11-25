import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { shortName } from '@/domain/pm/rules';
import { ISSUE_TILES, issueAge, issueBoard, issueOpen, type IssueLane } from '@/domain/pm/issue';
import type { PmIssue } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { Avatar, EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';

/**
 * 이슈 · 회의 · 보고 › 이슈 (데모 pRisk 4188) — 처리 흐름 보드: 열림 → 대응 중 → 해결. 위 분류 칸은 눌러서 거르기.
 * 주소 `?issue=I-001` = 그 이슈 창 (🔔 · 검색 · 내 업무에서), `?issue=new` = 등록 창 (검색 '이슈 등록'). `&k=` = 사업 거르기.
 */
const inp = 'rounded border border-border bg-panel px-2 py-1 text-[12px] text-ink';
const LANES: ReadonlyArray<readonly [IssueLane, string, string, string]> = [
  ['열림', '들어온 이슈', '아직 손대지 않음', 'border-t-amber'],
  ['대응중', '대응 중', '담당자가 처리하는 중', 'border-t-blue'],
  ['해결', '해결', '최근 해결된 것', 'border-t-ok'],
];
const LANE_EMPTY: Record<IssueLane, string> = { 열림: '새 이슈가 없어요', 대응중: '처리 중인 이슈가 없어요', 해결: '아직 해결된 이슈가 없어요' };
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function IssueView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [params, setParams] = useSearchParams();
  const [cat, setCat] = useState('all');
  const [allDone, setAllDone] = useState(false);
  const [say, setSay] = useState('');
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const projects = useMemo(() => (d ? [...d.snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))) : []), [d]);
  const site = params.get('k') ?? 'all';

  // 주소의 issue 값이 바뀔 때마다 그 이슈 창 (같은 화면에서 알림을 다시 눌러도) — 열고 나면 주소에서 지움
  const issP = params.get('issue') ?? '';
  const ready = !!d;
  useEffect(() => {
    if (!ready || !issP) return;
    modals.openIssue(issP === 'new' ? null : issP);
    const n = new URLSearchParams(params); n.delete('issue'); setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issP, ready]);

  const head = (
    <ScreenHead title="이슈" desc="현장 · 개발 이슈를 등록하고 해결까지 추적합니다. 카드를 누르면 내용 · 상태를 고치고, [윗선 보고]를 누르면 긴급으로 바뀌어 PM · 담당자에게 알림이 갑니다.">
      <Button onClick={() => modals.openIssue(null, site !== 'all' ? site : '')} disabled={!projects.length}>+ 이슈 등록</Button>
    </ScreenHead>
  );
  if (!d) return <>{head}<EmptyHint title="이슈를 불러오는 중입니다" /></>;
  const B = issueBoard(d.snap.issues, site, cat, d.today);
  const pickSite = (k: string) => { const n = new URLSearchParams(params); if (k === 'all') n.delete('k'); else n.set('k', k); setParams(n); };
  const esc = async (i: PmIssue) => {
    await mut.escalateIssue.mutateAsync(i.id);
    setSay(`${i.id} 긴급 보고 — PM · 담당 ${people.labelOf(i.ownerId) || '미정'}에게 알림`);
  };
  const tile = (c: string, n: number) => (
    <button key={c} type="button" onClick={() => setCat((x) => (x === c && c !== 'all' ? 'all' : c))} title={c === 'all' ? '전체 미해결' : `${c}만 보기 (다시 누르면 전체)`}
      className={`min-w-[150px] flex-1 rounded-xl border px-4 py-2.5 text-left ${cat === c ? 'border-navy bg-blue-soft' : 'border-border bg-panel hover:border-teal'}`}>
      <small className="block text-[11.5px] text-ink3">{c === 'all' ? '전체 미해결' : c}</small>
      <b className="text-[22px] font-extrabold text-ink">{n}<em className="ml-0.5 text-[12px] not-italic text-ink3">건</em></b>
    </button>
  );
  const card = (i: PmIssue) => {
    const t = i.taskId ? d.taskMap.get(i.taskId) : undefined;
    const age = issueAge(i, d.today);
    const sv = i.sev === '긴급' ? 'bad' : i.sev === '높음' ? 'warn' : 'plain';
    return (
      <div key={i.id} role="button" tabIndex={0} onClick={() => modals.openIssue(i.id)} onKeyDown={(e) => { if (e.key === 'Enter') modals.openIssue(i.id); }}
        className={`cursor-pointer rounded-lg border bg-panel px-3 py-2.5 text-[12px] shadow-sm hover:border-teal ${sv === 'bad' ? 'border-danger/40' : sv === 'warn' ? 'border-amber/40' : 'border-border'}`}>
        <div className="flex items-center gap-1.5">
          <ProjectTag>{shortOf(i.projectId)}</ProjectTag><Tag tone={sv}>{i.sev || '보통'}</Tag>
          {i.esc && <Tag tone="bad" title="윗선에 보고됨 (에스컬레이션)">보고됨</Tag>}
          <span className="flex-1" /><span className="text-[11px] text-ink3">{i.id}</span>
        </div>
        <div className="mt-1.5 font-bold text-ink">{i.title}</div>
        {t && <div className="mt-0.5 truncate text-[11px] text-ink3">↳ {t.code} {trunc(t.name, 26)}</div>}
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink2">
          <span>{i.cat || '분류 없음'}</span><span className="flex-1" />
          {issueOpen(i) ? <span className={age >= 7 ? 'font-bold text-danger' : 'text-ink3'}>{age ? `${age}일째` : '오늘'}</span> : <span className="font-bold text-ok">해결</span>}
          {i.ownerId ? <span className="flex items-center gap-1" title={people.labelOf(i.ownerId)}><Avatar name={people.nameOf(i.ownerId) || '?'} />{people.nameOf(i.ownerId)}</span> : <Tag tone="warn">담당 없음</Tag>}
        </div>
        {issueOpen(i) && !i.esc && (
          <div className="mt-2 text-right">
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void esc(i); }} title="긴급으로 바꾸고 PM · 담당자에게 알림 (에스컬레이션)">윗선 보고</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {head}
      {say && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">{say}</div>}
      <div className="flex flex-wrap gap-2">
        {tile('all', B.tile.all)}
        {ISSUE_TILES.map((c) => tile(c, B.tile[c]))}
      </div>
      {!d.snap.issues.length ? (
        <section className="rounded-xl border border-border bg-panel px-6 py-10 text-center shadow-sm">
          <h3 className="text-[15px] font-bold text-ink">아직 등록된 이슈가 없어요</h3>
          <p className="mx-auto mt-2 max-w-[560px] text-[12px] leading-relaxed text-ink2">현장이나 개발에서 막히는 일이 생기면 바로 올려 두세요. 담당자 · 연관 업무를 붙이면 해결까지 여기서 따라갑니다.</p>
          <div className="my-4 flex items-center justify-center gap-2 text-[12px] text-ink2">
            <Step n={1}>이슈 등록</Step><span className="text-ink3">→</span><Step n={2}>담당자가 대응</Step><span className="text-ink3">→</span><Step n={3}>해결 · 기록</Step>
          </div>
          <Button onClick={() => modals.openIssue(null)}>+ 첫 이슈 등록</Button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-ink2">사업
              <select className={inp} value={site} onChange={(e) => pickSite(e.target.value)} aria-label="사업">
                <option value="all">전체 사업</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)}</option>)}
              </select>
            </label>
            {B.nHot > 0 && <Tag tone="bad">긴급 · 높음 {B.nHot}</Tag>}
            {B.nOld > 0 && <Tag tone="warn">7일 넘음 {B.nOld}</Tag>}
            <span className="flex-1" />
            <span className="text-[11px] text-ink3">카드를 누르면 내용 · 상태를 고칩니다</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {LANES.map(([k, nm, sub, top]) => {
              const L = B.lanes[k];
              const more = k === '해결' && L.length > 6 && !allDone;
              return (
                <section key={k} className={`rounded-xl border border-t-4 border-border bg-panel-alt ${top}`}>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <b className="text-[13px] text-ink">{nm}</b><span className="rounded-full bg-panel px-2 text-[11.5px] font-bold text-ink2">{L.length}</span>
                    <span className="flex-1" /><small className="text-[11px] text-ink3">{sub}</small>
                  </div>
                  <div className="space-y-2 px-3 pb-3">
                    {(more ? L.slice(0, 6) : L).map(card)}
                    {!L.length && <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-ink3">{LANE_EMPTY[k]}</div>}
                    {more && <Button size="sm" variant="secondary" onClick={() => setAllDone(true)}>나머지 {L.length - 6}건 더 보기</Button>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
      {modals.node}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full border border-border bg-panel-alt px-2.5 py-1"><b className="grid h-4 w-4 place-items-center rounded-full bg-navy text-[10px] text-white">{n}</b>{children}</span>;
}
