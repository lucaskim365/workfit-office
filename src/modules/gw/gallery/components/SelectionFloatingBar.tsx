import React from 'react';
import { Check, Copy, FolderInput, Trash2, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';

interface SelectionFloatingBarProps {
  selectedCount: number;
  totalCount: number;
  canCopy?: boolean;
  canDelete?: boolean;
  onSelectAll: () => void;
  onCancelSelection: () => void;
  onOpenMoveModal: () => void;
  onOpenCopyModal?: () => void;
  onDeleteSelected?: () => void;
}

export const SelectionFloatingBar: React.FC<SelectionFloatingBarProps> = ({
  selectedCount,
  totalCount,
  canCopy = false,
  canDelete = true,
  onSelectAll,
  onCancelSelection,
  onOpenMoveModal,
  onOpenCopyModal,
  onDeleteSelected,
}) => {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-border bg-panel/95 px-4 py-2.5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
      {/* 선택 개수 뱃지 */}
      <div className="flex items-center gap-2 pr-1">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal text-white font-mono text-xs font-bold shadow-xs">
          {selectedCount}
        </span>
        <span className="text-xs font-bold text-ink whitespace-nowrap">
          {selectedCount}장 선택됨
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* 전체 선택 / 해제 토글 */}
      <button
        type="button"
        onClick={onSelectAll}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink2 hover:bg-panel-alt hover:text-ink transition-colors whitespace-nowrap"
      >
        <Check className={`h-3.5 w-3.5 ${isAllSelected ? 'text-teal' : 'text-ink3'}`} />
        <span>{isAllSelected ? '전체 해제' : '전체 선택'}</span>
      </button>

      {/* 앨범에 넣기(이동) 버튼 */}
      <Button
        type="button"
        size="sm"
        variant="primary"
        onClick={onOpenMoveModal}
      >
        <FolderInput className="h-3.5 w-3.5 mr-1" />
        <span>앨범 이동</span>
      </Button>

      {/* 다른 앨범에 복사 버튼 (최근항목이 아닌 앨범일 때 노출) */}
      {canCopy && onOpenCopyModal && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onOpenCopyModal}
        >
          <Copy className="h-3.5 w-3.5 mr-1 text-teal" />
          <span>앨범 복사</span>
        </Button>
      )}

      {/* 선택 삭제 버튼 */}
      {canDelete && onDeleteSelected && (
        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={onDeleteSelected}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          <span>삭제 ({selectedCount})</span>
        </Button>
      )}

      <div className="h-4 w-px bg-border" />

      {/* 닫기 / 선택 취소 */}
      <button
        type="button"
        onClick={onCancelSelection}
        title="선택 해제 (ESC)"
        className="flex items-center gap-1 rounded-xl p-1.5 text-ink3 hover:bg-panel-alt hover:text-ink transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
