import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { usePermission } from '@/features/auth/usePermission';
import { Button } from '@/shared/ui/Button';
import {
  Camera,
  FolderArchive,
  Calendar,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Plus,
  Folder,
  LayoutGrid,
  ChevronLeft,
  Info,
  FolderPlus,
  Pencil,
} from 'lucide-react';

import type { GalleryAlbum, GalleryItem, UploadImageItem } from './types';
import { useGallery } from './hooks/useGallery';
import { useGallerySelection } from './hooks/useGallerySelection';
import { GallerySidebar } from './components/GallerySidebar';
import { AlbumCardGrid } from './components/AlbumCardGrid';
import { PhotoGrid } from './components/PhotoGrid';
import { LightboxViewer } from './components/LightboxViewer';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { AlbumManageModal } from './components/AlbumManageModal';
import { BatchMoveModal } from './components/BatchMoveModal';
import { BatchCopyModal } from './components/BatchCopyModal';
import { ContextMenu } from './components/ContextMenu';
import { SelectionFloatingBar } from './components/SelectionFloatingBar';

export type { GalleryAlbum, GalleryItem, UploadImageItem } from './types';

export default function GalleryScreen() {
  const { user } = useAuth();
  const { isSuperAdmin, canAction } = usePermission();
  const canCreate = canAction('S_GW_GALLERY', 'create');
  const canUpdate = canAction('S_GW_GALLERY', 'update');
  const canDelete = canAction('S_GW_GALLERY', 'delete');

  // ── 갤러리 메인 데이터 & 필터링 훅 ──
  const {
    albums,
    items,
    activeTab,
    setActiveTab,
    selectedAlbumId,
    setSelectedAlbumId,
    selectedYearMonth,
    setSelectedYearMonth,
    sortOrder,
    setSortOrder,
    keyword,
    setKeyword,
    currentAlbum,
    albumCounts,
    albumCoverMap,
    albumLatestDateMap,
    timelineNav,
    filteredItems,
    groupedByDate,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    setCoverImage,
    addPhotos,
    updatePhoto,
    deletePhoto,
    batchMovePhotos,
    batchCopyPhotos,
    batchDeletePhotos,
  } = useGallery();

  // ── 다중 선택 훅 ──
  const {
    isSelectionMode,
    setIsSelectionMode,
    selectedItemIds,
    setSelectedItemIds,
    toggleSelectItem,
    handleSelectAll,
    handleCancelSelection,
  } = useGallerySelection(filteredItems);

  // ── 라이트박스 상태 ──
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // ── 업로드 / 수정 모달 상태 ──
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [uploadImages, setUploadImages] = useState<UploadImageItem[]>([]);
  const [editCaption, setEditCaption] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formAlbumId, setFormAlbumId] = useState('recent');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── 앨범 생성 / 수정 모달 상태 ──
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumFormName, setAlbumFormName] = useState('');
  const [albumFormDesc, setAlbumFormDesc] = useState('');

  // ── 일괄 이동 모달 상태 ──
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveAlbumId, setTargetMoveAlbumId] = useState('');

  // ── 일괄 복사 모달 상태 ──
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [targetCopyAlbumId, setTargetCopyAlbumId] = useState('');

  // ── 우클릭 컨텍스트 메뉴 상태 ──
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: GalleryItem } | null>(null);

  // 권한 체크
  const canManageItem = (item: GalleryItem) => {
    if (isSuperAdmin) return true;
    if (user?.id && item.authorId === user.id) return true;
    return canUpdate || canDelete;
  };

  // 컨텍스트 메뉴 전역 닫기
  React.useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // ESC 키로 사진 선택 해제 (라이트박스 미열람 시)
  React.useEffect(() => {
    if (!isSelectionMode || activeItemId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, activeItemId, handleCancelSelection]);

  // ── 업로드 / 수정 핸들러 ──
  const handleOpenUploadModal = () => {
    setEditingItemId(null);
    setUploadImages([]);
    setEditCaption('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAlbumId(selectedAlbumId !== 'all_albums' ? selectedAlbumId : 'recent');
    setIsUploadModalOpen(true);
  };

  const handleOpenEditModal = (item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingItemId(item.id);
    setFormAlbumId(item.albumId);
    setFormDate(item.date);
    setEditCaption(item.caption || item.description || '');
    setUploadImages([{ id: item.id, url: item.images[0] || '', caption: item.description || '' }]);
    setIsUploadModalOpen(true);
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (uploadImages.length + files.length > 50) {
      alert('한 번에 최대 50장의 사진까지 등록할 수 있습니다.');
      return;
    }

    const readers: Promise<string>[] = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        alert(`20MB를 초과하는 파일(${file.name})은 제외됩니다.`);
        continue;
      }
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        }),
      );
    }

    Promise.all(readers).then((newUrls) => {
      const newItems: UploadImageItem[] = newUrls.map((url, i) => ({
        id: `up-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        url,
        caption: '',
      }));
      setUploadImages((prev) => [...prev, ...newItems]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const handleUpdateImageCaption = (id: string, caption: string) => {
    setUploadImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption } : img)),
    );
  };

  const handleRemoveUploadImage = (id: string) => {
    setUploadImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadImages.length === 0) {
      alert('사진을 1장 이상 등록해주세요.');
      return;
    }

    if (editingItemId) {
      updatePhoto(editingItemId, {
        caption: editCaption.trim(),
        date: formDate,
        albumId: formAlbumId,
      });
    } else {
      addPhotos({
        uploadImages,
        albumId: formAlbumId,
        date: formDate,
      });
    }

    setIsUploadModalOpen(false);
    setEditingItemId(null);
  };

  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('이 사진을 갤러리에서 삭제하시겠습니까?')) return;
    deletePhoto(id);
    if (activeItemId === id) setActiveItemId(null);
  };

  // ── 앨범 생성 / 수정 / 삭제 핸들러 ──
  const handleOpenAlbumModal = (album?: GalleryAlbum, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (album) {
      setEditingAlbumId(album.id);
      setAlbumFormName(album.name);
      setAlbumFormDesc(album.description || '');
    } else {
      setEditingAlbumId(null);
      setAlbumFormName('');
      setAlbumFormDesc('');
    }
    setIsAlbumModalOpen(true);
  };

  const handleSubmitAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    const name = albumFormName.trim();
    if (!name) {
      alert('앨범 이름을 입력해주세요.');
      return;
    }

    if (editingAlbumId) {
      updateAlbum(editingAlbumId, name, albumFormDesc.trim());
    } else {
      const newAlbum = createAlbum(name, albumFormDesc.trim());
      setSelectedAlbumId(newAlbum.id);
    }
    setIsAlbumModalOpen(false);
  };

  const handleDeleteAlbum = (albumId: string, albumName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${albumName}' 앨범을 삭제하시겠습니까?\n앨범 내 사진들은 삭제되지 않고 '전체 (최근 항목)'에 유지됩니다.`)) {
      return;
    }
    deleteAlbum(albumId);
    if (selectedAlbumId === albumId) setSelectedAlbumId('recent');
  };

  // ── 앨범 대표 이미지 핸들러 ──
  const handlePhotoContextMenu = (e: React.MouseEvent, item: GalleryItem) => {
    const targetAlbumId = selectedAlbumId !== 'recent' ? selectedAlbumId : item.albumId;
    if (!targetAlbumId || targetAlbumId === 'recent') return;
    e.preventDefault();
    e.stopPropagation();

    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    setContextMenu({ x, y, item });
  };

  const handleSetCover = (albumId: string, imageUrl: string) => {
    if (!albumId || albumId === 'recent') {
      alert('최근 항목(전체)에는 대표 이미지를 지정할 수 없습니다. 특정 앨범을 선택해주세요.');
      return;
    }
    setCoverImage(albumId, imageUrl);
    const targetAlbum = albums.find((a) => a.id === albumId);
    alert(`'${targetAlbum?.name || '앨범'}'의 대표 이미지로 지정되었습니다.`);
    setContextMenu(null);
  };

  // ── 일괄 이동 모달 핸들러 ──
  const handleOpenMoveModal = () => {
    if (selectedItemIds.size === 0) return;
    const nonRecentAlbums = albums.filter((a) => !a.isSystem);
    setTargetMoveAlbumId(nonRecentAlbums[0]?.id || 'alb_event');
    setIsMoveModalOpen(true);
  };

  const handleExecuteMove = () => {
    if (!targetMoveAlbumId) {
      alert('이동할 대상 앨범을 선택해주세요.');
      return;
    }
    const targetAlbum = albums.find((a) => a.id === targetMoveAlbumId);
    const targetName = targetAlbum ? targetAlbum.name : '선택된 앨범';

    batchMovePhotos(selectedItemIds, targetMoveAlbumId);

    alert(
      `${selectedItemIds.size}장의 사진을 '${targetName}' 앨범에 보관했습니다.\n(※ '전체 (최근 항목)'에는 모든 사진이 계속 보관되어 표시됩니다.)`,
    );
    setIsMoveModalOpen(false);
    setSelectedItemIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedItemIds.size === 0) return;
    if (!confirm(`선택한 ${selectedItemIds.size}장의 사진을 갤러리에서 삭제하시겠습니까?`)) {
      return;
    }
    batchDeletePhotos(selectedItemIds);
    setSelectedItemIds(new Set());
  };

  // ── 앨범 복사 핸들러 (최근항목이 아닌 앨범에서 다른 앨범으로 복사) ──
  const isNonRecentAlbumView = activeTab === 'albums' && selectedAlbumId !== 'recent' && selectedAlbumId !== 'all_albums';

  const handleOpenCopyModal = () => {
    if (selectedItemIds.size === 0) return;
    const candidateAlbums = albums.filter((a) => !a.isSystem && a.id !== selectedAlbumId);
    setTargetCopyAlbumId(candidateAlbums[0]?.id || '');
    setIsCopyModalOpen(true);
  };

  const handleExecuteCopy = () => {
    if (!targetCopyAlbumId) {
      alert('복사할 대상 앨범을 선택해주세요.');
      return;
    }
    const targetAlbum = albums.find((a) => a.id === targetCopyAlbumId);
    const targetName = targetAlbum ? targetAlbum.name : '선택된 앨범';

    batchCopyPhotos(selectedItemIds, targetCopyAlbumId);

    alert(
      `${selectedItemIds.size}장의 사진을 '${targetName}' 앨범에 복사했습니다.\n(※ 기존 앨범의 사진도 그대로 보존됩니다.)`,
    );
    setIsCopyModalOpen(false);
    setSelectedItemIds(new Set());
    setIsSelectionMode(false);
  };

  const handleCopySinglePhoto = (item: GalleryItem) => {
    setSelectedItemIds(new Set([item.id]));
    const candidateAlbums = albums.filter((a) => !a.isSystem && a.id !== item.albumId);
    setTargetCopyAlbumId(candidateAlbums[0]?.id || '');
    setIsCopyModalOpen(true);
  };

  // ── 라이트박스 네비게이션 ──
  const activeItem = useMemo(
    () => (activeItemId ? items.find((it) => it.id === activeItemId) ?? null : null),
    [activeItemId, items],
  );

  const currentActiveIndex = useMemo(() => {
    if (!activeItemId) return -1;
    return filteredItems.findIndex((it) => it.id === activeItemId);
  }, [activeItemId, filteredItems]);

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeItem) return;
    if (activeItem.images.length > 1 && activeImageIndex > 0) {
      setActiveImageIndex((prev: number) => prev - 1);
      return;
    }
    if (filteredItems.length > 1 && currentActiveIndex !== -1) {
      const prevIdx = currentActiveIndex > 0 ? currentActiveIndex - 1 : filteredItems.length - 1;
      setActiveItemId(filteredItems[prevIdx].id);
      setActiveImageIndex(0);
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeItem) return;
    if (activeItem.images.length > 1 && activeImageIndex < activeItem.images.length - 1) {
      setActiveImageIndex((prev: number) => prev + 1);
      return;
    }
    if (filteredItems.length > 1 && currentActiveIndex !== -1) {
      const nextIdx = currentActiveIndex < filteredItems.length - 1 ? currentActiveIndex + 1 : 0;
      setActiveItemId(filteredItems[nextIdx].id);
      setActiveImageIndex(0);
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {/* ── 상단 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-xs font-medium text-ink3 mb-1">
            그룹웨어 <span className="px-1">/</span> 회사 갤러리
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-soft text-teal shadow-xs">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink flex items-center gap-2">
                <span>회사 갤러리</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-panel-alt text-ink2 border border-border">
                  {items.length}장의 사진
                </span>
              </h1>
              <p className="text-[11.5px] text-ink3 mt-0.5">
                앨범별 폴더 및 년도/날짜별 타임라인 사이드바로 사진을 쉽고 편리하게 정리하세요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 탭 스위처 & 검색 & 정렬 바 ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-panel-alt/40 p-1.5 rounded-2xl border border-border">
        {/* 좌측: 탭 전환 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('albums')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all ${
              activeTab === 'albums'
                ? 'bg-panel text-teal shadow-xs border border-border/50'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <FolderArchive className="h-4 w-4" />
            <span>앨범 보관함 ({albums.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-panel text-teal shadow-xs border border-border/50'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>날짜별 (타임라인)</span>
          </button>
        </div>

        {/* 우측: 검색창 & 정렬 버튼 */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="사진 제목, 일자, 작성자 검색..."
              className="h-8.5 w-56 rounded-xl border border-border bg-panel pl-3 pr-8 text-[12px] text-ink outline-none focus:border-teal transition-all placeholder:text-ink3 shadow-2xs"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink3 hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSortOrder((prev: 'desc' | 'asc') => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink2 hover:text-teal transition-colors shadow-2xs"
          >
            {sortOrder === 'desc' ? (
              <>
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                <span>최신 날짜순</span>
              </>
            ) : (
              <>
                <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                <span>과거 날짜순</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 메인 2단 레이아웃 ── */}
      <div className="mt-5 flex flex-col md:flex-row gap-5 items-start">
        {/* A. 좌측 사이드바 */}
        <GallerySidebar
          activeTab={activeTab}
          albums={albums}
          selectedAlbumId={selectedAlbumId}
          onSelectAlbum={setSelectedAlbumId}
          albumCounts={albumCounts}
          canCreate={canCreate}
          onOpenAlbumModal={handleOpenAlbumModal}
          onDeleteAlbum={handleDeleteAlbum}
          selectedYearMonth={selectedYearMonth}
          onSelectYearMonth={setSelectedYearMonth}
          timelineNav={timelineNav}
          totalCount={items.length}
        />

        {/* B. 우측 메인 영역 */}
        <main className="flex-1 min-w-0 w-full">
          {/* 상단 뷰어 안내 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 rounded-2xl border border-border bg-panel p-4 shadow-xs">
            <div className="flex items-center gap-3">
              {activeTab === 'albums' && selectedAlbumId !== 'all_albums' && (
                <button
                  type="button"
                  onClick={() => setSelectedAlbumId('all_albums')}
                  title="전체 앨범 보관함으로 돌아가기"
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-panel-alt/70 px-2.5 py-1.5 text-xs font-bold text-ink2 hover:bg-panel hover:text-teal hover:border-teal/50 transition-all shadow-2xs mr-0.5 shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>모든 앨범</span>
                </button>
              )}

              {activeTab === 'albums' && selectedAlbumId !== 'all_albums' && currentAlbum?.coverImage ? (
                <img
                  src={currentAlbum.coverImage}
                  alt={currentAlbum.name}
                  className="h-11 w-11 rounded-xl object-cover border border-border shadow-xs shrink-0"
                />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-soft text-teal shrink-0">
                  {activeTab === 'albums' ? (
                    selectedAlbumId === 'all_albums' ? (
                      <LayoutGrid className="h-5 w-5" />
                    ) : (
                      <Folder className="h-5 w-5" />
                    )
                  ) : (
                    <Calendar className="h-5 w-5" />
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-ink">
                    {activeTab === 'albums'
                      ? currentAlbum?.name
                      : selectedYearMonth === 'all'
                      ? '전체 타임라인 사진'
                      : `${selectedYearMonth.replace('-', '년 ')}월 사진`}
                  </h2>
                  <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-bold text-teal font-mono">
                    {activeTab === 'albums' && selectedAlbumId === 'all_albums'
                      ? `총 ${albums.length}개 앨범`
                      : `${filteredItems.length}장의 사진`}
                  </span>
                </div>
                {activeTab === 'albums' ? (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {currentAlbum?.description && (
                      <p className="text-[11.5px] text-ink3">{currentAlbum.description}</p>
                    )}
                    {selectedAlbumId !== 'recent' && selectedAlbumId !== 'all_albums' && (
                      <span className="text-[10.5px] text-teal font-medium flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        <span>팁: 사진을 우클릭하여 이 앨범의 대표 이미지로 지정할 수 있습니다.</span>
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canCreate && (
                <Button size="sm" variant="primary" onClick={handleOpenUploadModal}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>{selectedAlbumId === 'all_albums' ? '사진 올리기' : '이 위치에 사진 올리기'}</span>
                </Button>
              )}
              {activeTab === 'albums' && selectedAlbumId === 'all_albums' && canCreate && (
                <Button size="sm" variant="secondary" onClick={() => handleOpenAlbumModal()}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  <span>새 앨범 만들기</span>
                </Button>
              )}
              {activeTab === 'albums' && selectedAlbumId !== 'all_albums' && !currentAlbum?.isSystem && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => handleOpenAlbumModal(currentAlbum, e)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  <span>앨범명 수정</span>
                </Button>
              )}
            </div>
          </div>

          {/* 콘텐츠 영역: 모아보기 / 그리드 */}
          {activeTab === 'albums' && selectedAlbumId === 'all_albums' ? (
            <AlbumCardGrid
              albums={albums}
              albumCounts={albumCounts}
              albumCoverMap={albumCoverMap}
              albumLatestDateMap={albumLatestDateMap}
              canCreate={canCreate}
              onSelectAlbum={setSelectedAlbumId}
              onOpenAlbumModal={handleOpenAlbumModal}
              onDeleteAlbum={handleDeleteAlbum}
            />
          ) : (
            <PhotoGrid
              activeTab={activeTab}
              filteredItems={filteredItems}
              groupedByDate={groupedByDate}
              albums={albums}
              isSelectionMode={isSelectionMode}
              selectedItemIds={selectedItemIds}
              onToggleSelect={toggleSelectItem}
              onContextMenu={handlePhotoContextMenu}
              onOpenEdit={handleOpenEditModal}
              onDelete={handleDeleteItem}
              onClickItem={(item) => {
                if (isSelectionMode) {
                  toggleSelectItem(item.id);
                } else {
                  setActiveItemId(item.id);
                  setActiveImageIndex(0);
                }
              }}
              canManageItem={canManageItem}
              keyword={keyword}
              onUpload={handleOpenUploadModal}
              canCreate={canCreate}
            />
          )}
        </main>
      </div>

      {/* ── 서브 모달 컴포넌트 ── */}
      <LightboxViewer
        activeItem={activeItem}
        activeImageIndex={activeImageIndex}
        setActiveImageIndex={setActiveImageIndex}
        onClose={() => setActiveItemId(null)}
        onPrev={handlePrevPhoto}
        onNext={handleNextPhoto}
        albums={albums}
        currentActiveIndex={currentActiveIndex}
        totalItemsCount={filteredItems.length}
        canManage={activeItem ? canManageItem(activeItem) : false}
        onSetCoverImage={handleSetCover}
        onOpenEdit={handleOpenEditModal}
        onDelete={handleDeleteItem}
        onCopyPhoto={handleCopySinglePhoto}
      />

      <PhotoUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        albums={albums}
        formAlbumId={formAlbumId}
        setFormAlbumId={setFormAlbumId}
        formDate={formDate}
        setFormDate={setFormDate}
        uploadImages={uploadImages}
        setUploadImages={setUploadImages}
        editingItemId={editingItemId}
        editCaption={editCaption}
        setEditCaption={setEditCaption}
        onSubmit={handleSubmitForm}
        fileInputRef={fileInputRef}
        handleFilesChange={handleFilesChange}
        handleUpdateImageCaption={handleUpdateImageCaption}
        handleRemoveUploadImage={handleRemoveUploadImage}
      />

      <AlbumManageModal
        isOpen={isAlbumModalOpen}
        onClose={() => setIsAlbumModalOpen(false)}
        editingAlbumId={editingAlbumId}
        albumName={albumFormName}
        setAlbumName={setAlbumFormName}
        albumDesc={albumFormDesc}
        setAlbumDesc={setAlbumFormDesc}
        onSubmit={handleSubmitAlbum}
      />

      <BatchMoveModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        selectedCount={selectedItemIds.size}
        albums={albums}
        albumCounts={albumCounts}
        targetAlbumId={targetMoveAlbumId}
        setTargetAlbumId={setTargetMoveAlbumId}
        onExecuteMove={handleExecuteMove}
      />

      <BatchCopyModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        selectedCount={selectedItemIds.size}
        albums={albums}
        albumCounts={albumCounts}
        currentAlbumId={selectedAlbumId}
        targetAlbumId={targetCopyAlbumId}
        setTargetAlbumId={setTargetCopyAlbumId}
        onExecuteCopy={handleExecuteCopy}
      />

      <ContextMenu
        contextMenu={contextMenu}
        selectedAlbumId={selectedAlbumId}
        onSetCoverImage={handleSetCover}
      />

      {/* ── 하단 플로팅 선택 액션바 (Google Photos 스타일) ── */}
      <SelectionFloatingBar
        selectedCount={selectedItemIds.size}
        totalCount={filteredItems.length}
        canCopy={isNonRecentAlbumView}
        canDelete={canDelete}
        onSelectAll={handleSelectAll}
        onCancelSelection={handleCancelSelection}
        onOpenMoveModal={handleOpenMoveModal}
        onOpenCopyModal={handleOpenCopyModal}
        onDeleteSelected={handleBatchDelete}
      />
    </div>
  );
}
