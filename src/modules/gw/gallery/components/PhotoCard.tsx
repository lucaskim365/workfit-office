import React, { memo } from 'react';
import { Camera, Pencil, Trash2, Check } from 'lucide-react';
import type { GalleryItem } from '../types';

interface PhotoCardProps {
  item: GalleryItem;
  albumName?: string;
  canManage: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onOpenEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export const PhotoCard = memo(function PhotoCard({
  item,
  albumName,
  canManage,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onContextMenu,
  onOpenEdit,
  onDelete,
  onClick,
}: PhotoCardProps) {
  const count = item.images.length;
  const currentImg = item.images[0] || '';
  const captionText = item.caption || item.description || '';

  return (
    <div
      onClick={() => {
        if (isSelectionMode && onToggleSelect) {
          onToggleSelect();
        } else {
          onClick();
        }
      }}
      onContextMenu={onContextMenu}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-panel shadow-xs transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-teal ring-2 ring-teal ring-offset-2 scale-[0.98]'
          : 'border-border hover:shadow-md hover:border-teal/50'
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-panel-alt select-none">
        {currentImg ? (
          <img
            src={currentImg}
            alt={captionText || '갤러리 사진'}
            className={`h-full w-full object-cover transition-transform duration-300 ${
              isSelected ? 'scale-100 brightness-95' : 'group-hover:scale-105'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-ink3">사진 없음</div>
        )}

        {/* ── 호버 즉시 선택 체크박스 (Google Photos 스타일) ── */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          title={isSelected ? '선택 해제' : '사진 선택'}
          className={`absolute top-2.5 left-2.5 z-10 transition-all ${
            isSelected
              ? 'opacity-100'
              : isSelectionMode
              ? 'opacity-70 group-hover:opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform shadow-md ${
              isSelected
                ? 'bg-teal border-white text-white scale-105'
                : 'bg-black/40 border-white/90 text-transparent hover:border-white hover:bg-black/70 hover:scale-110'
            }`}
          >
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          </div>
        </div>

        {/* ── 관리 버튼 (수정, 삭제) : 선택 모드가 아닐 때 호버 노출 ── */}
        {!isSelectionMode && canManage && (
          <div
            className="absolute top-2.5 left-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onOpenEdit}
              title="캡션 수정"
              className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[10px] text-white hover:bg-teal transition-colors shadow-xs"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="사진 삭제"
              className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[10px] text-white hover:bg-danger transition-colors shadow-xs"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* ── 다중 사진 매수 배지 ── */}
        {count > 1 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-white backdrop-blur-xs">
            <Camera className="h-3 w-3" />
            <span>{count}</span>
          </div>
        )}

        {/* ── 하단 캡션 오버레이 ── */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 text-white pointer-events-none">
          {captionText ? (
            <p className="text-xs font-semibold truncate leading-tight drop-shadow-xs">{captionText}</p>
          ) : null}
          <div className="flex items-center justify-between text-[9.5px] text-white/80 mt-0.5 font-mono">
            <span>{item.date}</span>
            {albumName && <span className="truncate max-w-[80px]">{albumName}</span>}
          </div>
        </div>
      </div>
    </div>
  );
});
