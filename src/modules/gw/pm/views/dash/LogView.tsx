import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { addDays, monthDay, shortName } from '@/domain/pm/rules';
import { weekStart } from '@/domain/pm/site';
import { WD, planLogRows, workRec, type WorkRec } from '@/domain/pm/plan';
import { hourText } from '@/domain/pm/team';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPlanCtx } from '@/features/pm/usePmPlan';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { EmptyHint } from '../wbs/parts';
import { CardHead, ScreenHead } from './parts';

/**
 * 대시보드 › 업무 기록 · 과제 수행일지 (doc/log, 데모 docLog 4293) — 3-7. 메뉴 탭에 없는 화면:
 * 내 업무 [지난 기록] · 업무계획 [지난 기록 · 수행일지] · 검색으로 들어온다.
 * 업무 기록 = 업무계획 · 일일 업무 보고에 쓴 것 / 과제 수행일지 = '시간' 칸에 적은 업무 (인건비 증빙) / 완료 업무 보고서 = 완료 티켓.
 */
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const th = 'px-3 py-2 text-left text-[11px] font-bold text-ink3 whitespace-nowrap';
const td = 'px-3 py-2 align-top text-[12px]';
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function LogView() {
  const people = usePmPeople();
  const { me } = people;
  const d = usePmDerived(people.nameOf);
  const C = usePmPlanCtx(d);
  const mut = usePmMutations(me, people.nameOf);
  const [, setParams] = useSearchParams();
  const [who, setWho] = useState('');
  const [off, setOff] = useState(0);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const logs = useMemo(() => (C ? planLogRows(C, shortOf) : []), [C]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d || !C) return <EmptyHint title="업무 기록을 불러오는 중입니다" />;
  if (!people.people.length) return <EmptyHint title="등록된 사용자가 없습니다" />;
  const w = people.people.some((p) => p.id === who) ? who : me;
  const ws = weekStart(d.today, off);
  const we = addDays(ws, 6);
  const mine = logs.filter((l) => l.who === w && l.date >= ws && l.date <= we).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sum = mine.reduce((a, l) => a + l.hours, 0);
  const done = d.snap.tickets.filter((x) => x.assigneeId === w && x.status === '완료');
  const coOf = (id: string) => d.snap.projects.find((p) => p.id === id)?.company ?? '';
  const tname = (l: (typeof mine)[number]) => { const t = d.taskMap.get(l.taskId); return t ? `[${shortOf(t.projectId)} ${t.code}] ${t.name}` : l.title || '-'; };
  const recs: Array<WorkRec & { d: string }> = [];
  for (let x = ws; x <= we; x = addDays(x, 1)) for (const r of workRec(C, w, x, shortOf)) recs.push({ ...r, d: x });
  // 투입 = 그 티켓 · 그 업무에 적은 시간 (데모: l.tk===x.no || l.key===x.key)
  const tkHours = (no: string, taskId: string) => logs.filter((l) => l.ticketNo === no || (!!taskId && l.taskId === taskId)).reduce((a, l) => a + l.hours, 0);
  const label = people.labelOf(w);
  const range = `${ws.replace(/-/g, '.')} ~ ${we.replace(/-/g, '.')}`;

  // 인쇄 / PDF — 과제 수행일지 · 완료 업무 보고서 두 장 (데모는 화면 인쇄, 여기선 그룹웨어 틀 없이 보고서만 새 창으로)
  const print = () => {
    const logT = `<h1>과제 수행일지</h1><div class="sub">${esc(label)} · ${range}</div><table><tr><th style="width:95px">일자</th><th>사업</th><th>수행 내용</th><th style="width:50px">시간</th></tr>${mine.map((l) => `<tr><td>${l.date}</td><td>${esc(coOf(l.projectId))}</td><td>${esc(tname(l))} — ${esc(l.content)}</td><td class="r">${l.hours}h</td></tr>`).join('') || '<tr><td colspan="4">기록 없음</td></tr>'}<tr><th colspan="3" class="r">합계</th><th>${sum}h</th></tr></table>`;
    const doneT = `<h1>완료 업무 보고서</h1><div class="sub">${esc(label)} · 완료(PM 승인) 티켓 기준</div><table><tr><th>사업</th><th>업무 번호 · 이름</th><th>산출물</th><th>투입</th></tr>${done.map((x) => `<tr><td>${esc(coOf(x.projectId))}</td><td>${esc(x.code)} ${esc(x.title)}</td><td>${x.files.map((f) => esc(f.name)).join('<br>') || '-'}</td><td class="r">${tkHours(x.no, x.taskId)}h</td></tr>`).join('') || '<tr><td colspan="4">완료 티켓 없음</td></tr>'}</table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>과제수행일지_${esc(people.nameOf(w))}_${ws.slice(2).replace(/-/g, '')}</title><style>
      @page{size:A4;margin:16mm 14mm} body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#222;font-size:10pt;margin:0}
      section + section{page-break-before:always} h1{font-size:16pt;margin:0 0 4px} .sub{color:#555;margin-bottom:10px}
      table{width:100%;border-collapse:collapse} td,th{border:1px solid #444;padding:5px 6px;vertical-align:top} th{background:#eef2f7} .r{text-align:right}
    </style></head><body><section>${logT}<div style="color:#666;font-size:9pt;margin-top:8px">※ 오늘 할 일에 적은 시간(선택)으로 자동 생성 · 인건비 증빙용</div></section><section>${doneT}</section></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) { alert('팝업이 막혀 인쇄 창을 열 수 없습니다. 브라우저 주소창의 팝업 허용을 눌러 주세요'); return; }
    win.document.open(); win.document.write(html); win.document.close();
    win.onafterprint = () => win.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  };

  return (
    <div className="space-y-4">
      <ScreenHead title="업무 기록 · 과제 수행일지" desc="업무계획 · 일일 업무 보고에 쓴 내용이 자동으로 쌓이고, 시간을 적은 업무로 과제 수행일지를 만듭니다">
        <Button size="sm" variant="secondary" onClick={() => setParams(new URLSearchParams({ v: 'dash/my' }))}>← 내 업무</Button>
      </ScreenHead>

      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded border border-border bg-panel px-2 py-1 text-[12px]" value={w} onChange={(e) => setWho(e.target.value)} aria-label="사람">
          {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <Button size="sm" variant="secondary" onClick={() => setOff((o) => o - 1)} title="지난주">이전 주</Button>
        <b className="text-[12px] tabular-nums">{ws} ~ {we}</b>
        <Button size="sm" variant="secondary" onClick={() => setOff((o) => o + 1)} title="다음 주">다음 주</Button>
        {off !== 0 && <Button size="sm" variant="secondary" onClick={() => setOff(0)}>이번 주</Button>}
        <span className="text-[12px] text-ink3">합계 <b className="text-ink">{sum}h</b></span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onClick={print}>인쇄 / PDF</Button>
      </div>

      <section className={sec}>
        <CardHead title="업무 기록"><span className="text-[11px] text-ink3">업무계획 · 일일 업무 보고에서 자동으로 쌓입니다 (비고 = 그날 한 일)</span></CardHead>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-panel-alt"><tr>
              <th className={`${th} w-[90px]`}>일자</th><th className={th}>업무</th><th className={th}>비고 (한 일)</th><th className={`${th} w-[70px] text-right`}>진행</th><th className={`${th} w-[60px] text-right`}>시간</th>
            </tr></thead>
            <tbody>
              {recs.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className={`${td} whitespace-nowrap tabular-nums`}>{monthDay(r.d)} ({WD[new Date(`${r.d}T00:00:00`).getDay()]})</td>
                  <td className={`${td} ${r.done ? 'text-ink' : 'text-ink3'}`}>
                    {r.done ? '✓ ' : ''}
                    {r.taskId && d.taskMap.has(r.taskId)
                      ? <button type="button" className="text-left hover:underline" onClick={() => modals.openTask(r.taskId)} title="업무 보기">{r.c}</button>
                      : r.c}
                  </td>
                  <td className={td}>{r.n || <span className="text-ink3">-</span>}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.p}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.h ? hourText(r.h) : <span className="text-ink3">-</span>}</td>
                </tr>
              ))}
              {!recs.length && <tr><td colSpan={5}><EmptyHint title="이 주에 업무계획 · 일일 보고 기록이 없습니다" hint="업무계획 '오늘 할 일'에서 고치거나 일일 업무 보고를 임시저장하면 여기 쌓입니다." /></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={sec}>
          <CardHead title="과제 수행일지"><span className="text-[11px] text-ink3">{label} · {range}</span></CardHead>
          <table className="w-full">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={`${th} w-[95px]`}>일자</th><th className={th}>사업</th><th className={th}>수행 내용</th><th className={`${th} w-[50px] text-right`}>시간</th></tr></thead>
            <tbody>
              {mine.map((l, i) => (
                <tr key={i} className="border-b border-border">
                  <td className={`${td} tabular-nums`}>{l.date}</td><td className={td}>{coOf(l.projectId) || <span className="text-ink3">사내 · 기타</span>}</td>
                  <td className={td}>{tname(l)}{l.content ? ` — ${l.content}` : ''}</td><td className={`${td} text-right tabular-nums`}>{l.hours}h</td>
                </tr>
              ))}
              {!mine.length && <tr><td colSpan={4} className={`${td} text-ink3`}>기록 없음 — 업무계획 '오늘 할 일'에서 시간을 적은 업무가 여기 나옵니다</td></tr>}
              <tr className="bg-panel-alt"><th colSpan={3} className={`${th} text-right`}>합계</th><th className={`${th} text-right`}>{sum}h</th></tr>
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-ink3">※ 오늘 할 일에 적은 시간(선택)으로 자동 생성 · 인건비 증빙용</p>
        </section>
        <section className={sec}>
          <CardHead title="완료 업무 보고서"><span className="text-[11px] text-ink3">{label} · 완료(PM 승인) 티켓 기준</span></CardHead>
          <table className="w-full">
            <thead className="border-b border-border bg-panel-alt"><tr><th className={th}>사업</th><th className={th}>업무 번호 · 이름</th><th className={th}>산출물</th><th className={`${th} text-right`}>투입</th></tr></thead>
            <tbody>
              {done.map((x) => (
                <tr key={x.no} className="border-b border-border last:border-b-0">
                  <td className={td}>{coOf(x.projectId)}</td>
                  <td className={td}><button type="button" className="text-left hover:underline" onClick={() => modals.openTicket(x.no)} title="티켓 보기">{x.code} {x.title}</button></td>
                  <td className={`${td} text-[11.5px]`}>{x.files.map((f) => <div key={f.name}>{f.name}</div>)}{!x.files.length && '-'}</td>
                  <td className={`${td} text-right tabular-nums`}>{tkHours(x.no, x.taskId)}h</td>
                </tr>
              ))}
              {!done.length && <tr><td colSpan={4} className={`${td} text-ink3`}>완료 티켓 없음</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
      {modals.node}
    </div>
  );
}
