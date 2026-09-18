import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { useGalleryDirectory } from '@/features/gw/gallery/useGalleryDirectory';
import type { GalleryPhoto } from '@/domain/gallery/schema';
import MobileCommonHeader from './MobileCommonHeader';

export default function MobileGalleryScreen() {
  const {
    folders,
    photos,
    isPhotosLoading,
    currentFolderId,
    setCurrentFolderId,
    currentFolder,
    currentPhotos,
  } = useGalleryDirectory();

  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);

  return (
    <div className="flex h-full flex-col select-none overflow-hidden" style={{ background: '#f2f8fc' }}>
      <MobileCommonHeader
        title="회사 갤러리"
        subtitle={currentFolder ? currentFolder.name : `전체 사진 ${photos.length}장`}
      />

      {/* 1. 폴더 선택 칩 바 */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 overflow-x-auto bg-white/70 border-b border-border/50 shrink-0 no-scrollbar">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
            currentFolderId === null
              ? 'bg-teal text-white shadow-xs'
              : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
          }`}
        >
          <Folder size={13} />
          <span>전체 ({photos.length})</span>
        </button>

        {folders.map((f) => {
          const count = photos.filter((p) => p.folderId === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setCurrentFolderId(f.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all ${
                currentFolderId === f.id
                  ? 'bg-teal text-white shadow-xs'
                  : 'bg-white text-ink3 hover:bg-panel-alt border border-border/80'
              }`}
            >
              {currentFolderId === f.id ? <FolderOpen size={13} /> : <Folder size={13} />}
              <span>{f.name} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. 사진 2열 그리드 */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {isPhotosLoading ? (
          <div className="py-16 text-center text-[12px] text-ink3">사진을 불러오는 중입니다…</div>
        ) : currentPhotos.length === 0 ? (
          <div className="py-16 text-center text-ink3 border border-dashed border-border/80 rounded-2xl bg-white/60">
            <ImageIcon size={28} className="mx-auto mb-1.5 text-ink3/40" />
            <p className="text-[12px] font-bold text-ink">등록된 사진이 없습니다.</p>
            <p className="text-[10.5px] text-ink3 mt-0.5">사내 행사 및 워크숍 사진을 웹 갤러리에서 등록해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {currentPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-white shadow-2xs hover:border-teal/50 transition-all cursor-pointer active:scale-97"
              >
                <div className="relative aspect-square w-full bg-panel-alt overflow-hidden">
                  <img
                    src={photo.thumbnailUrl || photo.fileUrl}
                    alt={photo.title || photo.fileName}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>

                <div className="p-2 space-y-0.5">
                  <h4 className="text-[11.5px] font-bold text-ink truncate">
                    {photo.title || photo.fileName}
                  </h4>
                  <span className="text-[10px] text-ink3 block font-mono">
                    {photo.createdAt.slice(0, 10)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. 풀스크린 사진 라이트박스 뷰어 */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 animate-in fade-in duration-200">
          <header className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-[13px] font-bold truncate max-w-[240px]">
              {activePhoto.title || activePhoto.fileName}
            </span>
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={photoFileUrl(activePhoto)}
              alt={activePhoto.title || activePhoto.fileName}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          <footer className="px-4 py-3 bg-black/60 text-white/80 text-[11px] flex items-center justify-between">
            <span>촬영/등록: {activePhoto.createdAt.slice(0, 10)}</span>
            <span className="font-mono">{activePhoto.authorName || '사내 갤러리'}</span>
          </footer>
        </div>
      )}
    </div>
  );
}

function photoFileUrl(photo: GalleryPhoto): string {
  return photo.fileUrl || photo.thumbnailUrl || '';
}
