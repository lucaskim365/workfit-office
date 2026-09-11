import React from 'react';
import type { BreadcrumbItem } from '@/features/gw/gallery/useGalleryDirectory';
import type { GalleryFolder } from '@/domain/gallery/schema';
import { ArrowUp, ChevronRight, Folder, Home } from 'lucide-react';

interface GalleryBreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  currentFolder: GalleryFolder | null;
  onSelectFolder: (folderId: string | null) => void;
  onGoUp: () => void;
}

export function GalleryBreadcrumb({
  breadcrumbs,
  currentFolder,
  onSelectFolder,
  onGoUp,
}: GalleryBreadcrumbProps) {
  const isRoot = currentFolder === null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* 상위 폴더로 이동(⬆) 버튼 */}
        <button
          type="button"
          onClick={onGoUp}
          disabled={isRoot}
          title={isRoot ? '현재 최상위 폴더입니다' : '상위 폴더로 이동'}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors ${
            isRoot
              ? 'border-border/40 text-ink3/40 cursor-not-allowed'
              : 'border-border bg-panel-alt text-ink hover:bg-teal hover:text-white hover:border-teal'
          }`}
        >
          <ArrowUp size={14} />
        </button>

        {/* 브레드크럼 체인 */}
        <nav className="flex items-center gap-1 overflow-x-auto py-0.5 text-[12.5px] font-medium text-ink2 no-scrollbar">
          {breadcrumbs.map((bc, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={bc.id ?? 'root'}>
                {idx > 0 && <ChevronRight size={13} className="shrink-0 text-ink3/60" />}
                <button
                  type="button"
                  onClick={() => onSelectFolder(bc.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 transition-colors ${
                    isLast
                      ? 'bg-panel-alt font-bold text-ink cursor-default'
                      : 'hover:bg-panel-alt hover:text-teal'
                  }`}
                >
                  {idx === 0 ? (
                    <Home size={13} className={isLast ? 'text-teal' : 'text-ink3'} />
                  ) : (
                    <Folder size={13} className={isLast ? 'text-amber-500' : 'text-ink3'} />
                  )}
                  <span>{bc.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* 현재 폴더 설명 힌트 */}
      {currentFolder?.description && (
        <div className="hidden lg:block text-[11px] text-ink3 max-w-[280px] truncate" title={currentFolder.description}>
          {currentFolder.description}
        </div>
      )}
    </div>
  );
}
