import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { addDays } from '@/domain/pm/rules';
import { PM_TASK_STATUSES, type PmTask } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';

/**
 * 일괄 수정 (wbsBulkForm 6520): 입력한 항목만 바뀌고 비워 둔 항목은 그대로.
 * 일정 이동(일) · 상태 · 담당(정) · 마일스톤 · 기타 실행 주체.
 */
const KEEP = '__keep';

export function BulkEditModal({ ids, d, people, mut, onClose, onDone }: {
  ids: string[];
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [shift, setShift] = useState(0);
  const [st, setSt] = useState(KEEP);
  const [who, setWho] = useState(KEEP);
  const [ms, setMs] = useState(KEEP);
  const [exec, setExec] = useState('');
  const [msg, setMsg] = useState('');

  const apply = () => {
    const items: Array<{ next: PmTask; summary: string }> = [];
    for (const id of ids) {
      const t = d.taskMap.get(id);
      if (!t) continue;
      const n: PmTask = { ...t };
      const ch: string[] = [];
      if (shift) {
        n.start = t.start && addDays(t.start, shift);
        n.end = t.end && addDays(t.end, shift);
        if (t.start || t.end) ch.push(`일정 ${shift > 0 ? '+' : ''}${shift}일`);
      }
      if (st !== KEEP && t.status !== st) {
        n.status = st as PmTask['status'];
        if (st === '완료') n.actualPct = 100;
        ch.push(`상태 ${st}`);
      }
      if (who !== KEEP) {
        n.assigneeIds = who ? [who, ...t.assigneeIds.filter((x) => x !== who).slice(1)] : t.assigneeIds.slice(1);
        n.subAssigneeIds = t.subAssigneeIds.filter((x) => n.assigneeIds.includes(x) && x !== n.assigneeIds[0]);
        ch.push(`담당(정) ${who ? people.nameOf(who) : '없음'}`);
      }
      if (ms !== KEEP) {
        n.milestone = ms === '1';
        ch.push(ms === '1' ? '마일스톤 지정' : '마일스톤 해제');
      }
      if (exec.trim()) {
        n.execMemo = exec.trim();
        ch.push('실행 주체 변경');
      }
      if (ch.length) items.push({ next: n, summary: ch.join(', ') });
    }
    if (!items.length) {
      setMsg('바꿀 항목을 하나 이상 입력해 주세요');
      return;
    }
    mut.bulkUpdate.mutate(items, { onSuccess: onDone });
  };

  const inp = 'w-full rounded border border-border-hi px-2 py-1 text-[12.5px]';
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={`✏ 업무 일괄 수정 — ${ids.length}건`}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="flex-1" />
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={apply}>일괄 적용</Button>
        </div>
      }
    >
      <p className="mb-3 text-[11.5px] text-ink3">입력한 항목만 바뀌고 비워 둔 항목은 그대로 유지됩니다. 바뀐 내용은 변경 이력에 남습니다.</p>
      {msg && <div className="mb-2 rounded-lg bg-amber-soft px-3 py-1.5 text-[12px] text-ink2">{msg}</div>}
      <div className="grid gap-3 text-[11.5px] font-bold text-ink2">
        <label className="grid gap-1">일정 이동 (일)
          <input type="number" min={-365} max={365} className={inp} value={shift} onChange={(e) => setShift(Math.round(+e.target.value || 0))} />
          <small className="font-normal text-ink3">예: 7 → 시작·종료일을 7일 뒤로, -3 → 3일 앞으로 (날짜가 없는 업무는 그대로)</small>
        </label>
        <label className="grid gap-1">상태
          <select className={inp} value={st} onChange={(e) => setSt(e.target.value)}>
            <option value={KEEP}>유지</option>
            {PM_TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="grid gap-1">담당 (정)
          <select className={inp} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value={KEEP}>유지</option>
            <option value="">(비우기)</option>
            {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1">마일스톤(◆)
          <select className={inp} value={ms} onChange={(e) => setMs(e.target.value)}>
            <option value={KEEP}>유지</option>
            <option value="1">지정</option>
            <option value="0">해제</option>
          </select>
        </label>
        <label className="grid gap-1">기타 실행 주체 (입력 시 일괄 변경)
          <input className={inp} value={exec} onChange={(e) => setExec(e.target.value)} placeholder="예: 효광 구매TF / Cloud 공급사" />
        </label>
      </div>
    </Modal>
  );
}
