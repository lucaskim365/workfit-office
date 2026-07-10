import { useMemo, useState } from 'react';
import { useUsers } from '@/features/user/useUsers';
import { useOrgTree } from '@/features/gw/useOrgTree';
import { useRouteEngine } from '@/features/gw/useRouteEngine';
import { STEP_KINDS, type ApprovalStep, type StepKind } from '@/domain/approvalDoc/schema';
import type { User } from '@/domain/user/schema';
import { KIND_TONE } from '@/modules/gw/_gw';

/**
 * 결재선 빌더(§7.3) — 3방식 병행: ① 자동 상신선(상급자 체인) ② 전결규정 적용
 * ③ 수동(피커로 추가·구분 지정·순서·병렬 묶기). 어느 방식이든 동일 steps[]로 수렴.
 * 완전 제어형: 내부 상태 없이 props(steps)에서 편집표현을 도출해 병렬 태그 드리프트를 방지.
 */

/** 편집표현 — 병렬은 "이전과 묶기(linkedPrev)"로 표현해 seq/태그 드리프트를 없앤다. */
interface EditStep {
  approverId: string;
  kind: StepKind;
  linkedPrev: boolean;
}

function toEdit(steps: ApprovalStep[]): EditStep[] {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  return sorted.map((s, i) => ({
    approverId: s.approverId,
    kind: s.kind,
    linkedPrev: i > 0 && !!s.parallelGroup && s.parallelGroup === sorted[i - 1].parallelGroup,
  }));
}

/** 편집표현 → steps[]: seq=순번, 연속 linked 런은 같은 parallelGroup 태그 부여. */
function toSteps(edits: EditStep[]): ApprovalStep[] {
  return edits.map((e, i) => {
    // linked 런의 시작 인덱스를 태그로 사용(안정적·결정적).
    let runStart = i;
    while (runStart > 0 && edits[runStart].linkedPrev) runStart--;
    const runHasParallel = (edits[i].linkedPrev || (i + 1 < edits.length && edits[i + 1].linkedPrev));
    return {
      seq: i + 1,
      parallelGroup: runHasParallel ? `G${runStart + 1}` : null,
      kind: e.kind,
      approverId: e.approverId,
      delegatedFromId: null,
      decision: '대기' as const,
      decidedAt: null,
      comment: '',
    };
  });
}

