import type { ApprovalDoc } from '@/domain/approvalDoc/schema';
import type { User } from '@/domain/user/schema';
import { ApprovalDocumentView } from '../ApprovalDocumentView';

export function DocumentPreviewModal({
  title,
  doc,
  currentUser,
  onClose,
}: {
  title: string;
  doc: ApprovalDoc;
  currentUser?: User;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[400] grid place-items-center bg-black/45 p-4 animate-fadeIn"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-panel-alt/30 px-5 py-3">
          <div className="text-[13.5px] font-bold text-ink flex items-center gap-1.5">
            <span>📄</span> {title}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="grid h-8 w-8 place-items-center rounded-lg text-[16px] text-ink3 hover:bg-panel-alt"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 bg-white dark:bg-black/10">
          <ApprovalDocumentView doc={doc} currentUser={currentUser} />
        </div>
        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3 bg-panel-alt/20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-lg bg-teal px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 shadow-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
