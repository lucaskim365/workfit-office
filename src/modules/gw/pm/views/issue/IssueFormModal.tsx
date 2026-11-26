import { useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { isDone } from '@/domain/pm/rules';
import { ISSUE_CATS, ISSUE_FORM_SEVS, ISSUE_STATES, issueCheck } from '@/domain/pm/issue';
import type { PmIssue } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';
import { PARTIAL_LOCK_MSG, usePmPartialLock } from '@/features/pm/pmSaveBus';

/**
 * 이슈 등록 · 수정 창 (데모 issueForm 3182) — 데모 칸 그대로 (새 칸 없음).
 * 이슈 화면 · 통합 사업 현황 [+ 이슈 등록] · 내 업무 [+ 이슈] · 사업별 [+ 하자 · AS 접수] · 🔔 · 검색에서 같이 씀.
 */
const inp = 'w-full rounded border border-border bg-panel px-2 py-1.5 text-[12.5px] text-ink';
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
type V = Omit<PmIssue, 'id' | 'by' | 'at' | 'esc'>;

function F({ label, req, full, bad, help, children }: { label: string; req?: boolean; full?: boolean; bad?: boolean; help?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      <span>{label}{req && <span className="text-danger"> *</span>}</span>
      <div className={bad ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
      {help && <small className="font-normal text-ink3">{help}</small>}
    </label>
  );
}

export function IssueFormModal({ issue, site, d, people, mut, shortOf, onDone, onClose }: {
  issue: PmIssue | null;
  /** 새로 등록할 때 사업 (하자 · AS 접수 · 이슈 화면 사업 거르기) */
  site: string;
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  /** 저장 · 삭제 뒤 안내 글 */
  onDone: (msg: string) => void;
  onClose: () => void;
}) {
  const projects = [...d.snap.projects].sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')));
  const isNew = !issue;
  const lock = usePmPartialLock() && isNew;
  const [v, setV] = useState<V>(() => (issue ? { ...issue } : {
    projectId: site || projects.find((p) => d.snap.tasks.some((t) => t.projectId === p.id))?.id || projects[0]?.id || '',
    cat: '설비 통신 장애', title: '', equip: '', taskId: '', sev: '보통', ownerId: people.me, date: d.today, watchIds: [], status: '열림', desc: '', action: '',
  }));
  const [err, setErr] = useState<[string, string] | null>(null);
  const set = <K extends keyof V>(k: K, x: V[K]) => setV((o) => ({ ...o, [k]: x }));
  const p = d.snap.projects.find((x) => x.id === v.projectId);
  const equips = p ? [...p.lines, ...p.equip] : [];
  // 연관 업무: 그 사업의 안 끝난 업무 (지금 고른 것은 끝났어도 보임 — siteTaskOpts)
  const tasks = d.snap.tasks.filter((t) => t.projectId === v.projectId && (!isDone(d.liveMap.get(t.id) ?? { status: t.status, pct: t.actualPct }) || t.id === issue?.taskId));
  const save = async () => {
    const e = issueCheck(v);
    if (e) { setErr(e); return; }
    if (issue) { await mut.updateIssue.mutateAsync({ id: issue.id, x: v }); onDone(`${issue.id} 수정 완료`); }
    else { const i = await mut.addIssue.mutateAsync(v); onDone(v.sev === '긴급' ? `${i.id} 긴급 이슈 — 윗선에 보고됨` : `${i.id} 이슈 등록`); }
    onClose();
  };
  const del = async () => {
    if (!issue || !confirm(`${issue.id}를 삭제할까요?`)) return;
    await mut.removeIssue.mutateAsync(issue.id);
    onDone(`${issue.id} 삭제됨`);
    onClose();
  };
  const bad = (f: string) => err?.[1] === f;
  const toggleWatch = (id: string) => set('watchIds', v.watchIds.includes(id) ? v.watchIds.filter((x) => x !== id) : [...v.watchIds, id]);
  return (
    <Modal open onClose={onClose} width={720} title={isNew ? '현장 / 개발 이슈 등록' : `이슈 수정 — ${issue.id}`}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="secondary" onClick={() => void del()}>삭제</Button>}
          <span className="flex-1 text-right text-[12px] font-bold text-danger" role="alert">{lock ? PARTIAL_LOCK_MSG : err?.[0]}</span>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button disabled={lock} onClick={() => void save()}>{isNew ? '등록' : '저장'}</Button>
        </div>
      )}>
      {isNew && <p className="mb-3 rounded-lg bg-panel-alt px-3 py-2 text-[12px] text-ink2">심각도 <b>긴급</b>으로 등록하면 PM과 담당자에게 바로 보고(에스컬레이션)됩니다.</p>}
      {!isNew && issue.esc && <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger">윗선에 보고된 이슈입니다</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="사업" req bad={bad('projectId')}>
          <select className={inp} value={v.projectId} onChange={(e) => setV((o) => ({ ...o, projectId: e.target.value, equip: '', taskId: '' }))}>
            {projects.map((x) => <option key={x.id} value={x.id}>{shortOf(x.id)}</option>)}
          </select>
        </F>
        <F label="이슈 분류">
          <select className={inp} value={v.cat} onChange={(e) => set('cat', e.target.value)}>{[...new Set([...ISSUE_CATS, v.cat])].map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <F label="이슈 제목" req full bad={bad('title')}><input className={inp} value={v.title} onChange={(e) => set('title', e.target.value)} /></F>
        <F label="발생 라인 / 설비" help={equips.length ? '사업 정보에 등록한 라인 · 설비' : '사업 정보에 등록한 라인 · 설비 — 아직 없음 (사업 정보 수정은 6단계)'}>
          <select className={inp} value={v.equip} onChange={(e) => set('equip', e.target.value)}>
            <option value="">-</option>
            {[...new Set([...equips, ...(v.equip ? [v.equip] : [])])].map((x) => <option key={x}>{x}</option>)}
          </select>
        </F>
        <F label="연관 업무">
          <select className={inp} value={v.taskId} onChange={(e) => set('taskId', e.target.value)}>
            <option value="">-</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.code} · {trunc(t.name, 50)}</option>)}
          </select>
        </F>
        <F label="심각도">
          <select className={inp} value={v.sev} onChange={(e) => set('sev', e.target.value as V['sev'])}>{[...new Set([...ISSUE_FORM_SEVS, v.sev])].map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <F label="대응 담당자" req bad={bad('ownerId')}>
          <select className={inp} value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            <option value="">-</option>
            {people.people.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </F>
        <F label="발생일" req bad={bad('date')}><input type="date" className={inp} value={v.date} onChange={(e) => set('date', e.target.value)} /></F>
        <F label="상태">
          <select className={inp} value={v.status} onChange={(e) => set('status', e.target.value)}>{[...new Set([...ISSUE_STATES, v.status])].map((x) => <option key={x}>{x}</option>)}</select>
        </F>
        <div className="grid gap-1 text-[11.5px] font-bold text-ink2 sm:col-span-2">
          <span>관련자 <small className="font-normal text-ink3">— 같이 확인해야 할 사람 · 내 업무 처리할 일과 🔔 알림에 뜹니다</small></span>
          <div className="flex max-h-[110px] flex-wrap gap-1.5 overflow-y-auto rounded border border-border p-2">
            {people.people.map((u) => (
              <label key={u.id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-normal ${v.watchIds.includes(u.id) ? 'border-navy bg-blue-soft text-ink' : 'border-border text-ink2'}`}>
                <input type="checkbox" className="h-3 w-3" checked={v.watchIds.includes(u.id)} onChange={() => toggleWatch(u.id)} />{u.label}
              </label>
            ))}
          </div>
        </div>
        <F label="현상 / 상세 내용" full><textarea className={`${inp} min-h-[70px]`} value={v.desc} onChange={(e) => set('desc', e.target.value)} /></F>
        <F label="조치 내용" full bad={bad('action')} help="해결로 바꿀 때는 꼭 적어 주세요"><textarea className={`${inp} min-h-[70px]`} value={v.action} onChange={(e) => set('action', e.target.value)} /></F>
      </div>
    </Modal>
  );
}
