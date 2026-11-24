import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { isDone, liveOf, monthDay, shortName, varianceOf, type VarKind } from '@/domain/pm/rules';
import { usePmDerived, usePmMutations } from '@/features/pm/usePm';
import { usePmPeople } from '../../usePmPeople';
import { EmptyHint, ProjectTag, Tag } from './parts';
import { TaskDetailModal } from './TaskDetailModal';

/**
 * 일정 변동 (varView 5614): 사업 칩 → 사업별 요약(늦춰짐·당겨짐·추가·삭제, 마지막 업무 종료 변화, 기준선 재설정)
 * → 바뀐 업무 목록(탭, 30건씩) → 선후행 관계 점검.
 */
const KIND: Record<VarKind, [tone: 'bad' | 'run' | 'ok' | 'plain', label: string]> = {
  late: ['bad', '✎ 늦춰짐'], early: ['run', '✎ 당겨짐'], add: ['ok', '＋ 추가'], del: ['plain', '− 삭제'],
};
const TABS: ReadonlyArray<readonly ['all' | VarKind, string]> = [['all', '전체'], ['late', '늦춰짐'], ['early', '당겨짐'], ['add', '추가'], ['del', '삭제']];
const PER = 30;

export function VarianceView() {
  const people = usePmPeople();
  const d = usePmDerived(people.nameOf);
  const mut = usePmMutations(people.me, people.nameOf);
  const [vk, setVk] = useState('all');
  const [tab, setTab] = useState<'all' | VarKind>('all');
  const [pg, setPg] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [baseFor, setBaseFor] = useState<string | null>(null);
  const [baseLabel, setBaseLabel] = useState('');
  if (!d) return <EmptyHint title="불러오는 중입니다" />;
  const { snap, today, liveMap } = d;
  const nameOf = (id: string) => { const p = snap.projects.find((x) => x.id === id); return p ? shortName(p, snap.projects) : id; };
  const all = snap.projects
    .filter((p) => snap.tasks.some((t) => t.projectId === p.id) || p.start)
    .map((p) => ({ p, b: snap.baselines.find((b) => b.id === p.id) }))
    .filter((o) => o.b)
    .map(({ p, b }) => ({ p, v: varianceOf(b!, snap.tasks.filter((t) => t.projectId === p.id)) }));
  if (!all.length) return <EmptyHint title="기준선이 있는 사업이 없습니다" hint="업무 목록이 있는 사업은 처음 켤 때 '최초 계획' 기준선이 자동으로 만들어집니다." />;
  const k = all.some((o) => o.p.id === vk) ? vk : 'all';
  const pick = all.filter((o) => k === 'all' || o.p.id === k);
  const rows = pick.flatMap((o) => o.v.rows);
  const list = rows.filter((r) => tab === 'all' || r.kind === tab);
  const n = Math.max(1, Math.ceil(list.length / PER));
  const page = Math.min(Math.max(1, pg), n);
  const shown = list.slice((page - 1) * PER, page * PER);
  const z = (x: number) => (x ? x : <span className="text-ink3">-</span>);

  // 선후행 점검 (depIssues 2196)
  const dep: Array<{ id: string; kind: '일정 충돌' | '선행 미완료'; txt: string; t: string; p: string }> = [];
  for (const t of snap.tasks) {
    if ((k !== 'all' && t.projectId !== k) || isDone(liveMap.get(t.id) ?? liveOf(t))) continue;
    for (const pid of t.predecessorIds) {
      const p = d.taskMap.get(pid);
      if (!p) continue;
      if (t.start && p.end && t.start <= p.end) dep.push({ id: t.id, kind: '일정 충돌', txt: `선행 종료(${p.end}) 전에 시작(${t.start})`, t: `${t.code} ${t.name}`, p: `${p.code} ${p.name}` });
      else if (!isDone(liveMap.get(p.id) ?? liveOf(p)) && t.start && t.start <= today) dep.push({ id: t.id, kind: '선행 미완료', txt: `착수일(${t.start})이 지났지만 선행 업무가 끝나지 않음`, t: `${t.code} ${t.name}`, p: `${p.code} ${p.name}` });
    }
  }

  const th = 'whitespace-nowrap px-3 py-1.5 text-left text-[11px] font-bold text-ink3';
  const td = 'px-3 py-1.5 text-[12px]';
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant={k === 'all' ? 'primary' : 'secondary'} onClick={() => { setVk('all'); setPg(1); }}>전체</Button>
        {all.map(({ p }) => <Button key={p.id} size="sm" variant={k === p.id ? 'primary' : 'secondary'} onClick={() => { setVk(p.id); setPg(1); }} title={`${p.company} · ${p.biz}`}>{nameOf(p.id)}</Button>)}
      </div>

      <div className="mb-3 overflow-x-auto rounded-xl border border-border bg-panel">
        <div className="border-b border-border px-3 py-2 text-[13px] font-bold">사업별 일정 변동</div>
        <table className="w-full">
          <thead><tr className="bg-panel-alt"><th className={th}>사업</th><th className={th}>기준선</th><th className={`${th} text-right`}>늦춰짐</th><th className={`${th} text-right`}>당겨짐</th><th className={`${th} text-right`}>추가</th><th className={`${th} text-right`}>삭제</th><th className={th}>마지막 업무 종료 (기준선 → 현재)</th><th className={th} /></tr></thead>
          <tbody>
            {pick.map(({ p, v }) => (
              <tr key={p.id} className={`cursor-pointer border-t border-border hover:bg-panel-alt ${k === p.id ? 'bg-teal-soft' : ''}`} onClick={() => { setVk(p.id); setPg(1); }}>
                <td className={td}><ProjectTag>{nameOf(p.id)}</ProjectTag></td>
                <td className={`${td} whitespace-nowrap`} title={v.baseline.label}>{v.baseline.label.split(' (')[0]} · {monthDay(v.baseline.date)}</td>
                <td className={`${td} text-right ${v.late ? 'font-bold text-danger' : ''}`}>{z(v.late)}</td>
                <td className={`${td} text-right`}>{z(v.early)}</td>
                <td className={`${td} text-right`}>{z(v.added)}</td>
                <td className={`${td} text-right`}>{z(v.removed)}</td>
                <td className={td}>{v.baseEnd || '-'} → <b className={v.endDiff > 0 ? 'text-danger' : ''}>{v.curEnd || '-'}</b>{v.endDiff ? ` (${v.endDiff > 0 ? '+' : ''}${v.endDiff}일)` : ''}</td>
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" onClick={() => { setBaseFor(p.id); setBaseLabel(`변경 계획 (${today})`); }}>기준선 재설정</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-3 rounded-xl border border-border bg-panel">
        <div className="flex flex-wrap gap-1 border-b border-border px-2">
          {TABS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setTab(v); setPg(1); }} className={`-mb-px border-b-2 px-3 py-2 text-[12px] font-bold ${tab === v ? 'border-teal text-navy' : 'border-transparent text-ink3'}`}>
              {l} <b className="ml-0.5 text-[11px]">{(v === 'all' ? rows : rows.filter((r) => r.kind === v)).length}</b>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-panel-alt"><th className={th}>변경</th><th className={th}>사업 · 번호</th><th className={th}>업무</th><th className={th}>기준선 종료</th><th className={th}>현재 종료</th><th className={`${th} text-right`}>차이</th></tr></thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={`${r.kind}${r.taskId ?? r.code}${i}`} className={`border-t border-border ${r.taskId ? 'cursor-pointer hover:bg-panel-alt' : ''}`} onClick={() => r.taskId && setOpenId(r.taskId)}>
                  <td className={td}><Tag tone={KIND[r.kind][0]}>{KIND[r.kind][1]}</Tag></td>
                  <td className={`${td} whitespace-nowrap`}><ProjectTag>{nameOf(r.projectId)}</ProjectTag> <span className="text-[11px]">{r.code}</span></td>
                  <td className={td} title={r.name}>{r.name.length > 48 ? `${r.name.slice(0, 48)}…` : r.name}</td>
                  <td className={td}>{r.from || <span className="text-ink3">-</span>}</td>
                  <td className={td}>{r.kind === 'del' ? <span className="text-ink3">삭제됨</span> : r.to || '-'}</td>
                  <td className={`${td} text-right ${r.kind === 'late' ? 'font-bold text-danger' : ''}`}>{r.d ? `${r.d > 0 ? '+' : ''}${r.d}일` : <span className="text-ink3">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <EmptyHint title="기준선 이후 바뀐 업무가 없습니다" hint="업무의 종료일을 바꾸거나 업무를 추가·삭제하면 여기에 나옵니다. 지금은 기준선을 옮긴 날 만든 '최초 계획'이라 0건이 정상입니다." />}
        </div>
        {n > 1 && (
          <div className="flex justify-center gap-1 border-t border-border py-2">
            {Array.from({ length: n }, (_, i) => <Button key={i} size="sm" variant={page === i + 1 ? 'primary' : 'secondary'} onClick={() => setPg(i + 1)}>{i + 1}</Button>)}
          </div>
        )}
        <div className="border-t border-border px-3 py-2 text-[11px] text-ink3">※ 기준선 = 승인된 최초 계획 · 종료일 기준으로 비교합니다 · 기준선 재설정은 변경 협약 등 승인된 계획 변경 때만 합니다</div>
      </div>

      <div className="rounded-xl border border-border bg-panel">
        <div className="flex items-center border-b border-border px-3 py-2 text-[13px] font-bold">선후행 관계 점검<span className="flex-1" /><span className="text-[11px] font-normal text-ink3">{dep.length}건</span></div>
        <table className="w-full">
          <thead><tr className="bg-panel-alt"><th className={th}>구분</th><th className={th}>후행 업무</th><th className={th}>선행 업무</th><th className={th}>내용</th></tr></thead>
          <tbody>
            {dep.map((o, i) => (
              <tr key={i} className="cursor-pointer border-t border-border hover:bg-panel-alt" onClick={() => setOpenId(o.id)}>
                <td className={td}><Tag tone={o.kind === '일정 충돌' ? 'bad' : 'warn'}>{o.kind}</Tag></td>
                <td className={td}>{o.t}</td><td className={td}>{o.p}</td><td className={`${td} text-ink3`}>{o.txt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!dep.length && <EmptyHint title="점검할 선후행 문제가 없습니다" hint="선행 업무는 업무 수정 창에서 지정합니다." />}
      </div>

      {openId && <TaskDetailModal id={openId} d={d} people={people} mut={mut} shortOf={nameOf} onClose={() => setOpenId(null)} onEdit={() => setOpenId(null)} />}
      {baseFor && (
        <Modal
          open
          onClose={() => setBaseFor(null)}
          title={`기준선 재설정 — ${nameOf(baseFor)}`}
          footer={
            <div className="flex w-full gap-2">
              <span className="flex-1" />
              <Button onClick={() => setBaseFor(null)}>취소</Button>
              <Button variant="primary" onClick={() => { mut.resetBaseline.mutate({ projectId: baseFor, label: baseLabel.trim() || '변경 계획' }); setBaseFor(null); }}>재설정</Button>
            </div>
          }
        >
          <p className="mb-2 text-[12px] text-ink2">지금 업무 일정으로 기준선을 새로 잡습니다. 변경 협약 등 승인된 계획 변경 때만 하세요. 재설정하면 일정 변동이 0건이 됩니다.</p>
          <label className="grid gap-1 text-[11.5px] font-bold text-ink2">기준선 이름
            <input className="rounded border border-border-hi px-2 py-1 text-[12.5px]" value={baseLabel} onChange={(e) => setBaseLabel(e.target.value)} />
          </label>
        </Modal>
      )}
    </div>
  );
}
