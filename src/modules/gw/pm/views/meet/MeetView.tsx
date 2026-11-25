import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { monthDay, shortName, todayStr } from '@/domain/pm/rules';
import { dday } from '@/domain/pm/site';
import { ACT_BUCKETS, actBuckets, actOpen, meetList } from '@/domain/pm/meet';
import type { PmAction, PmMeeting } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { Avatar, EmptyHint, Tag } from '../wbs/parts';
import { ScreenHead } from '../dash/parts';
import { ActFormModal, MeetFormModal } from './MeetModals';

/**
 * 이슈 · 회의 · 보고 › 회의록 · 액션 아이템 (데모 docMeet 5658).
 * 왼쪽 회의 기록(달마다) → 오른쪽 회의록(회사 양식처럼, 인쇄) → 아래 할 일 4칸(기한 지남 · 이번 주 · 그 뒤 · 끝낸 일).
 * 주소 `?mt=M…` = 그 회의 (🔔 새 회의록 · 검색), `?act=A…` = 그 액션 아이템 창 (🔔 · 검색), `&k=` = 사업.
 */
type Pop = { kind: 'mt'; m: PmMeeting | null } | { kind: 'act'; a: PmAction | null; mt: PmMeeting | null };
const inp = 'rounded border border-border bg-panel px-2 py-1 text-[12px] text-ink';
const WD = '일월화수목금토';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function MeetView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [params, setParams] = useSearchParams();
  const [who, setWho] = useState('all');
  const [sel, setSel] = useState('');
  const [pop, setPop] = useState<Pop | null>(null);
  const [msg, setMsg] = useState('');
  /** 액션 '하나 더' 때 창을 새로 (칸 비우기) */
  const [actN, setActN] = useState(0);
  const projects = useMemo(() => (d ? [...d.snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''))) : []), [d]);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const site = params.get('k') ?? 'all';

  // 알림 · 검색에서: ?mt = 그 회의 고르기 (사업 거르기 풂, 데모 mtOpen) · ?act = 그 액션 아이템 창 — 읽고 나면 주소에서 지움
  const mtP = params.get('mt') ?? '';
  const actP = params.get('act') ?? '';
  const ready = !!d;
  useEffect(() => {
    if (!ready || (!mtP && !actP)) return;
    if (mtP) setSel(mtP);
    const a = actP ? d!.snap.actions.find((x) => x.id === actP) : undefined;
    if (a) setPop({ kind: 'act', a, mt: null });
    const n = new URLSearchParams(params); n.delete('mt'); n.delete('act'); if (mtP) n.delete('k'); setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mtP, actP, ready]);

  const head = (
    <ScreenHead title="회의록 · 액션 아이템" desc="회의 결정 사항과 후속 조치(담당 · 기한)를 기록합니다. 결정 사항은 주간 보고서의 '금주 회의 결정사항'에 들어가고, 액션 아이템은 담당자의 내 업무 · 🔔 알림에 뜹니다.">
      <Button variant="secondary" onClick={() => setPop({ kind: 'act', a: null, mt: null })}>+ 액션 아이템</Button>
      <Button onClick={() => setPop({ kind: 'mt', m: null })}>+ 회의록 작성</Button>
    </ScreenHead>
  );
  if (!d) return <>{head}<EmptyHint title="회의록을 불러오는 중입니다" /></>;
  const today = d.today;
  const ms = meetList(d.snap.meetings, site);
  const m = ms.find((x) => x.m.id === sel)?.m ?? ms[0]?.m ?? null;
  const mActs = m ? d.snap.actions.filter((a) => a.meetingId === m.id) : [];
  const B = actBuckets(d.snap.actions, site, who, today);
  const defSite = site !== 'all' ? site : '';
  const pickSite = (k: string) => { const n = new URLSearchParams(params); if (k === 'all') n.delete('k'); else n.set('k', k); setParams(n); setSel(''); };
  const done = (t: string) => { setMsg(t); setPop(null); };
  const print = () => {
    if (!m) return;
    const w = window.open('', '_blank');
    if (!w) { setMsg('팝업이 막혀 인쇄 창을 열지 못했습니다'); return; }
    const row = (k: string, v: string, wide = true) => `<tr><th>${k}</th><td${wide ? ' colspan="3"' : ''} style="white-space:pre-wrap">${esc(v)}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>회의록_${esc(m.date)}_${esc(m.title)}</title><style>
      @page{size:A4;margin:18mm 14mm}body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;font-size:10.5pt}
      h1{text-align:center;letter-spacing:.5em;font-size:19pt;margin:0 0 4px}.sub{text-align:center;color:#555;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;margin-bottom:14px}th,td{border:1px solid #333;padding:6px 8px;vertical-align:top}th{background:#dce6f1;width:110px;text-align:left}
      h4{margin:10px 0 6px}</style></head><body>
      <h1>회의록</h1><div class="sub">${esc(m.type)} · ${esc(m.date)}${m.place ? ` · ${esc(m.place)}` : ''}</div>
      <table><tr><th>회의명</th><td colspan="3"><b>${esc(m.title)}</b></td></tr>
      <tr><th>사업</th><td>${esc(m.projectId ? shortOf(m.projectId) : '공통')}</td><th style="width:90px">작성</th><td>${esc(people.labelOf(m.by))}</td></tr>
      <tr><th>참석자</th><td colspan="3">${m.attIds.map((x) => esc(people.labelOf(x))).join(', ')}${m.ext ? `<br>외부: ${esc(m.ext)}` : ''}</td></tr>
      ${row('회의 내용', m.content || '-')}${row('결정 사항', m.decision || '-')}</table>
      <h4>액션 아이템 (${mActs.length})</h4><table><tr><th style="width:auto">내용</th><th>담당</th><th style="width:90px">기한</th><th style="width:70px">상태</th></tr>
      ${mActs.map((a) => `<tr><td>${esc(a.text)}</td><td>${esc(people.labelOf(a.whoId))}</td><td>${esc(a.due || '-')}</td><td>${a.done ? '완료' : '진행'}</td></tr>`).join('') || '<tr><td colspan="4">없음</td></tr>'}</table>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };
  const actItem = (x: PmAction) => {
    const mt = d.snap.meetings.find((y) => y.id === x.meetingId);
    return (
      <div key={x.id} className={`flex items-center gap-2 border-b border-border px-3 py-2 text-[12px] last:border-b-0 ${actOpen(x) ? '' : 'opacity-60'}`}>
        <input type="checkbox" className="h-4 w-4 cursor-pointer" checked={x.done} title="끝냈으면 체크" onChange={(e) => void mut.setActionDone.mutateAsync({ id: x.id, done: e.target.checked })} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-ink">{x.text}</b>
          <span className="text-[11px] text-ink3">{x.projectId ? shortOf(x.projectId) : '공통'}
            {mt && <> · <button type="button" className="text-blue hover:underline" onClick={() => setSel(mt.id)}>{trunc(mt.title, 22)}</button></>}
            {x.done && x.doneDate ? ` · 완료 ${x.doneDate}` : ''}</span>
        </div>
        {x.whoId ? <span title={people.labelOf(x.whoId)}><Avatar name={people.nameOf(x.whoId) || '?'} /></span> : <Tag tone="warn">담당 없음</Tag>}
        <span className={`w-[52px] text-right leading-tight ${actOpen(x) && x.due && x.due < today ? 'text-danger' : 'text-ink2'}`}><b>{x.due ? monthDay(x.due) : '-'}</b>{actOpen(x) && x.due && <small className="block text-[10.5px]">{dday(x.due, today)}</small>}</span>
        <Button size="sm" variant="secondary" onClick={() => setPop({ kind: 'act', a: x, mt: null })}>수정</Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {head}
      {msg && <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}
      <label className="flex items-center gap-1.5 text-[12px] text-ink2">사업
        <select className={inp} value={site} onChange={(e) => pickSite(e.target.value)} aria-label="사업">
          <option value="all">전체 사업</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)}</option>)}
        </select>
      </label>
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,380px)_1fr]">
        {/* 회의 기록 */}
        <section className="rounded-xl border border-border bg-panel shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5"><h3 className="text-[13px] font-bold text-ink">회의 기록</h3><span className="flex-1" /><span className="text-[11.5px] text-ink3">{ms.length}건</span></div>
          <div className="max-h-[520px] overflow-y-auto">
            {ms.length ? ms.map(({ m: x, month }) => {
              const open = d.snap.actions.filter((a) => a.meetingId === x.id && actOpen(a)).length;
              return (
                <div key={x.id}>
                  {month && <div className="bg-panel-alt px-4 py-1 text-[11px] font-bold text-ink3">{month}</div>}
                  <button type="button" onClick={() => setSel(x.id)} className={`flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left text-[12px] ${x.id === m?.id ? 'bg-blue-soft' : 'hover:bg-panel-alt'}`}>
                    <span className="w-[30px] flex-none text-center leading-tight"><b className="block text-[16px] text-ink">{x.date ? +x.date.slice(8) : '-'}</b><span className="text-[10.5px] text-ink3">{x.date ? WD[new Date(`${x.date}T00:00:00`).getDay()] : ''}</span></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><Tag>{x.type}</Tag><b className="truncate text-ink">{x.title}</b></span>
                      <span className="text-[11px] text-ink3">{x.projectId ? shortOf(x.projectId) : '공통'} · 참석 {x.attIds.length}명{open ? <> · <span className="font-bold text-danger">할 일 {open}</span></> : ''}</span>
                    </span>
                  </button>
                </div>
              );
            }) : (
              <div className="px-5 py-8 text-center">
                <b className="block text-[13px] text-ink">아직 회의 기록이 없어요</b>
                <span className="mt-1 block text-[11.5px] leading-relaxed text-ink3">착수 회의 · 주간 회의 · 현장 협의를 남겨 두면 결정 사항과 할 일을 여기서 따라갑니다</span>
                <div className="mt-3"><Button size="sm" onClick={() => setPop({ kind: 'mt', m: null })}>+ 첫 회의록 작성</Button></div>
              </div>
            )}
          </div>
        </section>

        {/* 회의록 */}
        {m ? (
          <section className="rounded-xl border border-border bg-panel p-5 shadow-sm">
            <div className="mb-2 flex justify-end gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setPop({ kind: 'mt', m })}>수정</Button>
              <Button size="sm" variant="secondary" onClick={() => setPop({ kind: 'act', a: null, mt: m })}>+ 액션</Button>
              <Button size="sm" variant="secondary" onClick={print}>인쇄</Button>
            </div>
            <h2 className="text-center text-[20px] font-extrabold tracking-[.4em] text-ink">회의록</h2>
            <div className="mb-3 text-center text-[12px] text-ink3">{m.type} · {m.date}{m.place ? ` · ${m.place}` : ''}</div>
            <table className="w-full border-collapse text-[12px] [&_td]:border [&_td]:border-border-hi [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:w-[110px] [&_th]:border [&_th]:border-border-hi [&_th]:bg-panel-alt [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-ink2">
              <tbody>
                <tr><th>회의명</th><td colSpan={3}><b>{m.title}</b></td></tr>
                <tr><th>사업</th><td>{m.projectId ? shortOf(m.projectId) : '공통'}</td><th>작성</th><td>{people.labelOf(m.by)}</td></tr>
                <tr><th>참석자</th><td colSpan={3}>{m.attIds.map((x) => people.labelOf(x)).join(', ')}{m.ext && <><br /><span className="text-[11px] text-ink3">외부: {m.ext}</span></>}</td></tr>
                <tr><th>회의 내용</th><td colSpan={3} className="whitespace-pre-wrap">{m.content || '-'}</td></tr>
                <tr><th>결정 사항</th><td colSpan={3} className="whitespace-pre-wrap">{m.decision || '-'}</td></tr>
              </tbody>
            </table>
            <h4 className="mb-1.5 mt-4 text-[12.5px] font-bold text-ink">액션 아이템 ({mActs.length})</h4>
            <table className="w-full border-collapse text-[12px] [&_td]:border [&_td]:border-border-hi [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-border-hi [&_th]:bg-panel-alt [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-ink2">
              <thead><tr><th>내용</th><th className="w-[110px]">담당</th><th className="w-[90px]">기한</th><th className="w-[70px]">상태</th></tr></thead>
              <tbody>{mActs.length ? mActs.map((a) => <tr key={a.id}><td>{a.text}</td><td>{people.labelOf(a.whoId)}</td><td>{a.due || '-'}</td><td>{a.done ? '완료' : '진행'}</td></tr>) : <tr><td colSpan={4}>없음</td></tr>}</tbody>
            </table>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-panel p-5 shadow-sm text-[12px] text-ink2">
            <b className="text-[13px] text-ink">회의록에 담기는 것</b>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>회의명 · 날짜 · 참석자</li>
              <li>회의 내용과 <b>결정 사항</b></li>
              <li>담당자 · 기한이 붙은 <b>할 일(액션 아이템)</b> — 아래 할 일 칸으로 모입니다</li>
              <li>[인쇄]로 회사 양식처럼 보관</li>
            </ol>
          </section>
        )}
      </div>

      {/* 할 일 (액션 아이템) */}
      <section className="rounded-xl border border-border bg-panel shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <h3 className="text-[13px] font-bold text-ink">할 일 (액션 아이템)</h3><span className="text-[11.5px] text-ink3">회의에서 정한 후속 조치</span>
          <span className="flex-1" />
          <select className={inp} value={who} onChange={(e) => setWho(e.target.value)} aria-label="담당자">
            <option value="all">전체 담당자</option>
            {people.people.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </div>
        {B.n ? (
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {ACT_BUCKETS.map(([k, l]) => (
              <div key={k} className={`rounded-lg border ${k === 'od' ? 'border-danger/40' : 'border-border'} bg-panel-alt`}>
                <div className="flex items-center gap-2 px-3 py-2"><b className={`text-[12.5px] ${k === 'od' ? 'text-danger' : 'text-ink'}`}>{l}</b><span className="rounded-full bg-panel px-2 text-[11px] font-bold text-ink2">{B[k].length}</span></div>
                <div className="bg-panel">{B[k].length ? B[k].map(actItem) : <div className="px-3 py-4 text-center text-[11.5px] text-ink3">없음</div>}</div>
              </div>
            ))}
          </div>
        ) : <EmptyHint title="할 일이 없습니다" hint="회의에서 정한 후속 조치를 담당자 · 기한과 함께 [+ 액션 아이템]으로 넣으세요." />}
      </section>

      {pop?.kind === 'mt' && (
        <MeetFormModal m={pop.m} defSite={defSite} me={people.me} today={todayStr()} projects={projects} people={people.people} shortOf={shortOf}
          nActs={pop.m ? d.snap.actions.filter((a) => a.meetingId === pop.m!.id).length : 0}
          onSave={async (x, addAct) => {
            if (pop.m) { await mut.updateMeeting.mutateAsync({ id: pop.m.id, x }); done('회의록 수정'); return; }
            const id = await mut.addMeeting.mutateAsync(x);
            setSel(id);
            setMsg('회의록 저장');
            setPop(addAct ? { kind: 'act', a: null, mt: { ...x, id, by: people.me, at: today } } : null);
          }}
          onRemove={async () => { if (pop.m) { await mut.removeMeeting.mutateAsync(pop.m.id); setSel(''); done('회의록 삭제'); } }}
          onClose={() => setPop(null)} />
      )}
      {pop?.kind === 'act' && (
        <ActFormModal key={pop.a?.id ?? `new${actN}`} a={pop.a} mt={pop.mt} defSite={defSite} me={people.me} today={todayStr()} projects={projects} meetings={d.snap.meetings} people={people.people} shortOf={shortOf}
          onAdd={async (x, more) => {
            await mut.addAction.mutateAsync(x);
            const t = `액션 아이템 추가 — ${people.labelOf(x.whoId)} ${x.due}`;
            setMsg(t);
            setActN((n) => n + 1);
            // 하나 더: 같은 회의로 새 창 (key 가 바뀌어 칸이 비워짐)
            setPop(more ? { kind: 'act', a: null, mt: d.snap.meetings.find((y) => y.id === x.meetingId) ?? pop.mt } : null);
          }}
          onUpdate={async (x) => { await mut.updateAction.mutateAsync({ id: pop.a!.id, x }); done('액션 아이템 수정'); }}
          onRemove={async () => { await mut.removeAction.mutateAsync(pop.a!.id); done('액션 아이템 삭제'); }}
          onClose={() => setPop(null)} />
      )}
    </div>
  );
}
