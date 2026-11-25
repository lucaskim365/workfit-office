import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FavStar } from '../../ui/PmShell';
import { Button } from '@/shared/ui/Button';
import { defaultAssignee, diffDays, monthDay, shortName } from '@/domain/pm/rules';
import {
  filterTickets, openByAssignee, PM_TICKET_FLOW, ticketCsv, ticketRecommend, ticketStats, tkLate, TICKET_FILTER_DEFAULT,
  type PmTicket, type PmTicketStatus, type TicketFilter, type TicketStFilter,
} from '@/domain/pm/ticket';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { workItemOf } from '@/domain/pm/team';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from '../wbs/parts';
import { LegacyTag, PrioTag, StatusTag, TicketCard, TypeTag, workLabel } from './parts';
import { usePmModals } from './usePmModals';

/**
 * 업무 목록 · 티켓 › 티켓 목록 (pTickets 1888).
 * 숫자 칸 5개(누르면 그 티켓만) · 티켓 없이 시작했거나 곧 시작할 업무(발행 추천) · 사업·담당·상태·검색 ·
 * 담당별 미완료 · 보드(끌어 놓아 상태 이동) / 리스트 · CSV(Jira).
 */
const COLS: readonly PmTicketStatus[] = [...PM_TICKET_FLOW, '보류'];
const ST_OPTS: ReadonlyArray<readonly [TicketStFilter, string]> = [['open', '미완료 전체'], ['all', '전체'], ['late', '마감 경과'], ['doing', '처리 중 (접수 · 진행중)'], ...COLS.map((s) => [s, s] as const), ['취소', '발행 취소']];
const inp = 'rounded border border-border-hi bg-panel px-2 py-1 text-[12px]';

