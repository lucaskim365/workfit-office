import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { addDays, monthDay, shortName } from '@/domain/pm/rules';
import { dday, siteStatusFull } from '@/domain/pm/site';
import { nextMilestone } from '@/domain/pm/my';
import { planLogRows, workRec, type WorkRec } from '@/domain/pm/plan';
import { weekReport } from '@/domain/pm/weekly';
import { usePmDerived, usePmMutations, usePmSites } from '@/features/pm/usePm';
import { usePmPlanCtx } from '@/features/pm/usePmPlan';
import { usePmPeople } from '../../usePmPeople';
import { Avatar, EmptyHint } from '../wbs/parts';
import { CardHead, ScreenHead } from '../dash/parts';

/**
 * 이슈 · 회의 · 보고 › 주간 진행률 · 보고서 › 주간 보고서 (데모 docReport 4317) — 사업 · 주 고르기,
 * 작성 항목(금주 특이사항 · 협조 요청, 주차별 저장) · 팀원 업무 기록(참고용) · 보고서 6항목(자동) · 인쇄.
 * 주소 `&k=` = 사업.
 */
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const ta = 'min-h-[84px] w-full rounded border border-border bg-panel px-2.5 py-2 text-[12.5px] text-ink';
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
type Rec = WorkRec & { d: string };

