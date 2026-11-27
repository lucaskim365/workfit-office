import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { monthDay } from '@/domain/pm/rules';
import {
  WD, dayLabel, pdfFileName, pdfRowsClean, pdfToPlanApply, planAddGroups, planDay, planEditable, planReps, teamPlanStatus, reportRows, pDone, planApText, planText,
  type PlanCtx,
} from '@/domain/pm/plan';
import { DEV_TEAM_DEPT } from '@/domain/pm/team';
import type { PmPlanItem } from '@/domain/pm/schema';
import type { usePmMutations, usePmSiteMutations } from '@/features/pm/usePm';
import { planDayEdit, planHas } from '@/features/pm/usePmPlan';
import type { PmPerson, usePmPeople } from '../../usePmPeople';
import { ProjectTag, Tag } from '../wbs/parts';
import { copyText, pdfOpen, pdfPage } from './planPdf';

/**
 * 업무계획 팝업 — 날짜별 추가 (planAddForm) · 반복 업무 (planRepForm) · 글 복사 (planReport · planCopy) ·
 * 일일 업무 보고 PDF (planPdfForm) · 팀 일일 보고 모아 받기 (teamPdfForm). 데모 그대로.
 */
type Mut = ReturnType<typeof usePmMutations>;
type SMut = ReturnType<typeof usePmSiteMutations>;
type People = ReturnType<typeof usePmPeople>;
const inp = 'rounded border border-border-hi bg-panel px-2 py-1 text-[12px]';
const nowAt = (today: string) => `${monthDay(today)} ${new Date().toTimeString().slice(0, 5)}`;

/** 날짜별 [+ 추가] — 내 세부 작업 · 이 날 진행 중 · 지연 · 곧 시작(2주 내) 업무 + 직접 입력 */
export function PlanAddModal({ C, me, date, shortOf, mut, onDone, onClose }: {
  C: PlanCtx; me: string; date: string; shortOf: (id: string) => string; mut: Mut; onDone: (m: string) => void; onClose: () => void;
}) {
  const cur = planDay(C, me, date);
  const G = planAddGroups(C, me, date, cur);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [free, setFree] = useState('');
  const [err, setErr] = useState('');
  const tog = (s: Set<string>, set: (v: Set<string>) => void, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); set(n); };
  const go = () => {
    const txt = free.trim();
    const add: PmPlanItem[] = [
      ...G.subs.filter((x) => subs.has(x.s.id)).map(({ taskId, s }) => ({ taskId, subId: s.id })),
      ...[...keys].map((taskId) => ({ taskId })),
      ...(txt ? [{ text: txt }] : []),
    ];
    if (!add.length) { setErr('추가할 업무를 고르거나 직접 입력해 주세요'); return; }
    // G2: 최신 목록에 없는 것만 더함 (두 번 눌림 · 그사이 같은 일이 들어간 경우)
    mut.setPlanDay.mutate({ make: planDayEdit(me, date, (a) => { const n = add.filter((x) => !planHas(a, x)); if (!n.length) return false; a.push(...n); }) });
    onDone(`${monthDay(date)} 계획에 ${add.length}건 추가`);
    onClose();
  };
  const row = 'grid cursor-pointer grid-cols-[22px_86px_1fr_96px] items-center gap-2 border-b border-border/60 px-1 py-1.5 text-[12px]';
  return (
    <Modal open onClose={onClose} title={`업무계획 추가 — ${dayLabel(date)}`} width={760}
      footer={<><span className="flex-1 text-[11.5px] text-danger">{err}</span><Button onClick={onClose}>취소</Button><Button variant="primary" onClick={go}>추가</Button></>}>
      <div className="max-h-[46vh] overflow-auto">
        {G.subs.length > 0 && <div className="mb-1 mt-2 text-[12px] font-bold">내 세부 작업 <span className="text-ink3">{G.subs.length}</span></div>}
        {G.subs.map(({ taskId, s }) => { const t = C.task(taskId)!; return (
          <label key={s.id} className={row}>
            <input type="checkbox" checked={subs.has(s.id)} onChange={() => tog(subs, setSubs, s.id)} />
            <span><ProjectTag>{shortOf(t.projectId)}</ProjectTag></span>
            <span className="min-w-0 truncate"><span className="text-ink3">{t.name} –</span> <b>{s.text}</b></span>
            <span className="text-right text-[11px] text-ink3">{s.due ? `~${monthDay(s.due)}` : ''}</span>
          </label>
        ); })}
        {G.groups.map(([nm, ts]) => (
          <div key={nm}>
            <div className="mb-1 mt-2.5 text-[12px] font-bold">{nm} <span className="text-ink3">{ts.length}</span></div>
            {ts.map((t) => (
              <label key={t.id} className={row}>
                <input type="checkbox" checked={keys.has(t.id)} onChange={() => tog(keys, setKeys, t.id)} />
                <span><ProjectTag>{shortOf(t.projectId)}</ProjectTag></span>
                <span className="min-w-0 truncate" title={t.name}>{t.name}{t.subAssigneeIds.includes(me) && <> <Tag>부</Tag></>}</span>
                <span className={`text-right text-[11px] ${t.end < date ? 'text-danger' : 'text-ink3'}`}>{monthDay(t.start)}~{monthDay(t.end)}</span>
              </label>
            ))}
          </div>
        ))}
        {!G.subs.length && !G.groups.length && <div className="py-6 text-center text-[12px] text-ink3">추가할 수 있는 내 업무가 없습니다 — 업무 목록에서 나를 담당으로 넣고 시작 · 종료일을 정하면 여기 나옵니다</div>}
      </div>
      <div className="mb-1.5 mt-3.5 text-[12px] font-bold">직접 입력 <span className="font-normal text-ink3">회의 · 출장 · 도입기업 대응 등</span></div>
      <input className={`${inp} w-full`} value={free} onChange={(e) => setFree(e.target.value)} placeholder="예: 효광 현장 미팅"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) go(); }} />
    </Modal>
  );
}

