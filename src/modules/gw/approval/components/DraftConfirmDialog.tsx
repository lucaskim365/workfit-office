import type { ReactNode } from 'react';

export function DraftConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmColor = 'bg-teal',
  onConfirm,
  onCancel,
  onDiscard,
  discardLabel = '변경내용 모두 취소',
  disabled,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onDiscard?: () => void;
  discardLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[400] grid place-items-center bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
      <div className="w-[385px] rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[14px] font-bold text-ink mb-1.5 flex items-center gap-1.5">
          <span>⚠️</span> {title}
        </h3>
        <p className="text-[11.5px] leading-relaxed text-ink2 mb-4">
          {description}
        </p>
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold text-ink2 bg-panel-alt hover:bg-border-hi/30 transition-colors shrink-0"
          >
            돌아가기
          </button>
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              disabled={disabled}
              className="h-8 px-2.5 rounded-lg text-[11.5px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {discardLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className={`h-8 px-3 rounded-lg text-[11.5px] font-bold text-white ${confirmColor} hover:opacity-90 disabled:opacity-50 transition-colors shrink-0`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
