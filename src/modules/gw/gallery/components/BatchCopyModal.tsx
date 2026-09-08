import React from 'react';
import { Copy, Folder, Info, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import type { GalleryAlbum } from '../types';

interface BatchCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  albums: GalleryAlbum[];
  albumCounts: Record<string, number>;
  currentAlbumId: string;
  targetAlbumId: string;
  setTargetAlbumId: (id: string) => void;
  onExecuteCopy: () => void;
}

export const BatchCopyModal: React.FC<BatchCopyModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  albums,
  albumCounts,
  currentAlbumId,
  targetAlbumId,
  setTargetAlbumId,
  onExecuteCopy,
}) => {
  if (!isOpen) return null;

  // 현재 앨범 및 시스템(최근항목)을 제외한 대상 앨범 목록
  const targetAlbums = albums.filter((a) => !a.isSystem && a.id !== currentAlbumId);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full rounded-3xl bg-panel border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
            <Copy className="h-4 w-4 text-teal" />
            <span>선택한 사진 다른 앨범에 복사</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-ink2">
            <span>
              선택한 사진 <strong className="text-teal font-mono font-bold">{selectedCount}장</strong>
            </span>
            <span className="text-[11px] text-ink3">복사본을 넣을 대상 앨범을 선택하세요</span>
          </div>

          {/* 대상 앨범 선택 라디오 목록 */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {targetAlbums.map((album) => {
              const isTarget = targetAlbumId === album.id;
              return (
                <div
                  key={album.id}
                  onClick={() => setTargetAlbumId(album.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isTarget
                      ? 'border-teal bg-teal-soft/40 shadow-xs'
                      : 'border-border bg-panel-alt/30 hover:bg-panel-alt'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <Folder className="h-4 w-4 text-teal shrink-0" />
                    <div className="truncate min-w-0">
                      <h5 className="text-xs font-bold text-ink truncate">{album.name}</h5>
                      {album.description && (
                        <p className="text-[10.5px] text-ink3 truncate">{album.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono rounded-full bg-panel px-2 py-0.5 text-ink3 border border-border/60">
                      {albumCounts[album.id] || 0}장
                    </span>
                    <input
                      type="radio"
                      name="targetCopyAlbumRadio"
                      checked={isTarget}
                      onChange={() => setTargetAlbumId(album.id)}
                      className="accent-teal h-4 w-4"
                    />
                  </div>
                </div>
              );
            })}

            {targetAlbums.length === 0 && (
              <div className="py-6 text-center text-xs text-ink3">
                복사할 수 있는 다른 대상 앨범이 없습니다. 먼저 새 앨범을 만들어주세요.
              </div>
            )}
          </div>

          {/* 원본 보존 안내 팁 */}
          <div className="rounded-2xl bg-panel-alt/60 p-3.5 border border-border text-[11.5px] text-ink3 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <Info className="h-3.5 w-3.5 text-teal shrink-0" />
              <span>현재 앨범의 원본 사진 안전 보존</span>
            </div>
            <p className="leading-relaxed">
              복사된 사진은 대상 앨범에 새롭게 추가되며, <strong>현재 앨범의 원본 사진은 그대로 유지</strong>됩니다.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!targetAlbumId || targetAlbums.length === 0}
              onClick={onExecuteCopy}
            >
              앨범에 복사 ({selectedCount}장)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
