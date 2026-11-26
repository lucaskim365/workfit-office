import { useState } from 'react';
import { defaultAssignee, diffDays, doneInfoOf, isDone, isLate, liveOf, monthDay, taskPeople, undoPct } from '@/domain/pm/rules';
import type { PmTask, PmTaskStatus } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import { pmBase } from '@/data/pm/pm.store';
import type { usePmPeople } from '../../usePmPeople';
import { ProgressBar, ProjectTag } from './parts';

/**
 * 업무 보드 (wbsBoard 8268): 시작 전 / 진행 중 / 완료 세 칸, 칸마다 60장까지.
 * 끌어서 다른 칸에 놓으면 상태가 바뀐다 — 완료 칸 = TASK 전체 완료, 완료에서 빼면 완료 취소,
 * 진행률이 0보다 크면 시작 전으로 못 옮김.
 */
const COLS: ReadonlyArray<readonly [PmTaskStatus, string]> = [['계획', '시작 전'], ['진행중', '진행 중'], ['완료', '완료']];
const MAX = 60;

export function WbsBoard({ list, d, people, shortOf, onOpen, mut }: {
  list: PmTask[];
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  shortOf: (id: string) => string;
  onOpen: (id: string) => void;
  mut: ReturnType<typeof usePmMutations>;
}) {
  const { liveMap, today } = d;
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<PmTaskStatus | null>(null);
  const [msg, setMsg] = useState('');
  const L = (t: PmTask) => liveMap.get(t.id) ?? liveOf(t);
  const col = (st: PmTaskStatus) =>
    list.filter((t) => {
      const l = L(t);
      if (st === '완료') return l.status === '완료';
      if (st === '진행중') return l.status !== '완료' && (l.status === '진행중' || l.pct > 0);
      return l.status !== '완료' && l.status !== '진행중' && !(l.pct > 0);
    });

  const drop = (to: PmTaskStatus) => {
    const t = drag ? d.taskMap.get(drag) : null;
    setDrag(null);
    setOver(null);
    if (!t) return;
    const l = L(t);
    if (to === '완료') {
      if (isDone(l)) return;
      const left = (d.subsByTask.get(t.id) ?? []).filter((s) => !s.done).length;
      if (left && !confirm(`아직 안 끝난 세부 작업이 ${left}건 있습니다.\n그래도 '${t.name}' 업무를 완료로 바꿀까요? (세부 작업은 그대로 남습니다)`)) return;
      mut.setProgress.mutate({ id: t.id, pct: 100, why: 'TASK 완료 처리' });
      setMsg(`'${t.name}' 완료 — 실적 100%`);
      return;
    }
    if (isDone(l)) {
      const info = doneInfoOf(t, l, d.doneMap, d.snap.logs);
      const prev = info ? undoPct(info) : 90;
      if (!confirm(`'${t.name}' 완료를 취소할까요?\n진행률을 ${prev}%로 되돌립니다.`)) return;
      mut.setProgress.mutate({ id: t.id, pct: prev, why: 'TASK 완료 취소' });
      setMsg(to === '계획' ? '완료를 취소해 진행 중으로 돌렸습니다 — 시작 전으로 하려면 진행률을 0으로 고치세요' : `완료를 취소했습니다 — 진행률 ${prev}%`);
      return;
    }
    if (t.status === to) return;
    if (to === '계획' && t.actualPct > 0) {
      setMsg(`진행률이 ${t.actualPct}%라 시작 전으로 옮길 수 없습니다 — 진행률을 0으로 고친 뒤 옮기세요`);
      return;
    }
    // 창 없는 끌어 놓기 — 화면 값 t 가 기준 (화면이 저장소보다 늦은 드문 때만 막힘)
    mut.updateTask.mutate({ id: t.id, next: { ...t, status: to }, base: [pmBase('tasks', t.id, t)] });
  };

  return (
    <div className="p-3">
      {msg && <div className="mb-2 rounded-lg bg-amber-soft px-3 py-1.5 text-[11.5px] text-ink2">{msg}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        {COLS.map(([st, nm]) => {
          const cards = col(st);
          return (
            <div
              key={st}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(st); } }}
              onDragLeave={() => setOver((o) => (o === st ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(st); }}
              className={`min-h-[120px] rounded-xl border bg-panel-alt p-2 ${over === st ? 'border-teal' : 'border-border'}`}
            >
              <div className="mb-2 flex items-center gap-2 px-1 text-[12px]"><b className="text-ink">{nm}</b><span className="text-ink3">{cards.length}</span></div>
              <div className="grid gap-2">
                {cards.slice(0, MAX).map((t) => {
                  const l = L(t);
                  const late = isLate(t, l, today);
                  const as = defaultAssignee(t);
                  const n = taskPeople(t).length;
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDrag(t.id)}
                      onDragEnd={() => { setDrag(null); setOver(null); }}
                      onClick={() => onOpen(t.id)}
                      title={`${t.name} · 끌어서 다른 칸에 놓으면 상태가 바뀝니다`}
                      className={`cursor-pointer rounded-lg border bg-panel p-2 text-[11.5px] shadow-sm ${late ? 'border-danger' : 'border-border'} ${drag === t.id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ProjectTag>{shortOf(t.projectId)}</ProjectTag>
                        <span className="text-[10.5px] text-ink3">{t.code}</span>
                        {t.milestone && <b className="text-amber">◆</b>}
                      </div>
                      <div className="my-1 line-clamp-2 font-bold leading-snug text-ink">{t.name}</div>
                      <div className="flex items-center gap-1.5 text-[10.5px]">
                        <span className={late ? 'font-bold text-danger' : 'text-ink3'}>{t.end ? (late ? `${diffDays(t.end, today)}일 경과` : `~${monthDay(t.end)}`) : '기한 없음'}</span>
                        <span className="flex-1" />
                        {as ? <span className="text-ink2">{people.nameOf(as)}{n > 1 ? ` 외 ${n - 1}` : ''}</span> : <span className="font-bold text-amber">담당 없음</span>}
                      </div>
                      <div className="mt-1.5"><ProgressBar pct={l.pct} /></div>
                    </div>
                  );
                })}
                {cards.length > MAX && <div className="px-1 text-[10.5px] text-ink3">외 {cards.length - MAX}건 — 위에서 사업 · 담당으로 좁히면 모두 보입니다</div>}
                {!cards.length && <div className="px-1 py-4 text-center text-[10.5px] text-ink3">업무를 이 칸으로 끌어 놓으세요</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
