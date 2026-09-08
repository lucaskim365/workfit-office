import React from 'react';
import { Calendar, ChevronRight, Folder, Pencil, Plus, X } from 'lucide-react';
import type { GalleryAlbum } from '../types';

interface AlbumCardGridProps {
  albums: GalleryAlbum[];
  albumCounts: Record<string, number>;
  albumCoverMap: Record<string, string>;
  albumLatestDateMap: Record<string, string>;
  canCreate: boolean;
  onSelectAlbum: (id: string) => void;
  onOpenAlbumModal: (album?: GalleryAlbum, e?: React.MouseEvent) => void;
  onDeleteAlbum: (albumId: string, albumName: string, e: React.MouseEvent) => void;
}

export const AlbumCardGrid: React.FC<AlbumCardGridProps> = ({
  albums,
  albumCounts,
  albumCoverMap,
  albumLatestDateMap,
  canCreate,
  onSelectAlbum,
  onOpenAlbumModal,
  onDeleteAlbum,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {albums.map((album) => {
        const count = albumCounts[album.id] || 0;
        const cover = albumCoverMap[album.id];
        const displayDate = albumLatestDateMap[album.id] || album.createdAt || '날짜 없음';

        return (
          <div
            key={album.id}
            onClick={() => onSelectAlbum(album.id)}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-panel hover:border-teal/50 hover:shadow-xl transition-all duration-200 cursor-pointer text-left select-none"
          >
            {/* 정방형 앨범 커버 썸네일 */}
            <div className="relative aspect-square w-full bg-panel-alt overflow-hidden">
              {cover ? (
                <img
                  src={cover}
                  alt={album.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-ink3/40 bg-gradient-to-br from-panel-alt/60 to-panel">
                  <Folder className="h-14 w-14 stroke-[1.2] text-ink3/30 group-hover:text-teal/50 transition-colors" />
                </div>
              )}

              {/* 사진 매수 배지 */}
              <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-xs shadow-xs">
                {count}장
              </div>

              {/* 대표 커버 뱃지 */}
              {album.coverImage && (
                <div className="absolute bottom-3 left-3 rounded-md bg-teal/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                  대표 커버 설정됨
                </div>
              )}

              {/* 앨범 관리 빠른 버튼 (수정, 삭제) */}
              {!album.isSystem && (
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => onOpenAlbumModal(album, e)}
                    title="앨범명 수정"
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs text-white hover:bg-teal transition-colors shadow-xs"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onDeleteAlbum(album.id, album.name, e)}
                    title="앨범 삭제"
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-xs text-white hover:bg-danger transition-colors shadow-xs"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 앨범 메타 정보 */}
            <div className="p-4 flex flex-col justify-between flex-1">
              <div>
                <h4 className="text-sm font-extrabold text-ink group-hover:text-teal transition-colors truncate">
                  {album.name}
                </h4>
                <p className="text-[11.5px] text-ink3 line-clamp-1 mt-1">
                  {album.description || (album.id === 'recent' ? '전체 사진 상시 보존' : '등록된 설명 없음')}
                </p>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 text-[11px] text-ink3">
                <span className="font-mono text-[10px] flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-ink3/70 inline" />
                  {displayDate}
                </span>
                <span className="font-bold text-teal flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  <span>사진 보기</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 새 앨범 만들기 카드 */}
      {canCreate && (
        <div
          onClick={() => onOpenAlbumModal()}
          className="flex aspect-square flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border hover:border-teal bg-panel-alt/20 hover:bg-teal-soft/20 text-ink3 hover:text-teal transition-all cursor-pointer p-6 text-center group"
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-panel border border-border group-hover:border-teal text-teal shadow-xs transition-colors">
            <Plus className="h-6 w-6 stroke-[2.2]" />
          </div>
          <span className="mt-3.5 text-sm font-bold text-ink group-hover:text-teal transition-colors">
            새 앨범 만들기
          </span>
          <span className="mt-1 text-[11.5px] text-ink3 max-w-[160px]">
            기념일, 프로젝트별 사진을 테마로 분류해보세요
          </span>
        </div>
      )}
    </div>
  );
};
