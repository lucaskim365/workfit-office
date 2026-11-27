import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { liveOf, monthDay, shortName } from '@/domain/pm/rules';
import {
  HOURS, PCTS, carryText, dayLabel, isWeekend, pDone, planAll, planCopyText, planDay, planH, planItP, planPickTasks, planRecentTexts,
  planReportText, planSuggest, planText, planWeeks, subCount, type PlanCtx, type PlanSug,
} from '@/domain/pm/plan';
import { hourText } from '@/domain/pm/team';
import type { PmPlanItem, PmTask } from '@/domain/pm/schema';
import { usePmDerived, usePmMutations, usePmSiteMutations, type PmDerived } from '@/features/pm/usePm';
import { planAt, planDayEdit, planHas, planKey, usePmPlanCtx } from '@/features/pm/usePmPlan';
import { usePmPeople } from '../../usePmPeople';
import { usePmModals } from '../ticket/usePmModals';
import { SubtaskBox } from '../wbs/TaskDetailModal';
import { EmptyHint, MiniBar, ProjectTag, Tag } from '../wbs/parts';
import { CardHead, ScreenHead } from '../dash/parts';
import { usePmShell } from '../../ui/PmShell';
import { PlanAddModal, PlanPdfModal, PlanRepModal, PlanTextModal, TeamPdfModal } from './PlanModals';

/**
 * 대시보드 › 업무계획 (pPlan 5502) — 3-6단계. 데모 그대로 PM 안 (그룹웨어 업무계획 앱과 따로, 11/25 사용자).
 * 오늘 할 일(추천 · 체크 · 진행률 · 시간 · 메모 · 쪼개기 · 빠른 입력) + 이번 주 · 다음 주 계획(업무 기간에 맞춘 자동 초안).
 */
const sec = 'rounded-xl border border-border bg-panel shadow-sm';
const sel = 'h-7 flex-none rounded border border-border-hi bg-panel px-1 text-[11.5px]';

type Pop =
  | { k: 'add'; date: string }
  | { k: 'rep' }
  | { k: 'text'; title: string; text: string; hint: string }
  | { k: 'pdf' }
  | { k: 'team' };

/** 팀 보고 모아 받기를 보이는 사람 (데모: 역할 팀장 · 관리자 · PM) — 직책·직급에 '팀장'이 있거나 사업 PM */
export function canTeamPdf(me: string, people: ReturnType<typeof usePmPeople>, d: PmDerived): boolean {
  const u = people.people.find((p) => p.id === me);
  if (u && /팀장/.test(`${u.jobTitle} ${u.position}`)) return true;
  return d.snap.projects.some((p) => p.pmUserId === me || (!!p.pmName && people.idByName(p.pmName) === me));
}