/** 반복 업무 — 정한 요일마다 업무계획에 자동으로 */
export function PlanRepModal({ C, me, smut, onDone, onClose }: { C: PlanCtx; me: string; smut: SMut; onDone: (m: string) => void; onClose: () => void }) {
  const reps = planReps(C, me);
  const [wd, setWd] = useState<number[]>([]);
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  const add = () => {
    const t = txt.trim();
    if (!wd.length || !t) { setErr('요일과 업무 이름을 입력해 주세요'); return; }
    smut.addPlanRep.mutate({ wd: [...wd].sort(), text: t });
    setTxt(''); setWd([]); setErr('');
    onDone(`반복 업무 '${t}' 추가`);
  };
  return (
    <Modal open onClose={onClose} title="반복 업무" width={520}
      footer={<><span className="flex-1 text-[11.5px] text-danger">{err}</span><Button onClick={onClose}>닫기</Button><Button variant="primary" onClick={add}>추가</Button></>}>
      <p className="mb-2.5 text-[11.5px] text-ink3">정한 요일마다 업무계획에 자동으로 들어갑니다. 예: 월요일 주간회의, 금요일 주간보고 작성</p>
      {reps.map((r, i) => (
        <div key={`${r.text}${i}`} className="flex items-center gap-2 border-b border-border/60 py-1.5 text-[12px]">
          <span className="flex-1">{r.text}</span>
          <span className="text-[11px] text-ink3">매주 {r.wd.map((w) => WD[w]).join('·')}</span>
          <Button size="sm" variant="ghost" onClick={() => smut.removePlanRep.mutate(i)}>지우기</Button>
        </div>
      ))}
      {!reps.length && <div className="py-1.5 text-[12px] text-ink3">등록된 반복 업무가 없습니다</div>}
      <div className="mb-1.5 mt-4 text-[12px] font-bold">새 반복 업무</div>
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((w) => (
          <label key={w} className="flex cursor-pointer items-center gap-1 text-[12px]">
            <input type="checkbox" checked={wd.includes(w)} onChange={(e) => setWd(e.target.checked ? [...wd, w] : wd.filter((x) => x !== w))} />{WD[w]}
          </label>
        ))}
      </div>
      <input className={`${inp} mt-2 w-full`} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="예: 주간회의"
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add(); }} />
    </Modal>
  );
}

