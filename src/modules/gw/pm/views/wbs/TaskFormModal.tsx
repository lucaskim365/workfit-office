import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { PM_TASK_STATUSES, pmTaskSchema, type PmTask } from '@/domain/pm/schema';
import type { PmDerived, usePmMutations } from '@/features/pm/usePm';
import type { usePmPeople } from '../../usePmPeople';

/**
 * 업무 추가 · 수정 · 복사 (wbsForm 6448). 같은 사업 안 번호 중복 불가, 단계를 고르면 다음 번호 추천.
 * 담당 = 그룹웨어 사용자 (첫 사람이 정, 두 번째부터 정/부).
 *
 * 데모와 다른 점: 데모는 시작·종료일이 필수지만, 지금 업무 목록은 날짜가 모두 비어 있어
 * 필수로 하면 날짜를 지어 넣어야 수정할 수 있다 → 비워도 저장되게 둠 (종료 ≥ 시작만 확인).
 */
export type TaskFormMode = { kind: 'new'; projectId: string; stage: string } | { kind: 'edit'; id: string } | { kind: 'copy'; id: string };

/** 다음 번호 (wbsNextCode 6386): 그 단계 마지막 번호의 끝 숫자 + 1, 사업 안에서 겹치지 않게 */
export function nextCode(tasks: readonly PmTask[], projectId: string, stage: string): string {
  const codes = tasks.filter((t) => t.projectId === projectId && (t.group || t.stage) === stage).map((t) => t.code);
  if (!codes.length) return '';
  const m = codes[codes.length - 1].match(/^(.*?)(\d+)$/);
  if (!m) return '';
  const used = new Set(tasks.filter((t) => t.projectId === projectId).map((t) => t.code));
  let n = +m[2] + 1;
  let c = '';
  do c = m[1] + String(n++).padStart(m[2].length, '0'); while (used.has(c));
  return c;
}

/** 선행 관계가 돌아서 자기에게 오는지 */
function reaches(tasks: Map<string, PmTask>, from: string, target: string, seen = new Set<string>()): boolean {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return (tasks.get(from)?.predecessorIds ?? []).some((p) => reaches(tasks, p, target, seen));
}

const NEW_STAGE = '__new';

function F({ err, label, field, full, help, children }: { err?: string; label: string; field?: string; full?: boolean; help?: string; children: ReactNode }) {
  return (
    <label className={`grid gap-1 text-[11.5px] font-bold text-ink2 ${full ? 'sm:col-span-2' : ''}`}>
      {label}
      <div className={field && err === field ? 'rounded ring-2 ring-danger' : ''}>{children}</div>
      {help && <small className="font-normal text-ink3">{help}</small>}
    </label>
  );
}
function Sec({ children }: { children: ReactNode }) {
  return <div className="mt-2 border-b border-border pb-1 text-[12px] font-bold text-navy sm:col-span-2">{children}</div>;
}