export function PlanView() {
  const shell = usePmShell();
  const people = usePmPeople();
  const { me } = people;
  const d = usePmDerived(people.nameOf);
  const C = usePmPlanCtx(d);
  const mut = usePmMutations(me, people.nameOf);
  const smut = usePmSiteMutations(me);
  const shortOf = (id: string) => { const p = d?.snap.projects.find((x) => x.id === id); return p ? shortName(p, d!.snap.projects) : id; };
  const modals = usePmModals({ d, people, mut, shortOf });
  const [pop, setPop] = useState<Pop | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [weeksOpen, setWeeksOpen] = useState(true);
  const all = useMemo(() => (C && me ? planAll(C, me) : null), [C, me]);

  if (!d || !C || !all) return <EmptyHint title="업무계획을 불러오는 중입니다" />;
  if (!me) return <EmptyHint title="로그인한 사용자를 알 수 없습니다" hint="그룹웨어에 다시 로그인하면 내 업무계획이 나옵니다." />;
  const say = (text: string, bad?: boolean) => setMsg({ text, bad });
  /**
   * 그날 계획 고치기 (planMut) — 고치는 순간 그날은 저장되고 자동 초안 표시가 떨어짐.
   * G2: fn 은 저장 차례 때 저장소의 최신 그날 목록 a 에 적용됨. 화면 줄 i 는 at(i) 로 최신 목록의 자리(줄 열쇠)로 바꿔 씀.
   */
  const edit = (date: string, fn: (a: PmPlanItem[], at: (i: number) => number) => void | false) => {
    const screen = planDay(C, me, date, all);
    mut.setPlanDay.mutate({ make: planDayEdit(me, date, (a) => fn(a, (i) => planAt(a, planKey(screen, i)))) });
  };

  const weeks = planWeeks(d.today);
  const head = (
    <ScreenHead title="업무계획" desc={`${people.labelOf(me)} · 업무 기간에 맞춰 미리 채운 계획을 그날 고쳐 쓰고, 큰 업무는 세부 작업으로 쪼개 시간을 나눕니다`}>
      <Button size="sm" onClick={() => shell?.go({ kind: 'view', v: 'doc/log' })} title="지난 업무 기록과 과제 수행일지(인건비 증빙)">지난 기록 · 수행일지</Button>
    </ScreenHead>
  );

  return (
    <div className="space-y-3">
      {head}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${msg.bad ? 'border-danger/30 bg-danger/5 text-danger' : 'border-teal/30 bg-teal-soft/30 text-ink'}`}>
          <span className="flex-1">{msg.text}</span>
          <Button size="sm" variant="ghost" onClick={() => setMsg(null)}>닫기</Button>
        </div>
      )}
      {!isWeekend(d.today) && (
        <TodayCard C={C} d={d} all={all} me={me} people={people} mut={mut} smut={smut} shortOf={shortOf} edit={edit} say={say}
          onOpenTask={modals.openTask} onOpenTicket={modals.openTicket} onPop={setPop} teamPdf={canTeamPdf(me, people, d)} />
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2 px-0.5 py-1.5">
          <button type="button" className="text-[12.5px] font-bold text-ink" onClick={() => setWeeksOpen((o) => !o)}>{weeksOpen ? '▾' : '▸'} 이번 주 · 다음 주 계획</button>
          <span className="text-[11px] text-ink3">업무 기간에 맞춰 미리 채워 둠 · 그날 고치면 저장</span>
          <span className="flex-1" />
          <Button size="sm" onClick={() => setPop({ k: 'text', title: '업무계획 텍스트', text: planCopyText(C, me, shortOf, all), hint: '회사 양식에 붙여 넣으세요' })}>2주 계획 복사</Button>
        </div>
        {weeksOpen && weeks.map((days, w) => (
          <section key={w} className={`${sec} ${w ? 'mt-3' : ''}`}>
            <CardHead title={w ? '다음 주' : '이번 주'}><span className="text-[11px] text-ink3">{monthDay(days[0])} ~ {monthDay(days[4])}</span></CardHead>
            <table className="w-full text-[12px]">
              <tbody>
                {days.map((date) => {
                  const past = date < d.today;
                  const saved = !!C.saved(me, date);
                  const its = past && !saved ? [] : planDay(C, me, date, all); // 지난 날은 실제로 기록한 것만
                  const hs = its.reduce((a, x) => a + planH(C, x), 0);
                  return (
                    <tr key={date} className={`border-b border-border last:border-b-0 ${past ? 'opacity-60' : ''} ${date === d.today ? 'bg-blue-soft/40' : ''}`}>
                      <td className="w-[104px] whitespace-nowrap px-3 py-2 align-top">
                        <b>{dayLabel(date)}</b>{date === d.today && <> <Tag tone="run">오늘</Tag></>}
                        <div className="text-[10.5px] text-ink3">{saved ? '수정함' : past ? '' : '자동'}</div>
                        {its.length > 0 && <div className="mt-0.5 text-[10.5px] text-ink2">{its.length}건{hs ? ` · ${hourText(hs)}` : ''}</div>}
                      </td>
                      <td className="px-2 py-1">
                        {its.length ? its.map((it, i) => (
                          <WeekItem key={i} C={C} nameOf={people.nameOf} me={me} date={date} it={it} shortOf={shortOf} onOpenTask={modals.openTask}
                            onDel={() => edit(date, (a, at) => { a.splice(at(i), 1); })} />
                        )) : <span className="text-[11.5px] text-ink3">{past ? '기록 없음' : '계획 없음'}</span>}
                      </td>
                      <td className="w-[150px] whitespace-nowrap px-3 py-2 text-right align-top">
                        <Button size="sm" variant="ghost" title="이 날 계획을 복사" onClick={async () => {
                          if (!its.length) { say('이 날은 계획이 없습니다', true); return; }
                          const { copyText } = await import('./planPdf');
                          const ok = await copyText(its.map((it) => `- ${planText(C, it, shortOf)}`).join('\n'));
                          say(ok ? `${monthDay(date)} 계획 ${its.length}건 복사` : '복사하지 못했습니다', !ok);
                        }}>복사</Button>
                        <Button size="sm" onClick={() => setPop({ k: 'add', date })}>+ 추가</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      {pop?.k === 'add' && <PlanAddModal C={C} me={me} date={pop.date} shortOf={shortOf} mut={mut} onDone={say} onClose={() => setPop(null)} />}
      {pop?.k === 'rep' && <PlanRepModal C={C} me={me} smut={smut} onDone={say} onClose={() => setPop(null)} />}
      {pop?.k === 'text' && <PlanTextModal title={pop.title} text={pop.text} hint={pop.hint} onDone={say} onClose={() => setPop(null)} />}
      {pop?.k === 'pdf' && <PlanPdfModal C={C} me={me} person={people.people.find((p) => p.id === me)} shortOf={shortOf} mut={mut} smut={smut} onDone={say} onClose={() => setPop(null)} />}
      {pop?.k === 'team' && <TeamPdfModal C={C} me={me} people={people} shortOf={shortOf} onDone={say} onClose={() => setPop(null)} />}
      {modals.node}
    </div>
  );
}

/** 2주 계획 한 줄 — 진행률 막대 · 시간 · 메모는 보기만 (고치는 곳은 오늘 할 일). 메모는 그날 임시저장본의 비고가 있으면 그것 */
function WeekItem({ C, me, date, it, shortOf, nameOf, onOpenTask, onDel }: {
  C: PlanCtx; nameOf: (id: string) => string; me: string; date: string; it: PmPlanItem; shortOf: (id: string) => string; onOpenTask: (id: string) => void; onDel: () => void;
}) {
  const t = C.task(it.taskId);
  const p = t ? C.live(t).pct : planItP(C, it);
  const h = planH(C, it);
  const row = C.draft(me, date)?.rows.find((r) => r[0] === planText(C, it, shortOf));
  const memo = (row ? row[1] : it.memo) ?? '';
  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-1 last:border-b-0">
      {t ? (
        <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-teal" title={t.name} onClick={() => onOpenTask(t.id)}>
          <ProjectTag>{shortOf(t.projectId)}</ProjectTag> <ItemName C={C} it={it} t={t} nameOf={nameOf} />
          {C.late(t) && <span className="ml-1 text-[11px] text-danger">지연</span>}{t.subAssigneeIds.includes(me) && <> <Tag>부</Tag></>}
        </button>
      ) : <span className="min-w-0 flex-1 truncate">✎ {planText(C, it, shortOf)}{it.rep && <> <Tag>반복</Tag></>}</span>}
      {t && <span className="whitespace-nowrap text-[11px] text-ink3">~{monthDay(t.end)}</span>}
      {pDone(C, it) && <Tag tone="ok">완료</Tag>}
      <span title={t ? '현재 업무 진행률' : '적어 둔 진행률'}><MiniBar pct={p} w={64} /></span>
      <span className="w-[36px] flex-none text-right text-[11px]">{p}%</span>
      <span className={`w-[34px] flex-none text-right text-[11px] ${h ? '' : 'text-ink3'}`}>{h ? hourText(h) : '-'}</span>
      <span className="w-[220px] flex-none truncate text-[11px] text-ink3" title={memo}>{memo ? `“${memo}”` : ''}</span>
      <Button size="sm" variant="ghost" onClick={onDel} title="이 날 계획에서 빼기">빼기</Button>
    </div>
  );
}

/** 업무 줄 이름 — 세부 작업이면 '업무 – 세부'에서 세부를 굵게, 남이 배정했으면 'n 배정' */
function ItemName({ C, it, t, nameOf }: { C: PlanCtx; it: PmPlanItem; t: PmTask; nameOf: (id: string) => string }) {
  if (!it.subId) return <span>{t.name}</span>;
  const s = C.sub(it);
  return (
    <span>
      <span className="text-ink3">{t.name} –</span> <b>{s ? s.text : '(삭제된 세부 작업)'}</b>
      {s && s.createdBy && s.createdBy !== s.assigneeId && <> <Tag tone="run" title={`${nameOf(s.createdBy)}이(가) 배정`}>{nameOf(s.createdBy)} 배정</Tag></>}
    </span>
  );
}

/** 오늘 할 일 (planToday 5278) */
function TodayCard({ C, d, all, me, people, mut, smut, shortOf, edit, say, onOpenTask, onOpenTicket, onPop, teamPdf }: {
  C: PlanCtx; d: PmDerived; all: Record<string, PmPlanItem[]>; me: string; people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>; smut: ReturnType<typeof usePmSiteMutations>; shortOf: (id: string) => string;
  edit: (date: string, fn: (a: PmPlanItem[], at: (i: number) => number) => void | false) => void; say: (m: string, bad?: boolean) => void;
  onOpenTask: (id: string) => void; onOpenTicket: (no: string) => void; onPop: (p: Pop) => void; teamPdf: boolean;
}) {
  const today = d.today;
  const nameOf = people.nameOf;
  const its = planDay(C, me, today, all);
  const doneN = its.filter((x) => pDone(C, x)).length;
  const sg = planSuggest(C, me, people.nameOf, all);
  const [weekOn, setWeekOn] = useState(false);
  const [lateOn, setLateOn] = useState(false);
  const [subOpen, setSubOpen] = useState<string | null>(null);
  const [memoOpen, setMemoOpen] = useState<number | null>(null);
  const [quickK, setQuickK] = useState('');
  const [quickKText, setQuickKText] = useState('');
  const [quick, setQuick] = useState('');
  const [quickP, setQuickP] = useState('');
  const tasks = planPickTasks(C, me, quickK);
  const kLabel = (t: PmTask) => `${shortOf(t.projectId)} · ${t.code} ${t.name}`;
  // 두 번 눌려도 한 번만 (G2 M3) — 차례 때 최신 목록에 이미 있으면 안 넣음
  const push = (item: PmPlanItem) => edit(today, (a) => { if (planHas(a, item)) return false; a.push(item); });

  const chip = (o: PlanSug) => (
    <button key={o.key} type="button" title={o.tip} onClick={() => push(o.item)}
      className="max-w-full truncate whitespace-nowrap rounded-md border border-border-hi bg-panel px-2 py-1 text-[11px] font-semibold text-ink2 hover:border-teal">
      + {o.projectId ? `${shortOf(o.projectId)} · ` : ''}{o.txt.length > 22 ? `${o.txt.slice(0, 22)}…` : o.txt}{' '}
      <span className={`ml-0.5 font-normal ${['마감 지남', '반려됨'].includes(o.why) ? 'text-danger' : 'text-ink3'}`}>{o.why}</span>
    </button>
  );
  const grp = (label: string, body: ReactNode, color: string, tip: string) => body ? (
    <div className="flex items-start gap-1.5 py-1">
      <span className={`w-[112px] flex-none text-[11.5px] font-semibold leading-7 ${color}`} title={tip}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{body}</div>
    </div>
  ) : null;
  const WEEK_N = 12;
  const sug = [
    grp('오늘 꼭', (sg.left.length || sg.must.length) ? <>
      {sg.left.length > 0 && <Button size="sm" variant="primary" title={sg.left.map((x) => planText(C, x, shortOf)).join('\n')}
        onClick={() => edit(today, (a) => {
          // 실제로 더한 건수로 안내 — 0건(두 번 눌림 등)이면 쓰지도 알리지도 않음
          const add = sg.left.map(({ done: _d, memo: _m, ...r }) => r).filter((r) => !planHas(a, r));
          if (!add.length) return false;
          a.push(...add); say(`어제 남은 일 ${add.length}건을 오늘로 가져왔습니다`);
        })}>↪ 어제 남은 일 {sg.left.length}건</Button>}
      {sg.must.map(chip)}
    </> : null, 'text-danger', '어제 못 끝낸 일 · 오늘이나 다음 근무일까지 마감인 일'),
    grp('나를 기다리는 일', sg.wait.length ? sg.wait.map(chip) : null, 'text-blue', '내가 검토 · 승인할 차례 · 새로 받은 티켓 · 반려되어 돌아온 일 · 남이 배정한 일'),
    grp('이번 주 안에', sg.week.length ? (weekOn
      ? <>{sg.week.slice(0, WEEK_N).map(chip)}{sg.week.length > WEEK_N && <span className="text-[11px] text-ink3">외 {sg.week.length - WEEK_N}건</span>}<Button size="sm" variant="ghost" onClick={() => setWeekOn(false)}>접기</Button></>
      : <Button size="sm" onClick={() => setWeekOn(true)} title={sg.week.slice(0, 8).map((o) => `${o.txt} — ${o.why}`).join('\n')}>{sg.week.length}건 보기</Button>) : null,
    'text-ink3', '7일 안에 마감인 일 · 날짜를 안 정한 내 티켓 · 세부 작업 · 액션 아이템'),
    sg.late.length ? grp('지연 업무', lateOn
      ? <>{sg.late.slice(0, 12).map((t) => (
        <button key={t.id} type="button" title={t.name} onClick={() => push({ taskId: t.id })} className="max-w-full truncate rounded-md border border-border-hi bg-panel px-2 py-1 text-[11px] font-semibold text-ink2 hover:border-teal">
          + {shortOf(t.projectId)} · {t.name.length > 22 ? `${t.name.slice(0, 22)}…` : t.name} <span className="font-normal text-danger">~{monthDay(t.end)}</span>
        </button>))}<Button size="sm" variant="ghost" onClick={() => setLateOn(false)}>접기</Button></>
      : <Button size="sm" onClick={() => setLateOn(true)} title="업무 목록상 종료일이 지났지만 완료 처리가 안 된 업무">{sg.late.length}건 보기</Button>,
    'text-ink3', '업무 목록상 종료일이 지났지만 완료 처리가 안 된 업무') : null,
  ].filter(Boolean);

  const first: Record<string, number> = {};
  its.forEach((it, i) => { if (it.taskId && first[it.taskId] === undefined) first[it.taskId] = i; });

  /** 체크 (planDone) — 세부 작업 줄이면 세부 작업도 완료, 액션 줄이면 액션도 완료 */
  const check = (i: number, on: boolean) => {
    const it = its[i];
    edit(today, (a, at) => { a[at(i)].done = on; });
    if (it.subId && C.sub(it)) {
      mut.updateSubtask.mutate({ id: it.subId, patch: { done: on } });
      const t = C.task(it.taskId);
      const rest = C.X.subtasks.filter((s) => s.taskId === it.taskId && !s.legacyKey && s.id !== it.subId);
      if (on && t && !C.done(t) && rest.every((s) => s.done)) {
        const tk = d.taskTicket.get(t.id);
        say(tk && tk.status !== '완료' && tk.status !== '취소'
          ? `세부 작업을 모두 끝냈습니다. 업무 전체가 끝났으면 티켓 ${tk.no}을(를) 검토 요청하세요`
          : `세부 작업을 모두 끝냈습니다. '${t.name}' 전체가 끝났으면 업무 이름을 눌러 [✓ TASK 전체 완료]를 눌러 주세요`);
      }
    }
    if (it.actionId && C.X.actions.some((a) => a.id === it.actionId)) smut.setActionDone.mutate({ id: it.actionId, done: on });
  };
  const quickAdd = () => {
    const v = quick.trim();
    if (!v) return;
    const t = quickK ? C.task(quickK) : undefined;
    if (t) {
      void mut.addSubtask.mutateAsync({ taskId: t.id, text: v, assigneeId: me, due: '' }).then((s) => push({ taskId: t.id, subId: (s as { id: string }).id }));
    } else {
      // 같은 글이 오늘 이미 있으면 안 넣고 알림 (데모는 두 줄로 들어감)
      const item: PmPlanItem = { text: v, ...(quickP !== '' ? { pct: +quickP } : {}) };
      edit(today, (a) => { if (planHas(a, item)) { say(`'${v}' 은(는) 이미 오늘 할 일에 있습니다`); return false; } a.push(item); });
    }
    setQuick('');
  };
  const pickK = (v: string) => {
    setQuickKText(v);
    const t = v.trim() ? [...tasks, ...d.snap.tasks].find((x) => kLabel(x) === v.trim()) : undefined;
    setQuickK(t ? t.id : '');
  };

  return (
    <section className={sec}>
      <CardHead title={`오늘 할 일 · ${dayLabel(today)}`}>
        <Tag tone={its.length && doneN === its.length ? 'ok' : 'run'}>완료 {doneN}/{its.length}</Tag>
        {its.length > 0 && !C.saved(me, today) && <Tag title="업무 기간에 맞춰 미리 채운 계획입니다. 체크 · 추가 · 삭제 등 고치는 순간 그대로 저장됩니다">자동 초안</Tag>}
        <span className="flex-1" />
        <Button size="sm" onClick={() => onPop({ k: 'rep' })}>반복 업무</Button>
        <Button size="sm" onClick={() => {
          if (!its.length) { say('오늘 계획이 없습니다', true); return; }
          onPop({ k: 'text', title: `업무보고 — ${dayLabel(today)}`, text: planReportText(C, its, shortOf), hint: '완료한 일 먼저 · 비고는 각 할 일의 메모 · 진행률은 업무 실적 (직접 입력한 일은 체크하면 100%) · 여기서 고쳐서 복사해도 됩니다' });
        }}>업무보고 복사</Button>
        <Button size="sm" variant="primary" onClick={() => onPop({ k: 'pdf' })}>일일 업무 보고 PDF</Button>
        {teamPdf && <Button size="sm" onClick={() => onPop({ k: 'team' })} title="팀원들의 오늘 일일 업무 보고를 한 PDF로 묶기">팀 보고 모아 받기</Button>}
      </CardHead>

      {sug.length > 0 && (
        <div className="border-b border-border bg-panel-alt px-4 py-2.5">
          <div className="mb-1 text-[12px] font-bold">추천 <span className="font-normal text-ink3">눌러서 오늘 할 일에 넣기</span></div>
          {sug}
        </div>
      )}

      {its.length ? its.map((it, i) => {
        const t = C.task(it.taskId);
        const l = t ? d.liveMap.get(t.id) ?? liveOf(t) : null;
        const h = planH(C, it);
        const lead = !!t && first[t.id] === i;
        const open = lead && subOpen === t!.id;
        const memoOn = !!it.memo || memoOpen === i;
        const done = pDone(C, it);
        const cb = carryText(it, today);
        const sc = t ? subCount(C, t.id) : '';
        return (
          <div key={i} className="border-b border-border/60 px-4 py-1.5">
            <div className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="h-4 w-4 flex-none cursor-pointer" checked={done} onChange={(e) => check(i, e.target.checked)}
                title={`오늘 할 몫을 끝냈으면 체크 · 진행률이 100%가 아니면 체크해도 다음 날로 넘어갑니다${t ? ' · 업무 전체가 끝났으면 업무 이름을 눌러 [TASK 전체 완료]' : ''}`} />
              <div className={`min-w-0 flex-1 ${done ? 'line-through opacity-60' : ''}`}>
                {t ? <>
                  <ProjectTag>{shortOf(t.projectId)}</ProjectTag>{' '}
                  <button type="button" className="text-left hover:text-teal" title={t.name} onClick={() => onOpenTask(t.id)}><ItemName C={C} it={it} t={t} nameOf={nameOf} /></button>
                </> : <span>✎ {it.text}</span>}
                {it.ticketNo && <> <button type="button" onClick={() => onOpenTicket(it.ticketNo!)} title="티켓에서 가져옴 — 눌러서 티켓 열기"><Tag tone="run">티켓 {it.ticketNo}</Tag></button></>}
                {it.actionId && <> <Tag title="회의 액션 아이템에서 가져옴 · 체크하면 액션 아이템도 완료">액션</Tag></>}
                {cb && <> <Tag title={`${monthDay(it.from!)}에 계획한 일 · 다 못 해서 넘어왔습니다. 그만둘 일이면 [빼기]로 빼세요`}>{cb}</Tag></>}
                {it.rep && <> <Tag>반복</Tag></>}
                {t && C.late(t) && <span className="ml-1 text-[11px] text-danger">지연</span>}
                {t && <span className="ml-1 text-[11px] text-ink3">~{monthDay(t.end)}</span>}
              </div>
              {lead && <Button size="sm" variant="ghost" title="이 업무를 세부 작업으로 나누기" onClick={() => setSubOpen(open ? null : t!.id)}>{open ? '세부 ▴' : sc ? `세부 ${sc} ▾` : '쪼개기 ▾'}</Button>}
              {t && l ? (
                <select className={`${sel} w-[70px]`} value={l.pct} title="업무 진행률 (실적에 바로 반영)"
                  onChange={(e) => { mut.setProgress.mutate({ id: t.id, pct: +e.target.value, why: '업무계획에서 기록' }); say(`'${t.name}' 진행률 ${e.target.value}% 기록`); }}>
                  {[...new Set([l.pct, ...PCTS])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
              ) : (
                <select className={`${sel} w-[70px]`} value={planItP(C, it)} title="진행률 (업무보고에 들어갑니다)" onChange={(e) => { const v = +e.target.value; edit(today, (a, at) => { a[at(i)].pct = v; }); }}>
                  {PCTS.map((v) => <option key={v} value={v}>{v}%</option>)}
                </select>
              )}
              <select className={`${sel} w-[74px] ${h ? '' : 'text-ink3'}`} value={it.hours ? String(it.hours) : ''} title="실제로 쓴 시간 (선택) — 과제 수행일지 · 투입 시간에 쓰입니다"
                onChange={(e) => { const v = e.target.value === '' ? 0 : +e.target.value; edit(today, (a, at) => { a[at(i)].hours = v; }); }}>
                <option value="">시간</option>
                {HOURS.map((v) => <option key={v} value={v}>{v}h</option>)}
              </select>
              {!memoOn && <Button size="sm" variant="ghost" onClick={() => setMemoOpen(i)} title="한 일 메모 (업무보고 비고)">메모</Button>}
              <Button size="sm" variant="ghost" onClick={() => { setMemoOpen(null); edit(today, (a, at) => { a.splice(at(i), 1); }); }} title="오늘 계획에서 빼기">빼기</Button>
            </div>
            {memoOn && (
              <input key={`${i}|${it.memo ?? ''}`} autoFocus={memoOpen === i} defaultValue={it.memo ?? ''} placeholder="한 일 메모 (업무보고 비고에 들어갑니다)"
                className="ml-6 mt-1 h-[26px] w-[calc(100%-24px)] rounded border border-border-hi px-2 text-[11px]"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (it.memo ?? '')) edit(today, (a, at) => { a[at(i)].memo = v; }); setMemoOpen(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur(); }} />
            )}
            {open && (
              <div className="ml-6 mt-1.5 rounded-lg border border-border bg-panel-alt px-3 pb-2">
                <SubtaskBox taskId={t!.id} d={d} people={people} mut={mut} onMsg={(m) => say(m)} taskName={t!.name} taskDone={C.done(t!)} onOpenTicket={onOpenTicket} inline />
              </div>
            )}
          </div>
        );
      }) : <div className="px-4 py-3.5 text-[12px] text-ink3">오늘 할 일이 비어 있습니다. 위 추천을 누르거나 아래에 입력하세요{!sug.length && ' — 업무 목록에서 나를 담당으로 넣고 시작 · 종료일을 정하면 그 기간에 자동으로 채워집니다'}</div>}

      <div className="flex flex-nowrap items-center gap-2 px-4 py-2.5">
        <input list="pmPlanKList" className="w-[260px] flex-none rounded border border-border-hi px-2 py-1 text-[12px]" value={quickKText}
          onChange={(e) => pickK(e.target.value)} onBlur={() => { if (quickKText.trim() && !quickK) say('목록에서 업무를 골라 주세요 (비우면 사내 업무로 저장)', true); }} placeholder="업무 검색 (비우면 사내 업무)"
          title="사업명 · 업무명 일부를 입력해 고르면 그 업무의 세부 작업으로 저장됩니다" />
        <datalist id="pmPlanKList">{tasks.map((t) => <option key={t.id} value={kLabel(t)}>{subCount(C, t.id) ? `세부 ${subCount(C, t.id)} · ` : ''}~{monthDay(t.end)}</option>)}</datalist>
        <datalist id="pmPlanRecList">{quickK ? null : planRecentTexts(C, me, all).map((x) => <option key={x} value={x} />)}</datalist>
        <input list="pmPlanRecList" autoComplete="off" className="min-w-0 flex-1 rounded border border-border-hi px-2 py-1 text-[12px]" value={quick}
          onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); quickAdd(); } }}
          placeholder={quickK ? '세부 작업을 입력하고 Enter — 예: 작업지시 화면 API 연결' : '할 일을 입력하고 Enter (연속 입력 가능) — 예: 효광 현장 미팅'} />
        <select className={`${sel} w-[86px]`} value={quickP} onChange={(e) => setQuickP(e.target.value)} title="진행률 (직접 쓴 업무 — 업무보고에 들어갑니다. 업무 목록 업무는 줄에서 진행률을 고칩니다)">
          <option value="">진행률</option>
          {PCTS.map((v) => <option key={v} value={v}>{v}%</option>)}
        </select>
      </div>
    </section>
  );
}
