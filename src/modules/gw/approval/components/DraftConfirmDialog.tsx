import type { ReactNode } from 'react';

export function DraftConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmColor = 'bg-teal',
  onConfirm,
  onCancel,
  disabled,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      <div className="w-[340px] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-bold text-ink mb-1.5 flex items-center gap-1.5">
          <span>⚠️</span> {title}
        </h3>
        <p className="text-[11.5px] leading-relaxed text-ink2 mb-4">
          {description}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 rounded-lg text-[11.5px] font-semibold text-ink2 bg-panel-alt hover:bg-border-hi/30 transition-colors"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`h-8 px-3.5 rounded-lg text-[11.5px] font-bold text-white ${confirmColor} hover:opacity-90 disabled:opacity-50 transition-colors`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