export function ReportView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const S = usePmSites(d);
  const C = usePmPlanCtx(d);
  const mut = usePmMutations(people.me, people.nameOf);
  const [params, setParams] = useSearchParams();
  const [off, setOff] = useState(0);
  const [msg, setMsg] = useState('');
  const [teamOf, setTeamOf] = useState<{ who: string; rs: Rec[] } | null>(null);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const logs = useMemo(() => (C ? planLogRows(C, shortOf) : []), [C]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = (
    <ScreenHead title="주간 진행률 · 보고서" desc="진행률 갱신에서 입력한 진행률과 특이사항으로 사업별 주간 보고서를 자동으로 만듭니다. 업무 목록 · 티켓 · 이슈 · 회의록이 그대로 들어가고, 특이사항 · 협조 요청만 직접 씁니다." />
  );
  if (!d || !S) return <>{head}<EmptyHint title="주간 보고서를 불러오는 중입니다" /></>;
  const rows = S.all;
  const cur = rows.find((r) => r.p.id === params.get('k')) ?? rows.find((r) => r.c.ts.length) ?? rows[0];
  if (!cur) return <div className="space-y-4">{head}<EmptyHint title="등록된 사업이 없습니다" /></div>;
  const { p, c } = cur;
  const R = weekReport(c, off, {
    tickets: d.snap.tickets, issues: d.snap.issues, meetings: d.snap.meetings,
    hours: (k, a, b) => logs.filter((l) => l.projectId === k && l.date >= a && l.date <= b).reduce((s, l) => s + l.hours, 0),
  });
  const rp = d.snap.reports.find((r) => r.projectId === p.id && r.week === R.ws);
  const nextMs = nextMilestone(c.ts, d.liveMap);
  const st = siteStatusFull(c);
  const who0 = (t: { assigneeIds: string[] }) => (t.assigneeIds[0] ? people.labelOf(t.assigneeIds[0]) : '');
  const pm = [p.pmUserId ? people.labelOf(p.pmUserId) : '', p.pmName].find(Boolean) || '-';
  const d0 = new Date(`${R.ws}T00:00:00`);
  const title = `${d0.getFullYear()}년 ${d0.getMonth() + 1}월 ${R.wkNo}주차 (${monthDay(R.ws)} ~ ${monthDay(R.we)})`;
  // 팀원 업무 기록 (참고용 — 다른 사업 업무 기록은 뺌)
  const team = C ? [...new Set(c.ts.flatMap((t) => t.assigneeIds))].filter(Boolean).map((who) => {
    const rs: Rec[] = [];
    for (let x = R.ws; x <= R.we; x = addDays(x, 1)) for (const r of workRec(C, who, x, shortOf)) { const t = r.taskId ? d.taskMap.get(r.taskId) : undefined; if (!t || t.projectId === p.id) rs.push({ ...r, d: x }); }
    return { who, rs };
  }).sort((a, b) => b.rs.length - a.rs.length || (a.who < b.who ? -1 : 1)) : [];
  const teamN = team.filter((x) => x.rs.length).length;
  const pick = (k: string) => setParams(new URLSearchParams({ v: 'doc/report', k }), { replace: true });
  const save = (patch: { note?: string; req?: string }) => { mut.setReport.mutate({ projectId: p.id, week: R.ws, patch }); setMsg(patch.note != null ? '특이사항 저장 — 보고서 6번에 들어갑니다' : '협조 요청사항 저장 — 보고서 6번에 들어갑니다'); };

  // 보고서 본문 (화면 · 인쇄 같은 HTML)
  const T = (head2: string[], body: string[][], empty: string) => `<table><tr>${head2.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${body.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head2.length}">${esc(empty)}</td></tr>`}</table>`;
  const issRows = [...R.iss.map((i) => [i.title, i.cat, i.sev, i.status]), ...(R.late.length ? [[`지연 업무 ${R.late.length}건 (${[...new Set(R.late.map((t) => t.stage))].slice(0, 3).join(', ')})`, '일정', R.late.length >= 10 ? '높음' : '보통', '관리 중']] : [])];
  const body = `<h1>주간 진행 현황 보고서</h1><div class="sub">${esc(p.biz)} · ${esc(p.company)}${p.bizNo ? ` · 과제번호 ${esc(p.bizNo)}` : ''} · ${esc(title)}</div>
    <h4>1. 사업 개요 및 진척</h4>
    <table><tr><th>협약 기간</th><td>${esc(p.start || '-')} ~ ${esc(p.end || '-')}</td><th>진척률</th><td><b>${Math.round(R.act)}%</b> (계획 ${Math.round(R.plan)}%) · ${esc(st)}</td></tr>
    <tr><th>다음 마일스톤</th><td>${nextMs ? `${esc(nextMs.name)} (${esc(nextMs.end || '날짜 없음')}${nextMs.end ? `, ${dday(nextMs.end, d.today)}` : ''})` : '없음'}</td><th>업무</th><td>완료 ${R.done} / 전체 ${R.n} · 지연 ${R.late.length}건 · 금주 작업 ${R.hours}h</td></tr>
    <tr><th>운영기관 · PM</th><td>${esc(p.org || '-')} · ${esc(pm)}</td><th>상태 요약</th><td>${esc(p.summary || '-')}</td></tr></table>
    <h4>2. 금주 진행 업무 (${R.prog.length}건)</h4>${T(['번호', '업무', '담당', '실적', '종료일'], R.prog.map((t) => [t.code, t.name, who0(t), `${(d.liveMap.get(t.id)?.pct ?? t.actualPct)}%`, `${t.end}${t.end < d.today ? ' (지연)' : ''}`]), '없음')}
    <h4>3. 금주 완료 업무</h4>${T(['번호', '업무', '산출물'], R.doneRows.map((r) => [r[0], r[1], r[2] || '-']), '없음')}
    <h4>4. 이슈 및 리스크</h4>${T(['이슈', '분류', '심각도', '상태'], issRows, '특이사항 없음')}
    ${R.mts.length ? `<h4>· 금주 회의 결정사항</h4>${T(['일자', '회의', '결정 사항'], R.mts.map((m) => [m.date, m.title, m.decision || '-']), '')}` : ''}
    <h4>5. 차주 계획 (${monthDay(R.nws)} ~ ${monthDay(R.nwe)} 시작)</h4>${T(['번호', '업무', '시작 예정', '담당'], R.next.map((t) => [t.code, t.name, t.start, who0(t)]), '진행 중 업무 지속')}
    <h4>6. 특이사항 및 협조 요청</h4>
    <table><tr><th style="width:120px">특이사항</th><td class="pre">${esc(rp?.note || p.summary || '-')}</td></tr><tr><th>협조 요청</th><td class="pre">${esc(rp?.req || '-')}</td></tr></table>
    <div class="foot">작성: ${esc(people.labelOf(people.me))} · ${d.today} · 업무 목록(${esc(d.snap.sourceVersion)}) 기준 자동 생성</div>`;
  const css = `h1{text-align:center;font-size:18pt;margin:0 0 4px;letter-spacing:.1em}.sub{text-align:center;color:#555;margin-bottom:14px;font-size:10pt}
    h4{margin:14px 0 6px;font-size:11pt}table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{border:1px solid #444;padding:5px 7px;font-size:9.5pt;vertical-align:top;text-align:left}
    th{background:#dce6f1;color:#1b365d}.pre{white-space:pre-wrap}.foot{margin-top:16px;text-align:right;color:#666;font-size:9pt}`;
  const print = () => {
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { setMsg('팝업이 막혀 인쇄 창을 열 수 없습니다. 주소창의 팝업 허용을 눌러 주세요'); return; }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>주간보고_${esc(shortOf(p.id))}_${R.ws}</title><style>@page{size:A4;margin:16mm 14mm}body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;margin:0}${css}</style></head><body>${body}</body></html>`);
    w.document.close();
    w.onafterprint = () => w.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  return (
    <div className="space-y-4">
      {head}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[12px] text-ink2">사업
          <select className="rounded border border-border bg-panel px-2 py-1 text-[12px]" value={p.id} onChange={(e) => pick(e.target.value)} aria-label="사업">
            {rows.map((r) => <option key={r.p.id} value={r.p.id}>{shortOf(r.p.id)}</option>)}
          </select>
        </label>
        <Button size="sm" variant="secondary" onClick={() => setOff((o) => o - 1)}>이전 주</Button>
        <b className="text-[12px] tabular-nums">{R.ws} ~ {R.we}</b>
        <Button size="sm" variant="secondary" onClick={() => setOff((o) => o + 1)}>다음 주</Button>
        {off !== 0 && <Button size="sm" variant="secondary" onClick={() => setOff(0)}>이번 주</Button>}
        <span className="flex-1" />
        <Button onClick={print}>인쇄 / PDF 저장</Button>
      </div>
      {msg && <div className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-[12px] font-bold text-ok">{msg}</div>}

      <section className={sec}>
        <CardHead title="보고서 작성 항목 (주차별 저장)" />
        <div key={`${p.id}|${R.ws}`} className="grid gap-3 p-4 md:grid-cols-2">
          <label className="grid gap-1 text-[11.5px] font-bold text-ink2">금주 특이사항 (PM 작성)
            <textarea className={ta} defaultValue={rp?.note ?? ''} placeholder={p.summary || '금주 특이사항'} onBlur={(e) => { if (e.target.value !== (rp?.note ?? '')) save({ note: e.target.value }); }} />
          </label>
          <label className="grid gap-1 text-[11.5px] font-bold text-ink2">도입기업 협조 요청사항
            <textarea className={ta} defaultValue={rp?.req ?? ''} placeholder="협조 요청사항" onBlur={(e) => { if (e.target.value !== (rp?.req ?? '')) save({ req: e.target.value }); }} />
          </label>
        </div>
      </section>

      <section className={sec}>
        <CardHead title="팀원 업무 기록 (이번 주)"><span className="text-[11px] text-ink3">작성 참고용 · 보고서에는 들어가지 않습니다</span><span className="flex-1" /><span className="text-[11.5px] text-ink2">기록 있는 팀원 {teamN} / {team.length}명</span></CardHead>
        <table className="w-full text-[12px]">
          <thead className="border-b border-border bg-panel-alt"><tr><th className="px-3 py-2 text-left text-[11.5px] text-ink3">팀원</th><th className="px-3 py-2 text-right text-[11.5px] text-ink3">기록한 날</th><th className="px-3 py-2 text-right text-[11.5px] text-ink3">업무</th><th className="px-3 py-2 text-right text-[11.5px] text-ink3">완료</th><th /></tr></thead>
          <tbody>
            {team.length ? team.map((x) => (
              <tr key={x.who} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2"><span className="flex items-center gap-1.5"><Avatar name={people.nameOf(x.who) || '?'} />{x.rs.length ? <b>{people.labelOf(x.who)}</b> : <span className="text-ink3">{people.labelOf(x.who)}</span>}</span></td>
                {x.rs.length ? <>
                  <td className="px-3 py-2 text-right">{new Set(x.rs.map((r) => r.d)).size}일</td>
                  <td className="px-3 py-2 text-right">{x.rs.length}건</td>
                  <td className="px-3 py-2 text-right">{x.rs.filter((r) => r.done).length}건</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="secondary" onClick={() => setTeamOf(x)}>보기</Button></td>
                </> : <td colSpan={4} className="px-3 py-2 text-[11.5px] text-ink3">이 주에 기록 없음</td>}
              </tr>
            )) : <tr><td colSpan={5}><EmptyHint title="이 사업 업무 목록에 담당자가 없습니다" hint="업무 목록에서 업무 담당을 정하면 그 사람들의 업무계획 기록이 여기 모입니다." /></td></tr>}
          </tbody>
        </table>
      </section>

      <section className={`${sec} px-6 py-5 [&_.foot]:mt-4 [&_.foot]:text-right [&_.foot]:text-[11px] [&_.foot]:text-ink3 [&_.pre]:whitespace-pre-wrap [&_.sub]:mb-3 [&_.sub]:text-center [&_.sub]:text-[12px] [&_.sub]:text-ink3 [&_h1]:text-center [&_h1]:text-[19px] [&_h1]:font-extrabold [&_h1]:tracking-wider [&_h1]:text-ink [&_h4]:mb-1.5 [&_h4]:mt-4 [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-ink [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px] [&_td]:border [&_td]:border-border-hi [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-border-hi [&_th]:bg-panel-alt [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-ink2`}
        dangerouslySetInnerHTML={{ __html: body }} />

      {teamOf && (
        <Modal open onClose={() => setTeamOf(null)} width={820} title={`${people.labelOf(teamOf.who)} · 업무 기록 ${teamOf.rs.length}건`}
          footer={<><span className="flex-1" /><Button variant="secondary" onClick={() => setTeamOf(null)}>닫기</Button></>}>
          <p className="mb-2 text-[12px] text-ink3">{monthDay(R.ws)} ~ {monthDay(R.we)} · 업무계획 · 일일 업무 보고에서 자동으로 모은 기록입니다 (비고 = 그날 한 일)</p>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border bg-panel-alt"><tr><th className="w-[90px] px-3 py-2 text-left">일자</th><th className="px-3 py-2 text-left">업무</th><th className="px-3 py-2 text-left">비고 (한 일)</th><th className="w-[70px] px-3 py-2 text-right">진행</th><th className="w-[60px] px-3 py-2 text-right">시간</th></tr></thead>
              <tbody>{teamOf.rs.map((r, i) => <tr key={i} className="border-b border-border last:border-b-0"><td className="px-3 py-1.5">{monthDay(r.d)}</td><td className="px-3 py-1.5">{r.c}</td><td className="px-3 py-1.5 text-ink2">{r.n || '-'}</td><td className="px-3 py-1.5 text-right">{r.p}</td><td className="px-3 py-1.5 text-right">{r.h ? `${r.h}h` : '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
