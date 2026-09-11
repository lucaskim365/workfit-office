import { useState } from 'react';
import type { FolderTreeNode } from '@/features/gw/gallery/useGalleryDirectory';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Images,
} from 'lucide-react';

interface GalleryFolderTreeProps {
  folderTree: FolderTreeNode[];
  currentFolderId: string | null;
  totalPhotosCount: number;
  onSelectFolder: (folderId: string | null) => void;
  onCreateSubFolder: (parentFolderId: string | null) => void;
  onEditFolder: (folder: FolderTreeNode) => void;
  onDeleteFolder: (folder: FolderTreeNode) => void;
}

export function GalleryFolderTree({
  folderTree,
  currentFolderId,
  totalPhotosCount,
  onSelectFolder,
  onCreateSubFolder,
  onEditFolder,
  onDeleteFolder,
}: GalleryFolderTreeProps) {
  // 열려 있는 폴더 ID 목록
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // 기본적으로 1레벨 폴더들은 펼쳐둠
    return new Set(folderTree.map((f) => f.id));
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col select-none">
      {/* 최상위 루트 (전체 사진) */}
      <div className="px-2 py-2 border-b border-border-low/60">
        <div
          onClick={() => onSelectFolder(null)}
          className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-[12.5px] font-semibold transition-colors ${
            currentFolderId === null
              ? 'bg-teal text-white shadow-xs'
              : 'text-ink hover:bg-panel-alt'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Images size={16} className={currentFolderId === null ? 'text-white' : 'text-teal'} />
            <span className="truncate">전체 사진 (전사 공용)</span>
          </div>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
              currentFolderId === null ? 'bg-white/20 text-white' : 'bg-panel text-ink3'
            }`}
          >
            {totalPhotosCount}
          </span>
        </div>
      </div>

      {/* 디렉토리 헤더 & 최상위 폴더 추가 */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1 text-[11px] font-bold text-ink3 uppercase tracking-wider">
        <span>디렉토리 구조</span>
        <button
          onClick={() => onCreateSubFolder(null)}
          className="flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal/80 transition-colors"
          title="최상위 폴더 추가"
        >
          <Plus size={13} />
          <span>폴더 추가</span>
        </button>
      </div>

      {/* 폴더 트리 목록 */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {folderTree.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            currentFolderId={currentFolderId}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onSelectFolder={onSelectFolder}
            onCreateSubFolder={onCreateSubFolder}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
        {folderTree.length === 0 && (
          <div className="py-8 text-center text-[12px] text-ink3">
            생성된 폴더가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  currentFolderId,
  expandedIds,
  onToggleExpand,
  onSelectFolder,
  onCreateSubFolder,
  onEditFolder,
  onDeleteFolder,
}: {
  node: FolderTreeNode;
  currentFolderId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onSelectFolder: (id: string) => void;
  onCreateSubFolder: (parentId: string) => void;
  onEditFolder: (folder: FolderTreeNode) => void;
  onDeleteFolder: (folder: FolderTreeNode) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isExpanded = expandedIds.has(node.id);
  const isSelected = currentFolderId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      <div
        onClick={() => onSelectFolder(node.id)}
        style={{ paddingLeft: `${node.depth * 14 + 6}px` }}
        className={`group flex items-center justify-between pr-1.5 py-1.5 rounded-lg cursor-pointer text-[12.5px] transition-colors ${
          isSelected
            ? 'bg-teal/15 font-bold text-teal dark:bg-teal/25'
            : 'text-ink hover:bg-panel-alt'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* 화살표 토글 버튼 */}
          <button
            type="button"
            onClick={(e) => hasChildren && onToggleExpand(node.id, e)}
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors ${
              hasChildren ? 'text-ink3 hover:bg-black/5 dark:hover:bg-white/10' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          {/* 폴더 아이콘 */}
          {isSelected || isExpanded ? (
            <FolderOpen size={16} className="shrink-0 text-amber-500" />
          ) : (
            <Folder size={16} className="shrink-0 text-amber-500" />
          )}

          {/* 폴더명 */}
          <span className="truncate">{node.name}</span>
        </div>

        {/* 우측 뱃지 및 액션 버튼들 */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <span
            className={`text-[10.5px] tabular-nums font-semibold px-1.5 py-0.2 rounded-md ${
              isSelected ? 'bg-teal/20 text-teal' : 'bg-panel-alt text-ink3'
            }`}
            title={`소속 사진: ${node.photoCount}장 (하위 포함: ${node.totalPhotoCount}장)`}
          >
            {node.totalPhotoCount}
          </span>

          {/* 호버 시 노출되는 간이 메뉴 */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubFolder(node.id);
              }}
              title="하위 폴더 만들기"
              className="grid h-5 w-5 place-items-center rounded-sm text-ink3 hover:bg-panel hover:text-teal"
            >
              <Plus size={12} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="grid h-5 w-5 place-items-center rounded-sm text-ink3 hover:bg-panel hover:text-ink"
              >
                <MoreVertical size={12} />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  />
                  <div
                    className="absolute right-0 top-full mt-1 z-40 w-32 rounded-lg border border-border bg-panel py-1 shadow-lg text-[11.5px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onCreateSubFolder(node.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-panel-alt"
                    >
                      <Plus size={13} className="text-teal" />
                      <span>하위 폴더</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEditFolder(node);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-panel-alt"
                    >
                      <Pencil size={13} className="text-blue-500" />
                      <span>이름 변경</span>
                    </button>
                    {!node.isSystem && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeleteFolder(node);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-danger/10"
                      >
                        <Trash2 size={13} />
                        <span>폴더 삭제</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하위 자식 노드들 렌더링 */}
      {isExpanded && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              currentFolderId={currentFolderId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onCreateSubFolder={onCreateSubFolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