export function TaskFormModal({ mode, d, people, mut, shortOf, onClose, onSaved }: {
  mode: TaskFormMode;
  d: PmDerived;
  people: ReturnType<typeof usePmPeople>;
  mut: ReturnType<typeof usePmMutations>;
  shortOf: (id: string) => string;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}) {
  const { snap } = d;
  const src = mode.kind === 'new' ? null : d.taskMap.get(mode.id) ?? null;
  const stagesOf = (k: string) => [...new Set(snap.tasks.filter((t) => t.projectId === k).map((t) => t.group || t.stage))];
  const init = useMemo(() => {
    if (src) {
      const copy = mode.kind === 'copy';
      return {
        projectId: src.projectId,
        stage: src.group || src.stage,
        newStage: '',
        code: copy ? nextCode(snap.tasks, src.projectId, src.group || src.stage) : src.code,
        name: copy ? `${src.name} (복사)` : src.name,
        output: src.output,
        pmName: src.pmName,
        assignees: src.assigneeIds.map((a) => ({ id: a, sub: src.subAssigneeIds.includes(a) })),
        execMemo: src.execMemo,
        start: src.start,
        end: src.end,
        status: copy ? ('계획' as const) : src.status,
        milestone: src.milestone,
        pre: copy ? '' : src.predecessorIds.map((x) => x.split('|')[1]).join(', '),
        planPct: copy ? 0 : src.planPct,
        actualPct: copy ? 0 : src.actualPct,
        md: src.md == null ? '' : String(src.md),
        memo: src.memo,
      };
    }
    const k = mode.kind === 'new' ? mode.projectId : '';
    const st0 = mode.kind === 'new' && mode.stage ? mode.stage : stagesOf(k)[0] ?? '';
    return {
      projectId: k, stage: st0, newStage: '', code: nextCode(snap.tasks, k, st0), name: '', output: '',
      pmName: snap.projects.find((p) => p.id === k)?.pmName ?? '', assignees: [] as { id: string; sub: boolean }[], execMemo: '',
      start: '', end: '', status: '계획' as const, milestone: false, pre: '', planPct: 0, actualPct: 0, md: '', memo: '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [v, setV] = useState(init);
  const [err, setErr] = useState<{ msg: string; field: string } | null>(null);
  const set = <K extends keyof typeof v>(key: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [key]: val }));
  const ticketLocked = false; // 2단계: 티켓이 있는 업무는 다른 사업으로 못 옮김

  const title = mode.kind === 'new' ? '📝 업무 추가' : mode.kind === 'copy' ? `업무 복사 — ${src?.code}` : `업무 수정 — ${shortOf(src!.projectId)} ${src!.code}`;

  const save = () => {
    const stage = v.stage === NEW_STAGE ? v.newStage.trim() : v.stage;
    const fail = (msg: string, field: string) => setErr({ msg, field });
    if (!v.projectId) return fail('사업을 골라 주세요', 'projectId');
    if (!stage) return fail(v.stage === NEW_STAGE ? '새 단계명을 입력해 주세요' : '단계를 골라 주세요', 'stage');
    if (!v.code.trim()) return fail('번호를 입력해 주세요', 'code');
    if (/\|/.test(v.code)) return fail('번호에 | 문자는 쓸 수 없습니다', 'code');
    if (!v.name.trim()) return fail('업무명을 입력해 주세요', 'name');
    const id = `${v.projectId}|${v.code.trim()}`;
    const isNew = mode.kind !== 'edit';
    if ((isNew || id !== src?.id) && d.taskMap.has(id)) return fail(`이 사업에 이미 ${v.code} 번호가 있습니다`, 'code');
    if (v.start && v.end && v.end < v.start) return fail('종료일은 시작일 이후여야 합니다', 'end');
    if (v.status === '완료' && v.actualPct < 100) return fail('완료 상태는 실적 진행률이 100%여야 합니다', 'actualPct');
    if (ticketLocked && src && src.projectId !== v.projectId) return fail('티켓이 발행된 업무는 다른 사업으로 옮길 수 없습니다', 'projectId');
    const md = v.md.trim() === '' ? null : Number(v.md);
    if (md != null && !(md >= 0)) return fail('공수는 0 이상 숫자로 넣어 주세요', 'md');
    // 선행 업무 (같은 사업 안 번호)
    const preIds = v.pre.split(',').map((x) => x.trim()).filter(Boolean).map((c) => `${v.projectId}|${c}`);
    const mine = [id, src && mode.kind === 'edit' ? src.id : ''].filter(Boolean);
    for (const p of preIds) {
      const c = p.split('|')[1];
      if (mine.includes(p)) return fail('자기 자신을 선행 업무로 지정할 수 없습니다', 'pre');
      if (!d.taskMap.has(p)) return fail(`${shortOf(v.projectId)}에 ${c} 업무가 없습니다`, 'pre');
      if (mine.some((m) => reaches(d.taskMap, p, m))) return fail(`${c}와 순환 관계가 됩니다 (서로가 서로의 선행)`, 'pre');
    }
    const ids = v.assignees.map((a) => a.id).filter(Boolean);
    const base = mode.kind === 'edit' && src ? src : null;
    const parsed = pmTaskSchema.safeParse({
      ...(base ?? {}),
      id,
      projectId: v.projectId,
      stage,
      group: stage,
      code: v.code.trim(),
      name: v.name.trim(),
      output: v.output.trim(),
      pmName: v.pmName,
      assigneeIds: [...new Set(ids)],
      subAssigneeIds: v.assignees.slice(1).filter((a) => a.sub && a.id).map((a) => a.id),
      execMemo: v.execMemo.trim(),
      start: v.start,
      end: v.end,
      milestone: v.milestone,
      status: v.status,
      planPct: Math.max(0, Math.min(100, +v.planPct || 0)),
      actualPct: v.status === '완료' ? 100 : Math.max(0, Math.min(100, +v.actualPct || 0)),
      md,
      memo: v.memo,
      info: base?.info ?? (mode.kind === 'copy' ? src?.info ?? '' : ''),
      predecessorIds: preIds,
    });
    if (!parsed.success) {
      const iss = parsed.error.issues[0];
      return fail(`입력을 확인해 주세요: ${iss?.message ?? '알 수 없는 오류'}`, String(iss?.path?.[0] ?? ''));
    }
    const next = parsed.data;
    const done = () => onSaved(id);
    const onError = (e: Error) => fail(e.message, 'code');
    if (mode.kind === 'edit') mut.updateTask.mutate({ id: src!.id, next }, { onSuccess: done, onError });
    else mut.addTask.mutate(next, { onSuccess: done, onError });
  };

  const inp = 'w-full rounded border border-border-hi px-2 py-1 text-[12.5px]';
  const stageOpts = stagesOf(v.projectId);

  return (
    <Modal
      open
      onClose={onClose}
      width={720}
      title={title}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="flex-1" />
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={save}>{mode.kind === 'edit' ? '저장' : '추가'}</Button>
        </div>
      }
    >
      <p className="mb-2 text-[11.5px] text-ink3">
        {mode.kind === 'edit' ? '바꾼 칸은 변경 이력에 남습니다.' : '사업과 단계를 고르면 다음 번호가 자동 추천됩니다.'}
      </p>
      {err && <div className="mb-2 rounded-lg bg-danger/10 px-3 py-1.5 text-[12px] font-bold text-danger">{err.msg}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Sec>① 위치</Sec>
        <F err={err?.field} label="사업 *" field="projectId">
          <select
            className={inp}
            value={v.projectId}
            onChange={(e) => {
              const k = e.target.value;
              const st0 = stagesOf(k)[0] ?? '';
              setV((x) => ({ ...x, projectId: k, stage: st0, code: nextCode(snap.tasks, k, st0) || x.code, pmName: snap.projects.find((p) => p.id === k)?.pmName || x.pmName }));
            }}
          >
            <option value="">— 선택 —</option>
            {snap.projects.map((p) => <option key={p.id} value={p.id}>{shortOf(p.id)} · {p.company}</option>)}
          </select>
        </F>
        <F err={err?.field} label="단계 · 묶음 *" field="stage">
          <select
            className={inp}
            value={v.stage}
            onChange={(e) => {
              const st = e.target.value;
              const c = st === NEW_STAGE ? '' : nextCode(snap.tasks, v.projectId, st);
              setV((x) => ({ ...x, stage: st, code: c || x.code }));
            }}
          >
            {stageOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value={NEW_STAGE}>+ 새 단계 추가</option>
          </select>
        </F>
        {v.stage === NEW_STAGE && <F err={err?.field} label="새 단계명" field="stage"><input className={inp} value={v.newStage} onChange={(e) => set('newStage', e.target.value)} placeholder="예: 16 추가개발" /></F>}
        <F err={err?.field} label="번호 *" field="code" help="같은 사업 안에서 중복 불가 · 단계를 바꾸면 다음 번호가 추천됩니다"><input className={inp} value={v.code} onChange={(e) => set('code', e.target.value)} placeholder="예: 01-10" /></F>
        <F err={err?.field} label="업무명 *" field="name" full><textarea className={inp} rows={2} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 작업지시 화면 개발" /></F>
        <F err={err?.field} label="산출물 (완료 조건)" full><input className={inp} value={v.output} onChange={(e) => set('output', e.target.value)} placeholder="예: I/F 정의서 · 연동 테스트 결과서" /></F>

        <Sec>② 담당</Sec>
        <F err={err?.field} label="PM">
          <select className={inp} value={v.pmName} onChange={(e) => set('pmName', e.target.value)}>
            <option value="">-</option>
            {v.pmName && !people.people.some((p) => p.label === v.pmName) && <option value={v.pmName}>{v.pmName}</option>}
            {people.people.map((p) => <option key={p.id} value={p.label}>{p.label}</option>)}
          </select>
        </F>
        <div />
        <F err={err?.field} label="담당자" full help="첫 번째 담당자가 정 · 기본 담당입니다. 두 번째부터 정/부를 고릅니다">
          <div className="grid gap-1.5">
            {v.assignees.map((a, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <select
                  className={inp}
                  value={a.id}
                  onChange={(e) => setV((x) => ({ ...x, assignees: x.assignees.map((y, j) => (j === i ? { ...y, id: e.target.value } : y)) }))}
                >
                  <option value="">- 선택</option>
                  {people.people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                {i === 0 ? (
                  <span className="w-[58px] text-center text-[11px] text-ink3">정</span>
                ) : (
                  <select
                    className="w-[58px] rounded border border-border-hi px-1 py-1 text-[12px]"
                    value={a.sub ? '부' : '정'}
                    onChange={(e) => setV((x) => ({ ...x, assignees: x.assignees.map((y, j) => (j === i ? { ...y, sub: e.target.value === '부' } : y)) }))}
                  >
                    <option>정</option>
                    <option>부</option>
                  </select>
                )}
                <Button size="sm" variant="ghost" onClick={() => setV((x) => ({ ...x, assignees: x.assignees.filter((_, j) => j !== i) }))}>✕</Button>
              </div>
            ))}
            <div><Button size="sm" onClick={() => setV((x) => ({ ...x, assignees: [...x.assignees, { id: '', sub: x.assignees.length > 0 }] }))}>+ 담당자</Button></div>
          </div>
        </F>
        <F err={err?.field} label="기타 실행 주체" full help="사람이 아닌 실행 주체 · 여러 개는 / 로 구분"><input className={inp} value={v.execMemo} onChange={(e) => set('execMemo', e.target.value)} placeholder="예: 효광 구매TF / Cloud 공급사" /></F>

        <Sec>③ 일정 · 진행</Sec>
        <F err={err?.field} label="시작일" field="start"><input type="date" className={inp} value={v.start} onChange={(e) => set('start', e.target.value)} /></F>
        <F err={err?.field} label="종료일" field="end"><input type="date" className={inp} value={v.end} onChange={(e) => set('end', e.target.value)} /></F>
        <F err={err?.field} label="상태">
          <select className={inp} value={v.status} onChange={(e) => set('status', e.target.value as PmTask['status'])}>
            {PM_TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </F>
        <F err={err?.field} label="공수 (MD)" field="md"><input className={inp} inputMode="decimal" value={v.md} onChange={(e) => set('md', e.target.value)} placeholder="예: 7.5" /></F>
        <label className="flex items-center gap-2 text-[12px] font-bold text-ink2 sm:col-span-2">
          <input type="checkbox" checked={v.milestone} onChange={(e) => set('milestone', e.target.checked)} />마일스톤(◆) — 감리·점검 등 주요 시점
        </label>
        <F err={err?.field} label="선행 업무 (번호)" field="pre" full help="이 업무보다 먼저 끝나야 하는 업무 · 쉼표로 구분 · 같은 사업 안에서만"><input className={inp} value={v.pre} onChange={(e) => set('pre', e.target.value)} placeholder="예: 01-01, 01-03" /></F>
        <F err={err?.field} label="계획 진행률 (%)"><input type="number" min={0} max={100} className={inp} value={v.planPct} onChange={(e) => set('planPct', +e.target.value)} /></F>
        <F err={err?.field} label="실적 진행률 (%)" field="actualPct"><input type="number" min={0} max={100} className={inp} value={v.actualPct} onChange={(e) => set('actualPct', +e.target.value)} /></F>
        <F err={err?.field} label="할 일 메모" full><textarea className={inp} rows={3} value={v.memo} onChange={(e) => set('memo', e.target.value)} /></F>
      </div>
    </Modal>
  );
}
