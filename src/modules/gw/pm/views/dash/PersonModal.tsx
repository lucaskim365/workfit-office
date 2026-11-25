import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { PERSON_TABS, personTasks, type PersonTab } from '@/domain/pm/team';
import type { PmDerived } from '@/features/pm/usePm';
import { DueCell, EmptyHint, ProjectTag, Tag } from '../wbs/parts';

/**
 * 사람별 업무 팝업 (personModal 6584) — 팀 현황 카드의 숫자 · [업무 n →] 을 누르면.
 * 탭(맡은 업무 · 진행 중 · 지연 · 7일 내 마감 · 완료) · 사업 칩 · 업무 줄(누르면 업무 창) · [업무 목록에서 보기].
 */
const NOTE: Record<PersonTab, string> = {
  all: '끝나지 않은 업무 전체 · 급한 순',
  now: '오늘이 업무 기간(시작~종료) 안에 있는 업무 · 마감 가까운 순',
  late: '종료일이 지났는데 끝나지 않은 업무 · 오래된 순',
  week: '지연이 아니고 7일 안에 종료일이 오는 업무',
  done: '끝난 업무 · 최근 종료일 순',
};

export function PersonModal({ who, k, tab, d, label, shortOf, nameOf, onChange, onOpenTask, onGoWbs, onClose }: {
  who: string;
  k: string;
  tab: PersonTab;
  d: PmDerived;
  label: string;
  shortOf: (id: string) => string;
  nameOf: (id: string) => string;
  onChange: (k: string, tab: PersonTab) => void;
  onOpenTask: (id: string) => void;
  onGoWbs: () => void;
  onClose: () => void;
}) {
  const X = { tasks: d.snap.tasks, liveMap: d.liveMap, projects: d.snap.projects, today: d.today };
  const r = personTasks(who, X, k, tab);
  const tabBtn = (id: PersonTab, nm: string) => (
    <button key={id} type="button" onClick={() => onChange(k, id)}
      className={`border-b-2 px-3 py-2 text-[12px] font-bold ${tab === id ? 'border-teal text-ink' : 'border-transparent text-ink3 hover:text-ink2'} ${id === 'late' && r.counts.late ? 'text-danger' : ''}`}>
      {nm} <b>{r.counts[id]}</b>
    </button>
  );
  const chip = (id: string, text: string, n: number) => (
    <button key={id} type="button" onClick={() => onChange(id, tab)}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${k === id ? 'border-teal bg-teal/10 text-ink' : 'border-border-hi bg-panel text-ink2 hover:border-teal'}`}>
      {text} <b>{n}</b>
    </button>
  );
  return (
    <Modal open onClose={onClose} width={900} title={`${label}${k === 'all' ? '' : ` · ${shortOf(k)}`}`}
      footer={<><span className="flex-1 text-[11px] text-ink3">{NOTE[tab]}</span><Button variant="secondary" onClick={onClose}>닫기</Button><Button onClick={onGoWbs}>업무 목록에서 보기 →</Button></>}>
      <div className="-mt-2 mb-2 flex flex-wrap border-b border-border">{PERSON_TABS.map(([id, nm]) => tabBtn(id, nm))}</div>
      {(r.ks.length > 1 || k !== 'all') && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chip('all', '전체', r.total)}
          {r.ks.map((x) => chip(x, shortOf(x), r.byK.get(x) ?? 0))}
        </div>
      )}
      {r.list.length ? (
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border text-left text-[11px] text-ink3"><th className="py-1.5 pr-2">사업</th><th className="pr-2">번호</th><th className="pr-2">업무</th><th className="pr-2">담당</th><th className="pr-2">상태</th><th>종료일</th></tr></thead>
            <tbody>
              {r.list.map((t) => {
                const l = d.liveMap.get(t.id)!;
                return (
                  <tr key={t.id} onClick={() => onOpenTask(t.id)} className="cursor-pointer border-b border-border hover:bg-panel-alt">
                    <td className="py-1.5 pr-2"><ProjectTag>{shortOf(t.projectId)}</ProjectTag></td>
                    <td className="whitespace-nowrap pr-2 text-ink3">{t.code}</td>
                    <td className="pr-2 text-ink">{t.milestone ? '◆ ' : ''}{t.name}</td>
                    <td className="whitespace-nowrap pr-2 text-ink2">{t.assigneeIds.map(nameOf).join(', ') || '-'}</td>
                    <td className="whitespace-nowrap pr-2"><Tag tone={l.status === '완료' ? 'ok' : l.status === '진행중' ? 'run' : 'plain'}>{l.status} {l.pct}%</Tag></td>
                    <td className="whitespace-nowrap"><DueCell t={t} l={l} today={d.today} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyHint title="해당하는 업무가 없습니다" hint="업무 목록에서 업무에 담당과 날짜(시작 · 종료)를 넣으면 여기 나옵니다." />
      )}
    </Modal>
  );
}
