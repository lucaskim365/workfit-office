import React from 'react';
import { Calendar, Folder, LayoutGrid, Plus, X } from 'lucide-react';
import type { GalleryAlbum, YearGroup, TimelineMonthGroup } from '../types';

interface GallerySidebarProps {
  activeTab: 'albums' | 'timeline';
  albums: GalleryAlbum[];
  selectedAlbumId: string;
  onSelectAlbum: (id: string) => void;
  albumCounts: Record<string, number>;
  canCreate: boolean;
  onOpenAlbumModal: (album?: GalleryAlbum, e?: React.MouseEvent) => void;
  onDeleteAlbum: (albumId: string, albumName: string, e: React.MouseEvent) => void;
  selectedYearMonth: string;
  onSelectYearMonth: (ym: string) => void;
  timelineNav: YearGroup[];
  totalCount: number;
}

export const GallerySidebar: React.FC<GallerySidebarProps> = ({
  activeTab,
  albums,
  selectedAlbumId,
  onSelectAlbum,
  albumCounts,
  canCreate,
  onOpenAlbumModal,
  onDeleteAlbum,
  selectedYearMonth,
  onSelectYearMonth,
  timelineNav,
  totalCount,
}) => {
  return (
    <aside
      className="w-full md:w-[240px] shrink-0 rounded-2xl border border-border bg-panel p-3.5 shadow-xs"
      style={{ width: '240px', minWidth: '240px' }}
    >
      {activeTab === 'albums' ? (
        /* 1. 앨범 사이드바: 앨범을 클릭할 수 있는 사이드바 */
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Folder className="h-4 w-4 text-teal" />
              <span>앨범 목록</span>
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={() => onOpenAlbumModal()}
                className="flex items-center gap-1 text-[11px] font-bold text-teal hover:bg-teal-soft/60 px-2 py-0.5 rounded-md transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>새 앨범</span>
              </button>
            )}
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {/* 앨범 전체 모아보기 항목 */}
            <button
              type="button"
              onClick={() => onSelectAlbum('all_albums')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition-all mb-1 ${
                selectedAlbumId === 'all_albums'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink border border-dashed border-border/80'
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span className="truncate">앨범 전체 모아보기</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-mono ${
                  selectedAlbumId === 'all_albums'
                    ? 'bg-white/20 text-white'
                    : 'bg-panel-alt text-ink3 border border-border/50'
                }`}
              >
                {albums.length}개
              </span>
            </button>

            {albums.map((album) => {
              const count = albumCounts[album.id] || 0;
              const isSelected = selectedAlbumId === album.id;
              return (
                <div
                  key={album.id}
                  onClick={() => onSelectAlbum(album.id)}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal text-white shadow-xs'
                      : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {album.coverImage ? (
                      <img
                        src={album.coverImage}
                        alt={album.name}
                        className="h-6 w-6 rounded-md object-cover border border-white/20 shrink-0 shadow-xs"
                      />
                    ) : (
                      <Folder className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-ink3'}`} />
                    )}
                    <span className="truncate">{album.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.2 text-[10px] font-mono ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-panel-alt text-ink3 border border-border/50'
                      }`}
                    >
                      {count}
                    </span>
                    {!album.isSystem && (
                      <button
                        type="button"
                        onClick={(e) => onDeleteAlbum(album.id, album.name, e)}
                        title="앨범 삭제"
                        className={`opacity-0 group-hover:opacity-100 p-0.5 text-xs rounded transition-opacity ${
                          isSelected ? 'text-white/80 hover:text-white' : 'text-ink3 hover:text-danger'
                        }`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 2. 날짜별 사이드바: 년도-월을 선택할 수 있는 구조의 사이드바 */
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-teal" />
              <span>년도 · 월 선택</span>
            </span>
            <span className="text-[10px] font-mono text-ink3">총 {totalCount}장</span>
          </div>

          <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
            {/* 전체 기간 선택 */}
            <button
              type="button"
              onClick={() => onSelectYearMonth('all')}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-bold transition-all ${
                selectedYearMonth === 'all'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>전체 기간</span>
              </span>
              <span
                className={`rounded-full px-2 py-0.2 text-[10px] font-mono ${
                  selectedYearMonth === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-panel-alt text-ink3 border border-border/50'
                }`}
              >
                {totalCount}
              </span>
            </button>

            {/* 년도 - 월 아코디언/트리 목록 */}
            {timelineNav.map((group) => {
              const isYearSelected = selectedYearMonth === group.year;
              return (
                <div key={group.year} className="space-y-1">
                  {/* 년도 헤더 버튼 */}
                  <button
                    type="button"
                    onClick={() => onSelectYearMonth(group.year)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${
                      isYearSelected
                        ? 'bg-teal/15 text-teal border border-teal/30'
                        : 'text-ink hover:bg-panel-alt'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5 text-teal/80" />
                      <span>{group.year}년</span>
                    </span>
                    <span className="text-[10px] font-mono text-ink3">{group.count}장</span>
                  </button>

                  {/* 하위 월 목록 */}
                  <div className="ml-3 pl-2 border-l border-border/60 space-y-0.5">
                    {group.months.map((m: TimelineMonthGroup) => {
                      const isMonthSelected = selectedYearMonth === m.ym;
                      return (
                        <button
                          key={m.ym}
                          type="button"
                          onClick={() => onSelectYearMonth(m.ym)}
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors ${
                            isMonthSelected
                              ? 'bg-teal text-white font-bold shadow-xs'
                              : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                          }`}
                        >
                          <span>{m.monthStr}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              isMonthSelected ? 'text-white/80' : 'text-ink3'
                            }`}
                          >
                            {m.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {timelineNav.length === 0 && (
              <div className="py-6 text-center text-xs text-ink3">등록된 날짜 데이터가 없습니다</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
