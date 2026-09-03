import { useState } from 'react';
import { SelectorDialog } from '@/modules/gw/approval/components/DraftRecipientSection';

export interface FormTargetSelectorProps {
  title: string;
  desc: string;
  deptId: string | null | undefined;
  userId: string | null | undefined;
  depts: any[];
  users: any[];
  org: any;
  onChange: (patch: { deptId: string | null; userId: string | null }) => void;
}

export function FormTargetSelector({
  title, desc, deptId, userId, depts, users, org, onChange,
}: FormTargetSelectorProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-panel p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <span className="text-[13px] font-bold text-ink flex items-center gap-1.5">{title}</span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-2.5 py-1 rounded bg-teal text-white text-[11px] font-bold hover:bg-teal-dark transition-colors cursor-pointer shadow-xs"
        >
          대상 선택
        </button>
      </div>

      <div className="flex items-center min-h-[38px] rounded-lg border border-dashed border-border p-2.5 bg-panel-alt/30">
        {deptId || userId ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-soft text-teal text-[11.5px] font-bold border border-teal/15 shadow-2xs">
            {deptId ? (
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-extrabold text-teal/70">[부서]</span>
                <span>{depts.find((d) => d.id === deptId)?.name || '알 수 없는 부서'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="text-[10px] font-extrabold text-teal/70">[사용자]</span>
                <span>{users.find((u) => u.id === userId)?.name || '알 수 없는 사원'}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange({ deptId: null, userId: null })}
              className="hover:text-red-500 font-bold transition-colors ml-1 cursor-pointer text-[10.5px]"
            >
              ✕
            </button>
          </span>
        ) : (
          <div className="text-[11px] text-ink3 my-auto pl-1">지정된 대상이 없습니다. (지정 안 함)</div>
        )}
      </div>
      <div className="text-[10.5px] text-ink3">{desc}</div>

      {modalOpen && (
        <SelectorDialog
          title={title}
          org={org}
          singleSelect={true}
          onConfirm={(items: any[]) => {
            if (items.length === 0) {
              onChange({ deptId: null, userId: null });
            } else {
              const item = items[0];
              if (item.type === 'dept') {
                onChange({ deptId: item.id, userId: null });
              } else {
                onChange({ deptId: null, userId: item.id });
              }
            }
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
