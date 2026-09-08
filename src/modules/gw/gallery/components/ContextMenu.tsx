import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { GalleryItem } from '../types';

interface ContextMenuProps {
  contextMenu: { x: number; y: number; item: GalleryItem } | null;
  selectedAlbumId: string;
  onSetCoverImage: (albumId: string, imageUrl: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  selectedAlbumId,
  onSetCoverImage,
}) => {
  if (!contextMenu) return null;

  return (
    <div
      style={{ top: contextMenu.y, left: contextMenu.x }}
      className="fixed z-50 min-w-[220px] overflow-hidden rounded-2xl border border-border bg-panel p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 border-b border-border/50">
        <span className="text-[10.5px] font-bold text-ink3">앨범 대표 이미지 옵션</span>
      </div>
      <button
        type="button"
        onClick={() => {
          const targetAlb = selectedAlbumId !== 'recent' ? selectedAlbumId : contextMenu.item.albumId;
          if (targetAlb && targetAlb !== 'recent') {
            onSetCoverImage(targetAlb, contextMenu.item.images[0]);
          }
        }}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-ink hover:bg-teal-soft hover:text-teal transition-all cursor-pointer"
      >
        <ImageIcon className="h-3.5 w-3.5 text-teal" />
        <span>이 사진을 앨범 대표이미지로 지정</span>
      </button>
    </div>
  );
};