export function TicketListView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [, setParams] = useSearchParams();
  const projects = d?.snap.projects ?? [];
  const shortOf = (id: string) => { const p = projects.find((x) => x.id === id); return p ? shortName(p, projects) : id; };
  const M = usePmModals({ d, people, mut, shortOf });
  const [f, setF] = useState<TicketFilter>(TICKET_FILTER_DEFAULT);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [recOpen, setRecOpen] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<PmTicketStatus | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [help, setHelp] = useState(false);

  const tickets = d?.snap.tickets ?? [];
  const today = d?.today ?? '';
  const list = useMemo(() => filterTickets(tickets, f, today, people.nameOf), [tickets, f, today, people.nameOf]);
  if (!d) return <EmptyHint title="티켓을 불러오는 중입니다" />;

  const st = ticketStats(tickets, today);
  const asg = openByAssignee(tickets, today);
  const R = ticketRecommend(d.snap.tasks.filter(workItemOf(d.snap)), d.liveMap, new Set(d.taskTicket.keys()), today);
  const goRec = () => setParams({ v: 'task/wbs', period: 'rec' });
  const goWbs = () => setParams({ v: 'task/wbs' });
  const pickSt = (s: TicketStFilter) => setF((x) => ({ ...x, st: s }));

  const csv = () => {
    if (!list.length) { setMsg({ t: '내보낼 티켓이 없습니다', bad: true }); return; }
    const text = ticketCsv(list, (id) => { const p = projects.find((x) => x.id === id); return { company: p?.company ?? '', biz: p?.biz ?? '' }; }, people.nameOf);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = `티켓_${today}_${list.length}건.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMsg({ t: `${list.length}건 CSV 내보내기 완료` });
  };
  const drop = async (to: PmTicketStatus) => {
    const x = drag ? d.ticketMap.get(drag) : null;
    setDrag(null);
    setOver(null);
    if (!x || x.status === to) return;
    if (to === '보류' || (x.status === '검토요청' && to === '진행중')) { setMsg({ t: '반려·보류는 티켓 창에서 사유를 입력해 주세요', bad: true }); return; }
    try { setMsg({ t: await mut.moveTicket.mutateAsync({ no: x.no, to, cmt: '' }) }); } catch (e) { setMsg({ t: e instanceof Error ? e.message : String(e), bad: true }); }
  };

  const recRows = (
    <div>
      {R.near.slice(0, 5).map((t) => {
        const who = defaultAssignee(t);
        const started = t.start <= today;
        return (
          <button key={t.id} type="button" onClick={() => M.openTask(t.id)} className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-left text-[12px] hover:bg-panel-alt">
            <ProjectTag>{shortOf(t.projectId)}</ProjectTag>
            <span className="min-w-0 flex-1 truncate">{t.milestone && <b className="text-amber">◆ </b>}{t.name}</span>
            <span className="w-[90px] truncate text-[11px]">{who ? people.nameOf(who) : <b className="text-amber">담당 없음</b>}</span>
            <span className="w-[80px] text-right text-[11px]"><b>{monthDay(t.start)}</b> <small className="text-ink3">{t.start === today ? '오늘 시작' : started ? '시작함' : `${diffDays(today, t.start)}일 뒤 시작`}</small></span>
          </button>
        );
      })}
    </div>
  );

  const head = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold text-ink">티켓 목록</h2>
        <FavStar />
        <button type="button" onClick={() => setHelp((o) => !o)} title={help ? '설명 닫기' : '이 화면 설명 보기'} className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] font-bold ${help ? 'border-teal bg-teal text-white' : 'border-border-hi text-ink3'}`}>?</button>
        <span className="flex-1" />
        <Button size="sm" onClick={csv}>⬇ CSV 내보내기 (Jira)</Button>
        <Button size="sm" variant="primary" onClick={goWbs}>+ 업무 목록에서 발행</Button>
      </div>
      {help && (
        <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[11.5px] leading-relaxed text-ink2">
          티켓으로 업무를 맡기고 처리 상태를 봅니다. 담당자가 접수 → 작업 시작 → 검토 요청하면, 승인자(기본 = 업무 PM)가 승인해 완료합니다. 완료는 업무 실적 100%로 반영됩니다.
          보드에서 카드를 다른 칸으로 끌어 놓으면 상태가 바뀝니다 (반려·보류는 사유가 필요해 티켓 창에서). 위 숫자 칸을 누르면 그 티켓만 봅니다.
        </p>
      )}
      {msg && <div className={`mb-3 rounded-lg px-3 py-1.5 text-[12px] ${msg.bad ? 'bg-danger/10 text-danger' : 'bg-teal-soft text-ink2'}`}>{msg.t}</div>}
    </>
  );

  // 티켓이 하나도 없으면: 무엇을 하면 채워지는지 + 지금 발행하면 좋은 업무 (빈 화면 숨기지 않기)
  if (!tickets.some((x) => x.status !== '취소')) {
    return (
      <div>
        {head}
        <div className="rounded-xl border border-border bg-panel">
          <div className="px-5 pb-5 pt-8 text-center">
            <div className="text-[13px] font-bold text-ink">아직 발행된 티켓이 없어요</div>
            <p className="mt-1.5 text-[11.5px] text-ink3">업무를 담당자에게 티켓으로 넘기면, 담당자가 진행 상황을 올리고 끝나면 승인을 거쳐 업무 진행률에 반영돼요.</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11.5px] text-ink2">
              <Tag tone="run">1 업무 목록에서 업무 골라 발행</Tag><span>→</span><Tag tone="run">2 담당자 진행 · 검토 요청</Tag><span>→</span><Tag tone="run">3 승인 · 업무 실적 반영</Tag>
            </div>
          </div>
          {R.rec.length ? (
            <div className="border-t border-border">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
                <b>지금 발행하면 좋은 업무</b><span className="text-[11px] text-ink3">이미 시작했거나 7일 안에 시작하는데 티켓이 없는 업무 · 아래는 오늘과 가까운 5건</span>
                <span className="flex-1" />
                <Button size="sm" variant="primary" onClick={goRec}>🎫 발행 추천 {R.rec.length}건 업무 목록에서 고르기</Button>
              </div>
              {recRows}
            </div>
          ) : (
            <div className="border-t border-border px-3 py-3 text-center text-[11.5px] text-ink3">
              지금은 발행 추천 업무가 없습니다 — 업무에 시작일을 넣으면, 7일 안에 시작하는 업무가 여기 나옵니다.
              <div className="mt-2"><Button size="sm" variant="primary" onClick={goWbs}>🎫 업무 목록에서 티켓 발행하기</Button></div>
            </div>
          )}
        </div>
        {M.node}
      </div>
    );
  }

  const kpis: Array<{ l: string; v: number; unit: string; s: string; st: TicketStFilter; tone?: string }> = [
    { l: '발행된 티켓', v: st.total, unit: '건', s: `미접수 ${st.issued}건`, st: 'all' },
    { l: '처리 중', v: st.accepted + st.running, unit: '건', s: `접수 ${st.accepted} · 진행 ${st.running} · 보류 ${st.hold}`, st: 'doing' },
    { l: '검토 · 승인 대기', v: st.review, unit: '건', s: '검토요청 상태', st: '검토요청', tone: st.review ? 'text-navy' : '' },
    { l: '마감 경과', v: st.late, unit: '건', s: '미완료 · 마감일 경과', st: 'late', tone: st.late ? 'text-danger' : '' },
    { l: '완료율', v: st.donePct, unit: '%', s: `완료 ${st.done}건`, st: '완료' },
  ];
  const card = (x: PmTicket) => (
    <TicketCard key={x.no} x={x} short={shortOf(x.projectId)} who={people.nameOf(x.assigneeId)} today={today} onOpen={() => M.openTicket(x.no)} onDragStart={() => setDrag(x.no)} />
  );

  return (
    <div>
      {head}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {kpis.map((k) => (
          <button key={k.l} type="button" onClick={() => pickSt(k.st)} title="누르면 이 티켓만 봅니다" className={`rounded-xl border bg-panel px-3 py-2.5 text-left hover:border-teal ${f.st === k.st ? 'border-teal' : 'border-border'}`}>
            <div className="text-[11.5px] text-ink3">{k.l}</div>
            <div className={`text-[20px] font-bold ${k.tone || 'text-ink'}`}>{k.v}<small className="ml-0.5 text-[11px] font-normal">{k.unit}</small></div>
            <div className="text-[10.5px] text-ink3">{k.s}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-border bg-panel">
        <button type="button" onClick={() => setRecOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px]">
          <b>티켓 없이 시작했거나 곧 시작할 업무 {R.rec.length}건</b>
          {R.today > 0 && <span className="text-ink3">· 오늘 시작 {R.today}건</span>}
          <span className="flex-1" />
          <span className="text-[11px] text-ink3">{recOpen ? '접기 ▴' : '보기 ▾'}</span>
        </button>
        {recOpen && (R.rec.length ? (
          <div>
            <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-[11px] text-ink3">
              오늘과 가까운 5건 · 줄을 누르면 업무 상세<span className="flex-1" />
              <Button size="sm" variant="primary" onClick={goRec}>업무 목록에서 골라 발행</Button>
            </div>
            {recRows}
          </div>
        ) : <div className="border-t border-border px-3 py-2 text-[11.5px] text-ink3">없습니다 — 업무에 시작일을 넣으면, 7일 안에 시작하는데 티켓이 없는 업무가 여기 나옵니다.</div>)}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={inp} value={f.projectId} onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value }))}>
          <option value="all">전체 사업</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.company}</option>)}
        </select>
        <select className={inp} value={f.who} onChange={(e) => setF((x) => ({ ...x, who: e.target.value }))}>
          <option value="all">전체 담당자</option>
          {[...new Set(tickets.filter((x) => x.status !== '취소').map((x) => x.assigneeId))].map((a) => <option key={a} value={a}>{people.labelOf(a) || '담당 없음'}</option>)}
        </select>
        <select className={inp} value={f.st} onChange={(e) => pickSt(e.target.value as TicketStFilter)}>
          {ST_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className={`${inp} w-[200px]`} placeholder="티켓번호·업무·담당 검색" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
        {asg.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-ink3">담당 미완료</span>
            {asg.map(([a, v]) => (
              <button key={a} type="button" onClick={() => setF((x) => ({ ...x, who: x.who === a ? 'all' : a }))} title={f.who === a ? '다시 누르면 전체 보기' : '누르면 이 사람 티켓만 보기'}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${f.who === a ? 'border-teal bg-teal-soft font-bold text-teal' : 'border-border text-ink2'}`}>
                {people.nameOf(a) || '담당 없음'} <b>{v.open}</b>
                {v.review > 0 && <em className="ml-1 not-italic text-navy">검토 {v.review}</em>}
                {v.late > 0 && <em className="ml-1 not-italic text-danger">지연 {v.late}</em>}
              </button>
            ))}
          </span>
        )}
        <span className="flex-1" />
        <span className="text-[11.5px] text-ink3">{list.length}건</span>
        <span className="inline-flex overflow-hidden rounded border border-border-hi">
          {(['board', 'list'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`px-2.5 py-1 text-[11.5px] font-bold ${view === v ? 'bg-teal-soft text-teal' : 'bg-panel text-ink2'}`}>{v === 'board' ? '보드' : '리스트'}</button>
          ))}
        </span>
      </div>

      {view === 'board' ? (
        <div className="grid gap-2 overflow-x-auto" style={{ gridTemplateColumns: `repeat(${COLS.length}, minmax(140px, 1fr))` }}>
          {COLS.map((c) => {
            const l = list.filter((x) => x.status === c);
            return (
              <div
                key={c}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c); } }}
                onDragLeave={() => setOver((o) => (o === c ? null : o))}
                onDrop={(e) => { e.preventDefault(); void drop(c); }}
                className={`min-h-[200px] rounded-xl border bg-panel-alt p-2 ${over === c ? 'border-teal' : 'border-border'}`}
              >
                <div className="mb-2 flex items-center gap-1.5"><StatusTag s={c} /><span className="text-[11px] text-ink3">{l.length}</span></div>
                <div className="grid gap-1.5">{l.map(card)}</div>
                {!l.length && <div className="py-6 text-center text-[11px] text-ink3">없음</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-panel">
          <table className="w-full text-[12px]">
            <thead className="bg-panel-alt text-left text-[11px] text-ink3">
              <tr>{['티켓', '사업', '업무', '내용', '종류', '담당', '우선순위', '마감', '진행률', '상태'].map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.no} onClick={() => M.openTicket(x.no)} className="cursor-pointer border-t border-border hover:bg-panel-alt">
                  <td className="whitespace-nowrap px-2 py-1.5"><Tag tone="navy">{x.no}</Tag></td>
                  <td className="px-2 text-[11.5px]">{projects.find((p) => p.id === x.projectId)?.company ?? x.projectId}</td>
                  <td className="whitespace-nowrap px-2 text-[11.5px]">{x.legacyKey ? <LegacyTag k={x.legacyKey} /> : workLabel(x)}</td>
                  <td className="px-2">
                    {x.title}
                    {x.subtaskId && <span className="ml-1"><Tag>세부</Tag></span>}
                    {x.taskChange && <span className="ml-1"><Tag tone="bad">업무 {x.taskChange}</Tag></span>}
                  </td>
                  <td className="px-2"><TypeTag t={x.type} /></td>
                  <td className="whitespace-nowrap px-2 text-[11.5px]">{people.nameOf(x.assigneeId) || '-'}</td>
                  <td className="px-2"><PrioTag p={x.prio} /></td>
                  <td className={`whitespace-nowrap px-2 text-[11.5px] ${tkLate(x, today) ? 'font-bold text-danger' : ''}`}>{x.due || '-'}</td>
                  <td className="px-2 text-[11.5px]">{x.prog}%</td>
                  <td className="px-2"><StatusTag s={x.status} /></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={10} className="py-8 text-center text-[11.5px] text-ink3">조건에 맞는 티켓이 없습니다 — 위 숫자 칸이나 사업·담당·상태를 바꿔 보세요</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 text-[10.5px] text-ink3">저장: 메모리 (새로 고침하면 처음 데이터로 — DB 저장은 7단계)</div>
      {M.node}
    </div>
  );
}
