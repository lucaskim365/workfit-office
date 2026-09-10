import { AlertTriangle, Save, Trash2, X } from 'lucide-react';

interface FormChangeConfirmDialogProps {
  open: boolean;
  currentFormName: string;
  onSaveAndChange: () => void;
  onDiscardAndChange: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function FormChangeConfirmDialog({
  open,
  currentFormName,
  onSaveAndChange,
  onDiscardAndChange,
  onCancel,
  isSaving = false,
}: FormChangeConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5 text-amber-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="font-extrabold text-sm text-ink">양식 변경 안내</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg p-1 text-ink3 hover:bg-panel-alt hover:text-ink transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 안내 */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-ink leading-relaxed">
            현재 <strong className="text-teal font-bold">{currentFormName}</strong> 양식으로 작성 중인 내용이 있습니다.
          </p>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-[11.5px] text-ink2 leading-relaxed">
            새로운 양식으로 변경하면 현재 입력된 필드 구성이 달라집니다. 작성 중인 내용을 보존할지 선택해 주세요.
          </div>
        </div>

        {/* 선택 버튼 영역 */}
        <div className="flex flex-col gap-2 p-5 pt-0">
          {/* 1. 임시저장 후 변경 */}
          <button
            type="button"
            onClick={onSaveAndChange}
            disabled={isSaving}
            className="flex items-center justify-between rounded-xl bg-teal px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-dark transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              <span>작성 내용 임시 저장 후 새 양식 선택</span>
            </span>
            <span className="text-[10px] opacity-80">권장</span>
          </button>

          {/* 2. 폐기 후 변경 */}
          <button
            type="button"
            onClick={onDiscardAndChange}
            disabled={isSaving}
            className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <span>작성 내용 폐기 후 새 양식 선택</span>
            </span>
            <span className="text-[10px] opacity-80">초기화</span>
          </button>

          {/* 3. 취소 */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="mt-1 rounded-xl border border-border py-2 text-xs font-bold text-ink3 hover:bg-panel-alt hover:text-ink transition-colors cursor-pointer"
          >
            취소 (계속 작성)
          </button>
        </div>
      </div>
    </div>
  );
}
