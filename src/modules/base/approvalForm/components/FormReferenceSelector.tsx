import { useState } from 'react';
import { SelectorDialog } from '@/modules/gw/approval/components/DraftRecipientSection';

export interface FormReferenceSelectorProps {
  /** 기본 참조 부서(하나) */
  deptId: string | null | undefined;
  /** 기본 참조 사용자(여러 명) */
  userIds: string[];
  depts: any[];
  users: any[];
  org: any;
  onChange: (patch: { deptId: string | null; userIds: string[] }) => void;
}

/**
 * 기본 참조 대상 — 이 서식으로 쓰는 모든 문서에 참조로 붙는 사람(여러 명)과 부서(하나).
 * [대상 선택]으로 고른 것은 이미 있는 목록에 더해지고, 하나씩 ✕ 로 뺀다
 */
export function FormReferenceSelector({ deptId, userIds, depts, users, org, onChange }: FormReferenceSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const chip = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-soft text-teal text-[11.5px] font-bold border border-teal/15 shadow-2xs';
  const tag = 'text-[10px] font-extrabold text-teal/70';
  const remove = 'hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10.5px]';

  return (
    <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">기본 참조 대상</span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 rounded bg-teal text-white text-[11px] font-bold hover:bg-teal-dark transition-colors cursor-pointer shadow-xs"
        >
          대상 선택
        </button>
      </div>

      <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border p-2.5 bg-panel-alt/30">
        {deptId && (
          <span className={chip}>
            <span className={tag}>[부서]</span>
            <span>{depts.find((d) => d.id === deptId)?.name || '알 수 없는 부서'}</span>
            <button type="button" onClick={() => onChange({ deptId: null, userIds })} className={remove} title="빼기">
              ✕
            </button>
          </span>
        )}
        {userIds.map((id) => (
          <span key={id} className={chip}>
            <span className={tag}>[사용자]</span>
            <span>{users.find((u) => u.id === id)?.name || '알 수 없는 사원'}</span>
            <button type="button" onClick={() => onChange({ deptId: deptId ?? null, userIds: userIds.filter((x) => x !== id) })} className={remove} title="빼기">
              ✕
            </button>
          </span>
        ))}
        {!deptId && userIds.length === 0 && <div className="text-[11px] text-ink3 my-auto pl-1">지정된 대상이 없습니다. (지정 안 함)</div>}
      </div>
      <div className="text-[10.5px] text-ink3">기안 상신 즉시 참조 열람할 사용자(여러 명)와 부서(하나)</div>

      {modalOpen && (
        <SelectorDialog
          title="기본 참조 대상"
          org={org}
          excludeIds={new Set(userIds)}
          onConfirm={(items: any[]) => {
            const pickedUsers = items.filter((i) => i.type === 'user').map((i) => i.id as string);
            const pickedDepts = items.filter((i) => i.type === 'dept');
            if (pickedDepts.length > 1) alert(`참조 부서는 하나만 정할 수 있어 '${pickedDepts[0].name}'만 넣었습니다.`);
            onChange({
              deptId: pickedDepts[0]?.id ?? deptId ?? null,
              userIds: [...userIds, ...pickedUsers.filter((id) => !userIds.includes(id))],
            });
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
