import { useState } from 'react';
import type { FolderTreeNode } from '@/features/gw/gallery/useGalleryDirectory';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
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
      <div className="pb-2 border-b border-border/60">
        <div
          onClick={() => onSelectFolder(null)}
          className={`flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer text-[12px] font-semibold transition-all ${
            currentFolderId === null
              ? 'bg-teal/12 text-teal font-bold border border-teal/25 shadow-xs'
              : 'text-ink hover:bg-panel-alt'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Images size={15} className={currentFolderId === null ? 'text-teal' : 'text-ink3'} />
            <span className="truncate">전체 사진 보기</span>
          </div>
          <span
            className={`text-[10.5px] px-2 py-0.5 rounded-full font-semibold tabular-nums ${
              currentFolderId === null
                ? 'bg-teal text-white'
                : 'bg-panel-alt text-ink3 border border-border/50'
            }`}
          >
            {totalPhotosCount}
          </span>
        </div>
      </div>

      {/* 카테고리 헤더 & 신규 카테고리 추가 */}
      <div className="flex items-center justify-between px-1.5 pt-3 pb-1.5 text-[11px] font-bold text-ink3 uppercase tracking-wider">
        <span>카테고리</span>
        <button
          type="button"
          onClick={() => onCreateSubFolder(null)}
          className="flex items-center gap-1 text-[11px] font-semibold text-teal hover:text-teal/80 transition-colors"
          title="새 카테고리 추가"
        >
          <Plus size={13} />
          <span>카테고리 추가</span>
        </button>
      </div>

      {/* 카테고리 트리 목록 */}
      <div className="flex-1 overflow-y-auto py-0.5 space-y-0.5">
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
          <div className="py-8 text-center text-[11.5px] text-ink3 border border-dashed border-border/60 rounded-xl bg-panel-alt/20 my-1">
            <p>등록된 카테고리가 없습니다.</p>
            <button
              type="button"
              onClick={() => onCreateSubFolder(null)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal hover:underline"
            >
              <Plus size={12} />
              <span>첫 카테고리 추가</span>
            </button>
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
  const isExpanded = expandedIds.has(node.id);
  const isSelected = currentFolderId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      <div
        onClick={() => onSelectFolder(node.id)}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer text-[12px] transition-all ${
          isSelected
            ? 'bg-teal/12 font-bold text-teal border border-teal/25 shadow-xs'
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
          <span className="truncate" title={node.name}>{node.name}</span>
        </div>

        {/* 우측 뱃지 및 직접 노출되는 호버 액션 버튼 (+, ✎, 🗑) */}
        <div className="flex items-center shrink-0 ml-1">
          {/* 마우스 호버 시 직접 노출되는 직관적인 버튼들 */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubFolder(node.id);
              }}
              title="하위 카테고리 추가"
              className="grid h-6 w-6 place-items-center rounded-md text-ink3 hover:bg-teal/15 hover:text-teal transition-colors"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(node);
              }}
              title="카테고리 수정 (이름/설명 변경)"
              className="grid h-6 w-6 place-items-center rounded-md text-ink3 hover:bg-blue-500/15 hover:text-blue-500 transition-colors"
            >
              <Pencil size={12} />
            </button>
            {!node.isSystem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(node);
                }}
                title="카테고리 삭제"
                className="grid h-6 w-6 place-items-center rounded-md text-ink3 hover:bg-danger/15 hover:text-danger transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* 소속 사진 수 배지 */}
          <span
            className={`text-[10.5px] tabular-nums font-semibold px-2 py-0.5 rounded-full ml-1.5 ${
              isSelected ? 'bg-teal text-white' : 'bg-panel-alt text-ink3 border border-border/40'
            }`}
            title={`소속 사진: ${node.photoCount}장 (하위 포함: ${node.totalPhotoCount}장)`}
          >
            {node.totalPhotoCount}
          </span>
        </div>
      </div>

      {/* 하위 자식 노드들 렌더링 (블로그 스타일 트리 가이드 라인) */}
      {isExpanded && hasChildren && (
        <div className="relative ml-4 pl-1.5 border-l border-border/70 space-y-0.5 mt-0.5">
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
