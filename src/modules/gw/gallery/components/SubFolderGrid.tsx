import { useState } from 'react';
import type { GalleryFolder } from '@/domain/gallery/schema';
import { Folder, FolderPlus, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface SubFolderGridProps {
  subFolders: GalleryFolder[];
  photoCountMap: Record<string, number>;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: GalleryFolder) => void;
  onDeleteFolder: (folder: GalleryFolder) => void;
}

export function SubFolderGrid({
  subFolders,
  photoCountMap,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: SubFolderGridProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  if (subFolders.length === 0) {
    return null; // 하위 폴더가 없으면 영역 자체를 간결하게 생략
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-ink2 uppercase tracking-wide">하위 폴더</span>
          <span className="text-[11px] font-semibold text-ink3">({subFolders.length})</span>
        </div>
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal/80 transition-colors"
        >
          <FolderPlus size={13} />
          <span>새 폴더</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {subFolders.map((folder) => {
          const count = photoCountMap[folder.id] || 0;
          return (
            <div
              key={folder.id}
              onClick={() => onSelectFolder(folder.id)}
              className="group relative flex items-center justify-between gap-2.5 p-3 rounded-xl border border-border bg-panel hover:bg-panel-alt hover:border-teal/40 hover:shadow-xs transition-all cursor-pointer select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-105 transition-transform">
                  <Folder size={18} fill="currentColor" fillOpacity={0.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-ink group-hover:text-teal transition-colors">
                    {folder.name}
                  </div>
                  <div className="text-[10.5px] text-ink3 mt-0.5">
                    사진 {count}장
                  </div>
                </div>
              </div>

              {/* 옵션 메뉴 */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink3 hover:bg-panel hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical size={13} />
                </button>

                {activeMenuId === folder.id && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                      }}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 z-40 w-32 rounded-lg border border-border bg-panel py-1 shadow-lg text-[11.5px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMenuId(null);
                          onEditFolder(folder);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-panel-alt"
                      >
                        <Pencil size={12} className="text-blue-500" />
                        <span>이름 변경</span>
                      </button>
                      {!folder.isSystem && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDeleteFolder(folder);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-danger/10"
                        >
                          <Trash2 size={12} />
                          <span>폴더 삭제</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* 새 폴더 추가 카드 */}
        <div
          onClick={onCreateFolder}
          className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-border hover:border-teal hover:bg-teal/5 transition-all cursor-pointer text-ink3 hover:text-teal select-none"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-border/40">
            <FolderPlus size={16} />
          </div>
          <span className="text-[12px] font-semibold">새 하위 폴더</span>
        </div>
      </div>
    </div>
  );
}