export function ApprovalLineBuilder({
  steps,
  onChange,
  drafterId,
  docType,
  amount,
}: {
  steps: ApprovalStep[];
  onChange: (steps: ApprovalStep[]) => void;
  drafterId: string;
  docType: string;
  amount: number | null;
}) {
  const { data: users = [] } = useUsers();
  const org = useOrgTree();
  const route = useRouteEngine();
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null);
  const [addParallel, setAddParallel] = useState(false);

  const edits = useMemo(() => toEdit(steps), [steps]);
  const nameOf = (id: string) => org.userById(id)?.name ?? id;
  const deptPosOf = (id: string) => {
    const u = org.userById(id);
    return u ? `${u.dept} · ${u.position}` : '';
  };

  const emit = (next: EditStep[]) => onChange(toSteps(next));

  const setKind = (i: number, kind: StepKind) => emit(edits.map((e, idx) => (idx === i ? { ...e, kind } : e)));
  const toggleLink = (i: number) => emit(edits.map((e, idx) => (idx === i ? { ...e, linkedPrev: !e.linkedPrev } : e)));
  const remove = (i: number) => emit(edits.filter((_, idx) => idx !== i).map((e, idx) => (idx === 0 ? { ...e, linkedPrev: false } : e)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= edits.length) return;
    const next = [...edits];
    [next[i], next[j]] = [next[j], next[i]];
    next[0] = { ...next[0], linkedPrev: false };
    emit(next);
  };
  const pick = (userId: string) => {
    if (!picker) return;
    if (picker.mode === 'add') {
      emit([...edits, { approverId: userId, kind: '결재', linkedPrev: false }]);
    } else {
      emit(edits.map((e, idx) => (idx === picker.index ? { ...e, approverId: userId } : e)));
    }
    setPicker(null);
  };

  const fillAuto = () => {
    // 동적 결재선 룰 엔진 — 기안자 부서·직급·금액에 맞는 결재선을 생성.
    const built = route.build({ drafterId, docType, amount });
    onChange(built.length ? built : steps);
  };

  const dupWarn = useMemo(() => {
    const ids = edits.map((e) => e.approverId);
    return ids.includes(drafterId) || new Set(ids).size !== ids.length;
  }, [edits, drafterId]);

  return (
    <div>
      {/* 상단 3방식 툴바 */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={fillAuto}
          disabled={route.isLoading}
          title="기안자 부서·직급·금액에 맞는 결재선을 룰 엔진으로 자동 생성"
          className="rounded-lg border border-border-hi bg-panel-alt px-2.5 py-1 text-[11px] font-semibold text-ink2 hover:border-teal hover:text-teal disabled:opacity-50"
        >
          ⚡ 자동 결재선(룰)
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-lg border border-border-hi bg-panel-alt px-2.5 py-1 text-[11px] font-semibold text-ink3 hover:text-red-500"
        >
          비우기
        </button>
        <span className="ml-auto text-[10.5px] text-ink3">{edits.length}단계</span>
      </div>

      {/* 결재선 노드 리스트 */}
      <div className="space-y-1.5">
        {edits.map((e, i) => (
          <div key={i} className="rounded-lg border border-border bg-panel-alt px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-soft text-[10px] font-bold text-teal">{i + 1}</span>
              <button
                type="button"
                onClick={() => setPicker({ mode: 'replace', index: i })}
                className="min-w-0 flex-1 text-left"
              >
                <span className="truncate text-[12px] font-semibold text-ink">{nameOf(e.approverId)}</span>
                <span className="ml-1 text-[10px] text-ink3">{deptPosOf(e.approverId)}</span>
              </button>
              <select
                value={e.kind}
                onChange={(ev) => setKind(i, ev.target.value as StepKind)}
                className={`shrink-0 rounded border border-border-hi bg-panel px-1.5 py-1 text-[11px] font-semibold outline-none ${KIND_TONE[e.kind]}`}
              >
                {STEP_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(i, -1)} className="text-[9px] leading-none text-ink3 hover:text-ink">▲</button>
                <button type="button" onClick={() => move(i, 1)} className="text-[9px] leading-none text-ink3 hover:text-ink">▼</button>
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 text-[13px] text-ink3 hover:text-red-500">✕</button>
            </div>
          </div>
        ))}
        {edits.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-[11px] text-ink3">
            결재선이 비어 있습니다. 자동 상신선 또는 결재자 추가로 구성하세요.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPicker({ mode: 'add' })}
        className="mt-2 w-full rounded-lg border border-dashed border-border-hi py-1.5 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal"
      >
        + 결재자 추가
      </button>

      {dupWarn && (
        <p className="mt-1.5 text-[10.5px] text-amber">⚠ 기안자 본인 또는 중복 결재자가 포함돼 있습니다.</p>
      )}

      {/* 결재자 피커 팝오버 */}
      {picker && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-4" onClick={() => setPicker(null)}>
          <div className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl bg-panel shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="border-b border-border px-4 py-3 text-[13px] font-bold text-ink flex items-center justify-between">
              <span>{picker.mode === 'add' ? '결재자 추가' : '결재자 변경'}</span>
            </div>
            <UserPickList users={users.filter((u) => u.status === '사용')} onPick={pick} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 검색 가능한 사용자 선택 리스트(MemberPicker 톤 재사용). */
function UserPickList({ users, onPick }: { users: User[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const kw = q.trim().toLowerCase();
  const list = users.filter((u) => !kw || u.name.toLowerCase().includes(kw) || u.dept.toLowerCase().includes(kw));
  return (
    <div className="flex max-h-[62vh] flex-col">
      <div className="border-b border-border p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·부서 검색"
          className="w-full rounded-full border border-border-hi bg-panel-alt px-3.5 py-2 text-[12px] text-ink outline-none focus:border-teal"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u.id)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left hover:bg-panel-alt"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-soft text-[12px] font-bold text-teal">{u.name[0]}</span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-semibold text-ink">{u.name}</div>
              <div className="truncate text-[10.5px] text-ink3">{u.dept} · {u.position}</div>
            </div>
          </button>
        ))}
        {list.length === 0 && <div className="py-8 text-center text-[11.5px] text-ink3">대상이 없습니다</div>}
      </div>
    </div>
  );
}
