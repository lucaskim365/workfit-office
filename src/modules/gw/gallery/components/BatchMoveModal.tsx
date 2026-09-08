import React from 'react';
import { Folder, FolderInput, Info, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button';
import type { GalleryAlbum } from '../types';

interface BatchMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  albums: GalleryAlbum[];
  albumCounts: Record<string, number>;
  targetAlbumId: string;
  setTargetAlbumId: (id: string) => void;
  onExecuteMove: () => void;
}

export const BatchMoveModal: React.FC<BatchMoveModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  albums,
  albumCounts,
  targetAlbumId,
  setTargetAlbumId,
  onExecuteMove,
}) => {
  if (!isOpen) return null;

  const targetAlbums = albums.filter((a) => !a.isSystem);

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
            <FolderInput className="h-4 w-4 text-teal" />
            <span>선택한 사진 앨범에 넣기</span>
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
            <span className="text-[11px] text-ink3">보관할 대상 앨범을 선택하세요</span>
          </div>

          {/* 앨범 선택 라디오 목록 */}
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
                      name="targetAlbumRadio"
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
                생성된 앨범이 없습니다. 먼저 새 앨범을 만들어주세요.
              </div>
            )}
          </div>

          {/* 최근항목 상시 보존 안내 팁 */}
          <div className="rounded-2xl bg-panel-alt/60 p-3.5 border border-border text-[11.5px] text-ink3 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <Info className="h-3.5 w-3.5 text-teal shrink-0" />
              <span>'전체 (최근 항목)' 상시 보존</span>
            </div>
            <p className="leading-relaxed">
              특정 앨범으로 사진을 분류하더라도, <strong>전체 (최근 항목)</strong>에는 언제나 모든 사진이 기본으로 보존되어 한눈에 확인하실 수 있습니다.
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
              disabled={!targetAlbumId}
              onClick={onExecuteMove}
            >
              앨범에 넣기 ({selectedCount}장)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
