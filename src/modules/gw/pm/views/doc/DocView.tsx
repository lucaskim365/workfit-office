import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { leftText, monthDay, shortName } from '@/domain/pm/rules';
import { isPre } from '@/domain/pm/site';
import { DOC_FILTER_DEFAULT, DOC_ST, docDueTone, docFilter, docSummary, docTasks, type DocFilter, type DocSt } from '@/domain/pm/doc';
import type { PmTask } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, usePmSiteMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { DocSeg, Pager } from './parts';

/**
 * 점검 · 요구사항 · 산출물 › 산출물 (데모 pDoc 4258) — 사업 하나의 '감리 제출 n / 전체' + 상태 띠 + 단계 칸,
 * 아래는 산출물 한 줄 카드 · 상태 3칸 · 파일 올리기 · 티켓. URL `k` = 사업.
 * 산출물 = 업무 목록의 '산출물' 칸이 적힌 업무 (지금 내장 업무 목록엔 그 칸이 비어 있어 0건 — 데모도 같음).
 */
const PER = 30;
const inp = 'rounded border border-border bg-panel px-2 py-1 text-[12px] text-ink';
const live2 = (s: string, late: boolean) => (late ? '지연' : s);

export function DocView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const smut = usePmSiteMutations(people.me);
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState<DocFilter>(DOC_FILTER_DEFAULT);
  const [pg, setPg] = useState(1);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const upFor = useRef('');
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });

  // 사업 고르기 (pickSite): URL k → 업무가 있는 첫 사업 → 첫 사업
  const projects = useMemo(() => (d ? [...d.snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))) : []), [d]);
  const p = useMemo(() => {
    if (!d) return null;
    const k = params.get('k');
    return projects.find((x) => x.id === k) ?? projects.find((x) => d.snap.tasks.some((t) => t.projectId === x.id)) ?? projects[0] ?? null;
  }, [d, params, projects]);

  if (!d) return <EmptyHint title="산출물을 불러오는 중입니다" />;
  const head = (
    <ScreenHead title="산출물" desc="업무 목록 산출물의 감리 제출 상태를 관리합니다. 업무 목록의 '산출물' 칸이 적힌 업무가 여기 나오고, 상태를 고르거나 파일을 올리면 사업별 화면의 단계 카드 · 점검 · 감리 대비의 '산출물 제출'에 바로 반영됩니다.">
      <Button size="sm" variant="secondary" disabled title="사업계획서로 설계서를 자동으로 만드는 별도 서버 기능 — 1차 이관 범위 밖 (설계 6장)">산출물 자동 생성 (1차 제외)</Button>
    </ScreenHead>
  );
  if (!p) return <>{head}<EmptyHint title="등록된 사업이 없습니다" hint="사업 등록은 6단계(기준정보)에서 옮깁니다." /></>;

  const ts = d.snap.tasks.filter((t) => t.projectId === p.id);
  const all = docTasks(ts);
  const st = (t: PmTask) => d.docOf(t).st;
  const sum = docSummary(all, st);
  const list = docFilter(all, f, st);
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const cur = Math.min(Math.max(1, pg), pages);
  const shown = list.slice((cur - 1) * PER, cur * PER);
  const P0 = (v: number) => (all.length ? (v / all.length) * 100 : 0);
  const setFilter = (x: Partial<DocFilter>) => { setF((o) => ({ ...o, ...x })); setPg(1); };
  const pick = (k: string) => { const n = new URLSearchParams(params); n.set('k', k); setParams(n); setF(DOC_FILTER_DEFAULT); setPg(1); setMsg(''); };
  const setDoc = async (t: PmTask, v: DocSt) => { await smut.setDoc.mutateAsync({ taskId: t.id, st: v }); setMsg(''); };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !upFor.current) return;
    await smut.uploadDoc.mutateAsync({ taskId: upFor.current, name: file.name });
    setMsg(`'${file.name}' 제출 완료 — 파일 이름만 기록합니다 (파일 보관은 7단계 저장소 연결 때)`);
  };

  return (
    <div className="space-y-4">
      {head}
      {msg && <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <input ref={fileRef} type="file" hidden onChange={onFile} />

      {/* 위: 제출 진행판 (hero) */}
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5">
          <label className="flex items-center gap-1.5 text-[12px] text-ink2">사업
            <select className={`${inp} min-w-[160px]`} value={p.id} onChange={(e) => pick(e.target.value)} aria-label="사업">
              {projects.map((x) => <option key={x.id} value={x.id}>{shortOf(x.id)}</option>)}
            </select>
          </label>
          <span className="flex-1" />
          <span className="text-[11.5px] text-ink3">{p.company || shortOf(p.id)} · 산출물이 있는 업무</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 px-4 py-3">
          <div className="flex-none">
            <div className="text-[11.5px] text-ink3">감리 제출</div>
            <div className="text-[30px] font-extrabold leading-tight text-ink">{sum.done}<span className="ml-1 text-[16px] font-bold text-ink3">/ {sum.n}</span></div>
            <div className="text-[11.5px] font-bold text-ok">{sum.n ? Math.round(P0(sum.done)) : 0}% 제출</div>
          </div>
          <div className="min-w-[280px] flex-1">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-panel-alt">
              <i className="block h-full bg-ok" style={{ width: `${P0(sum.done)}%` }} />
              <i className="block h-full bg-blue" style={{ width: `${P0(sum.wip)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-ink2">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-ok" />제출 완료 <b>{sum.done}</b></span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-blue" />작성 중 <b>{sum.wip}</b></span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-border-hi" />미작성 <b>{sum.none}</b></span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <StageBtn on={f.stage === 'main' || f.stage === 'all'} name="전체" sub="협약 이후" onClick={() => setFilter({ stage: 'main' })} />
          {sum.stages.map((x) => (
            <StageBtn key={x.name} on={f.stage === x.name} done={x.d === x.n} name={x.name} sub={`${x.d}/${x.n}`} pct={x.n ? (x.d / x.n) * 100 : 0}
              title={`${x.name} · 제출 ${x.d}/${x.n}`} onClick={() => setFilter({ stage: x.name })} />
          ))}
        </div>
      </section>

      {/* 아래: 산출물 줄 */}
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <select className={inp} value={f.st} onChange={(e) => setFilter({ st: e.target.value as DocFilter['st'] })} aria-label="제출 상태">
            {([['open', '미제출'], ['all', '전체'], ...DOC_ST.map((x) => [x, x])] as Array<[string, string]>).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-1 text-[12px] text-ink2"><input type="checkbox" checked={f.ms} onChange={(e) => setFilter({ ms: e.target.checked })} />◆ 마일스톤만</label>
          <span className="flex-1" />
          <span className="text-[11.5px] text-ink3">{list.length}건</span>
          <input className={`${inp} w-[200px]`} placeholder="산출물 · 업무 검색" value={f.q} onChange={(e) => setFilter({ q: e.target.value })} aria-label="산출물 · 업무 검색" />
        </div>
        {shown.length ? shown.map((t) => {
          const ds = d.docOf(t);
          const tk = d.taskTicket.get(t.id);
          const files = [...(ds.file ? [ds.file] : []), ...(tk?.files ?? []).map((x) => x.name)];
          const tone = docDueTone(t, ds.st, d.today);
          const l = d.liveMap.get(t.id);
          const late = !!t.end && t.end < d.today && !(l && (l.status === '완료' || l.pct >= 100));
          const who = t.assigneeIds[0] ? people.nameOf(t.assigneeIds[0]) : '';
          const rowTone = ds.st === '제출완료' ? 'border-l-ok' : ds.st === '작성중' ? 'border-l-blue' : 'border-l-border-hi';
          return (
            <div key={t.id} className={`flex items-center gap-3 border-b border-l-[3px] border-b-border px-4 py-2.5 text-[12px] last:border-b-0 ${rowTone}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold text-ink">{t.milestone && <span className="text-amber">◆ </span>}{t.output}</div>
                <div className="flex min-w-0 gap-2 text-[11px] text-ink3">
                  <span>{t.code}</span><span>{t.stage}</span>
                  <button type="button" className="min-w-0 truncate hover:underline" title="업무 보기" onClick={() => modals.openTask(t.id)}>{t.name}</button>
                </div>
              </div>
              <div className="w-[96px] flex-none truncate">{who ? <span className="text-ink2">{who}</span> : <Tag tone="warn">담당 없음</Tag>}</div>
              <span className={`flex w-[72px] flex-none flex-col items-end leading-tight ${tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-amber' : 'text-ink2'}`}>
                <b>{t.end ? monthDay(t.end) : '-'}</b>
                <small className="text-[10.5px]">{ds.st !== '제출완료' && !isPre(t) && t.end ? leftText(t.end, d.today) : live2(l?.status ?? t.status, late)}</small>
              </span>
              <DocSeg st={ds.st} onSet={(v) => void setDoc(t, v)} />
              <div className="flex w-[260px] flex-none items-center justify-end gap-1.5">
                {files.length > 0 && <span className="max-w-[120px] truncate text-[11px] text-ink2" title={files.join('\n')}>📎 {files[0]}{files.length > 1 ? ` +${files.length - 1}` : ''}</span>}
                <Button size="sm" variant="secondary" onClick={() => { upFor.current = t.id; fileRef.current?.click(); }}>파일 올리기</Button>
                {tk && <Button size="sm" variant="secondary" onClick={() => modals.openTicket(tk.no)} title="이 업무 티켓">{tk.no}</Button>}
              </div>
            </div>
          );
        }) : (
          <EmptyHint title="조건에 맞는 산출물이 없습니다"
            hint={all.length ? '위쪽 상태 · 단계 · 검색 조건을 바꿔 보세요.' : "이 사업 업무 목록에 '산출물' 칸이 적힌 업무가 없습니다. 업무 목록 › 업무 수정에서 산출물(완료 조건)을 적으면 여기에 나옵니다."} />
        )}
        <Pager n={pages} cur={cur} onGo={setPg} />
      </section>
      {modals.node}
    </div>
  );
}

function StageBtn({ on, done, name, sub, pct, title, onClick }: { on: boolean; done?: boolean; name: string; sub: string; pct?: number; title?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`relative min-w-[120px] overflow-hidden rounded-lg border px-3 py-2 text-left ${on ? 'border-navy bg-blue-soft' : 'border-border bg-panel-alt hover:border-teal'}`}>
      <b className={`block text-[12.5px] ${done ? 'text-ok' : 'text-ink'}`}>{name}</b>
      <span className="text-[11px] text-ink3">{sub}</span>
      {pct != null && <i className="absolute bottom-0 left-0 block h-[3px] bg-ok" style={{ width: `${pct}%` }} />}
    </button>
  );
}