/** 글 보기 · 고쳐서 복사 (업무보고 · 2주 계획) */
export function PlanTextModal({ title, text, hint, onClose, onDone }: { title: string; text: string; hint: string; onClose: () => void; onDone: (m: string, bad?: boolean) => void }) {
  const [v, setV] = useState(text);
  return (
    <Modal open onClose={onClose} title={title} width={720}
      footer={<><span className="flex-1 text-[11px] text-ink3">{hint}</span><Button onClick={onClose}>닫기</Button>
        <Button variant="primary" onClick={async () => onDone((await copyText(v)) ? '복사했습니다' : '복사하지 못했습니다 — 글을 직접 선택해 복사해 주세요', false)}>복사</Button></>}>
      <textarea className={`${inp} h-[48vh] w-full font-[inherit]`} value={v} onChange={(e) => setV(e.target.value)} />
    </Modal>
  );
}

type Row = [string, string, string];

/**
 * 일일 업무 보고 PDF — 그날 계획(또는 임시저장본)으로 표를 채우고 고쳐서 인쇄.
 * [임시저장] · [오늘 할 일에 추가](pdfToPlan) · [계획에서 다시 채우기](pdfRefill).
 */
export function PlanPdfModal({ C, me, person, shortOf, mut, smut, onDone, onClose }: {
  C: PlanCtx; me: string; person: PmPerson | undefined; shortOf: (id: string) => string; mut: Mut; smut: SMut; onDone: (m: string, bad?: boolean) => void; onClose: () => void;
}) {
  const today = C.today;
  const fill = (d: string, fresh = false) => {
    const dr = !fresh ? C.draft(me, d) : undefined;
    const its = [...planDay(C, me, d)].sort((a, b) => (pDone(C, b) ? 1 : 0) - (pDone(C, a) ? 1 : 0));
    const rows: Row[] = dr ? dr.rows.map((r) => [...r] as Row) : its.map((it) => [planText(C, it, shortOf), it.memo ?? '', planApText(C, it)]);
    return { rows: rows.length ? rows : [['', '', ''] as Row], dr };
  };
  const [date, setDate] = useState(today);
  const [dept, setDept] = useState(C.draft(me, today)?.dept ?? person?.dept ?? '');
  const [name, setName] = useState(C.draft(me, today)?.name ?? person?.name ?? '');
  const [{ rows, dr }, setF] = useState(() => fill(today));
  const [err, setErr] = useState('');
  const setCell = (i: number, j: number, v: string) => setF((f) => ({ ...f, rows: f.rows.map((r, k) => (k === i ? (r.map((x, m) => (m === j ? v : x)) as Row) : r)) }));
  const label = date === today ? '오늘 할 일' : `${monthDay(date)} 계획`;
  const saveDraft = () => { smut.savePdfDraft.mutate({ date, dept: dept.trim(), name: name.trim(), rows: pdfRowsClean(rows), at: nowAt(today) }); };
  const changeDate = (v: string) => { if (!v) return; setDate(v); const f = fill(v); setF(f); if (f.dr) { setDept(f.dr.dept); setName(f.dr.name); } };
  const print = () => {
    if (!dept.trim()) { setErr('부서를 입력해 주세요'); return; }
    const R = pdfRowsClean(rows);
    if (!R.length) { setErr('업무 내용을 한 줄 이상 입력해 주세요'); return; }
    saveDraft();
    if (!pdfOpen(pdfFileName(dept.trim(), name.trim(), date), [pdfPage(date, dept.trim(), name.trim(), R)])) onDone('팝업이 막혀 있습니다. 주소창 오른쪽에서 팝업을 허용해 주세요', true);
  };
  const toPlan = () => {
    const r = pdfToPlanApply(C, planEditable(C, me, date), pdfRowsClean(rows), shortOf);
    if (!r) { setErr('추가하거나 바꿀 업무가 없습니다 (이미 모두 같음)'); return; }
    // G2: 차례 때 최신 목록에서 다시 계산 — 두 번 눌러도 이미 같으면 안 씀
    const R2 = pdfRowsClean(rows);
    mut.setPlanDay.mutate({ make: planDayEdit(me, date, (a, C2) => { const x = pdfToPlanApply(C2, a, R2, shortOf); if (!x) return false; a.splice(0, a.length, ...x.items); }) });
    onDone(`${label}에 ${[r.add ? `${r.add}건 추가` : '', r.upd ? `${r.upd}건 진행률 반영` : ''].filter(Boolean).join(' · ')}했습니다`);
  };
  const refill = () => {
    if (!confirm('임시저장본을 지우고 계획 내용으로 다시 채울까요?')) return;
    smut.removePdfDraft.mutate(date);
    setF(fill(date, true));
  };
  return (
    <Modal open onClose={onClose} title="일일 업무 보고 PDF" width={900}
      footer={<>
        <span className="flex-1 text-[11px] text-ink3">{err ? <span className="text-danger">{err}</span> : "인쇄 창에서 대상을 'PDF로 저장'으로 고르세요 · PDF로 저장할 때도 자동 임시저장"}</span>
        <Button onClick={onClose}>닫기</Button>
        <Button onClick={() => { saveDraft(); onDone(`${monthDay(date)} 보고를 임시저장했습니다`); }}>임시저장</Button>
        <Button variant="primary" onClick={print}>PDF로 저장</Button>
      </>}>
      <div className="mb-3 flex flex-wrap gap-2.5 text-[12px]">
        <label className="flex items-center gap-1.5">일자 <input type="date" className={inp} value={date} onChange={(e) => changeDate(e.target.value)} title="날짜를 바꾸면 그날 계획으로 다시 채웁니다" /></label>
        <label className="flex items-center gap-1.5">부서 <input className={`${inp} w-[150px]`} value={dept} onChange={(e) => setDept(e.target.value)} placeholder="예: 개발팀" /></label>
        <label className="flex items-center gap-1.5">작성자 <input className={`${inp} w-[100px]`} value={name} onChange={(e) => setName(e.target.value)} /></label>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr className="bg-panel-alt text-[11px] text-ink3"><th className="w-[44px] p-1.5">순번</th><th className="w-[32%] p-1.5 text-left">업무 내용</th><th className="p-1.5 text-left">비고</th><th className="w-[90px] p-1.5">진행상태</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="p-1 text-center">{i + 1}</td>
              {[0, 1, 2].map((j) => <td key={j} className="p-1"><input className={`${inp} w-full ${j === 2 ? 'text-right' : ''}`} value={r[j]} onChange={(e) => setCell(i, j, e.target.value)} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => setF((f) => ({ ...f, rows: [...f.rows, ['', '', '']] }))}>+ 줄 추가</Button>
        <Button size="sm" onClick={toPlan} title="표의 업무 중 그날 할 일에 없는 것은 진행률과 함께 추가하고, 이미 있는 직접 쓴 업무는 진행률을 맞춥니다 (비고는 빼고 · 업무 목록 업무 진행률은 할 일 화면에서)">＋ {label}에 추가</Button>
        <span className="flex-1 text-right text-[11px] text-ink3">
          {dr ? <><b className="text-ok">임시저장본 ({dr.at})</b>을 불러왔습니다 · <button type="button" className="underline" onClick={refill}>계획에서 다시 채우기</button></> : `${label}에서 채웠습니다 · 고친 내용은 [임시저장]을 눌러야 남습니다`} · 비워 둔 줄은 PDF에서 빠집니다
        </span>
      </div>
    </Modal>
  );
}

/** 팀 일일 보고 모아 받기 (팀장용) — 같은 부서 사람(없으면 개발팀), 작성함 = 직접 고친 날 · 임시저장 */
export function TeamPdfModal({ C, me, people, shortOf, onDone, onClose }: {
  C: PlanCtx; me: string; people: People; shortOf: (id: string) => string; onDone: (m: string, bad?: boolean) => void; onClose: () => void;
}) {
  const myDept = people.people.find((p) => p.id === me)?.dept || DEV_TEAM_DEPT;
  const ms = people.people.filter((p) => p.dept === myDept);
  const [d, setD] = useState(C.today);
  const st = ms.map((u) => ({ u, ...teamPlanStatus(C, u.id, d) }));
  const [pick, setPick] = useState<Set<string> | null>(null);
  const sel = pick ?? new Set(st.filter((x) => x.own).map((x) => x.u.id));
  const go = () => {
    const who = [...sel];
    if (!who.length) { onDone('PDF에 넣을 팀원을 골라 주세요', true); return; }
    const ok = pdfOpen(`${myDept} 팀 일일업무보고_${d.slice(2).replace(/-/g, '')}`, who.map((id) => {
      const u = people.people.find((p) => p.id === id);
      return pdfPage(d, C.draft(id, d)?.dept || u?.dept || myDept, C.draft(id, d)?.name || u?.name || '', reportRows(C, id, d, shortOf));
    }));
    onDone(ok ? `${who.length}명 보고를 한 PDF로 묶었습니다` : '팝업이 막혀 있습니다. 주소창 오른쪽에서 팝업을 허용해 주세요', !ok);
  };
  const th = 'px-2 py-1.5 text-[11px] font-bold text-ink3';
  return (
    <Modal open onClose={onClose} title="팀 일일 보고 모아 받기" width={720}
      footer={<><span className="flex-1 text-[11px] text-ink3">인쇄 창에서 대상을 'PDF로 저장'으로 고르세요</span><Button onClick={onClose}>닫기</Button><Button variant="primary" onClick={go}>팀 PDF로 저장</Button></>}>
      <div className="mb-3 flex items-center gap-2.5 text-[12px]">
        <label className="flex items-center gap-1.5">일자 <input type="date" className={inp} value={d} onChange={(e) => { setD(e.target.value || C.today); setPick(null); }} /></label>
        <span className="text-ink3">{myDept} {ms.length}명 중 <b className="text-ink">{st.filter((x) => x.own).length}명</b> 작성</span>
      </div>
      <table className="w-full text-[12px]">
        <thead><tr className="border-b border-border"><th className={`${th} w-[36px]`} /><th className={`${th} text-left`}>팀원</th><th className={`${th} text-left`}>상태</th><th className={`${th} text-right`}>할 일</th><th className={`${th} text-right`}>완료</th><th className={`${th} text-right`}>메모</th></tr></thead>
        <tbody>
          {st.map((x) => (
            <tr key={x.u.id} className="border-b border-border/60">
              <td className="px-2 py-1.5"><input type="checkbox" checked={sel.has(x.u.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(x.u.id); else n.delete(x.u.id); setPick(n); }} /></td>
              <td className="px-2 py-1.5"><b>{x.u.label}</b></td>
              <td className="px-2 py-1.5">{x.own ? <Tag tone="ok">작성함</Tag> : x.n ? <Tag tone="warn" title="업무 기간에 맞춘 자동 초안만 있고 본인이 고친 적이 없습니다">아직 안 씀 (자동 초안)</Tag> : <Tag tone="bad">계획 없음</Tag>}</td>
              <td className="px-2 py-1.5 text-right">{x.n}</td><td className="px-2 py-1.5 text-right">{x.done}</td><td className="px-2 py-1.5 text-right">{x.memo}</td>
            </tr>
          ))}
          {!st.length && <tr><td colSpan={6} className="py-6 text-center text-ink3">같은 부서로 등록된 팀원이 없습니다</td></tr>}
        </tbody>
      </table>
      <p className="mt-2.5 text-[11px] text-ink3">체크한 사람만 한 사람당 한 장씩 한 PDF로 묶습니다. 기본은 '작성함'인 사람만 체크되어 있습니다.</p>
    </Modal>
  );
}
