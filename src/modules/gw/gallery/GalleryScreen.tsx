import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { usePermission } from '@/features/auth/usePermission';

export interface GalleryAlbum {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  images: string[];
  albumId: string;
  date: string; // YYYY-MM-DD (촬영/등록 일자)
  authorId?: string;
  authorName: string;
  authorDept: string;
  createdAt: string;
}

const STORAGE_ALBUMS_KEY = 'workfit_phone_gallery_albums_v3';
const STORAGE_ITEMS_KEY = 'workfit_phone_gallery_items_v3';

const DEFAULT_ALBUMS: GalleryAlbum[] = [
  { id: 'recent', name: '최근 항목', description: '모든 사진이 등록된 기본 앨범', isSystem: true, createdAt: '2026-01-01' },
  { id: 'alb_event', name: '사내 행사', description: '창립기념일, 워크숍, 전사 행사', createdAt: '2026-01-01' },
  { id: 'alb_workshop', name: '세미나 & 교육', description: '기술 세미나 및 사내외 교육', createdAt: '2026-02-15' },
  { id: 'alb_club', name: '동호회 & 소모임', description: '스포츠, 문화 활동 소모임', createdAt: '2026-03-01' },
];

export default function GalleryScreen() {
  const { user } = useAuth();
  const { isSuperAdmin, canAction } = usePermission();
  const canCreate = canAction('S_GW_GALLERY', 'create');
  const canUpdate = canAction('S_GW_GALLERY', 'update');
  const canDelete = canAction('S_GW_GALLERY', 'delete');

  // ── 1. 앨범 상태 ──
  const [albums, setAlbums] = useState<GalleryAlbum[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ALBUMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ALBUMS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_ALBUMS_KEY, JSON.stringify(albums));
  }, [albums]);

  // ── 2. 사진 아이템 상태 ──
  const [items, setItems] = useState<GalleryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ITEMS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      // 마이그레이션: 이전 버전 v2 데이터 가져오기
      const oldSaved = localStorage.getItem('workfit_gallery_posts_v2');
      if (oldSaved) {
        const oldParsed = JSON.parse(oldSaved);
        if (Array.isArray(oldParsed)) {
          return oldParsed.map((p: any) => ({
            id: p.id || `gal-${Date.now()}`,
            title: p.title || '무제 사진',
            description: p.description || '',
            images: Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [],
            albumId: p.folderId && p.folderId.startsWith('alb_') ? p.folderId : 'alb_event',
            date: p.createdAt || new Date().toISOString().split('T')[0],
            authorId: p.authorId,
            authorName: p.authorName || '익명',
            authorDept: p.authorDept || '전사',
            createdAt: p.createdAt || new Date().toISOString().split('T')[0],
          }));
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
  }, [items]);

  // ── 3. 뷰 모드: 'timeline' (날짜별) vs 'albums' (앨범별) ──
  const [activeTab, setActiveTab] = useState<'timeline' | 'albums'>('timeline');

  // 특정 앨범 상세에 진입한 경우 (null이면 전체 앨범 리스트)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // 타임라인 정렬: 'desc' (최신순) | 'asc' (오래된순)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // 년도 필터 ('all' | '2026' | '2025' ...)
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // 검색어
  const [keyword, setKeyword] = useState('');

  // 라이트박스 상태
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // 모달 상태
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // 앨범 생성 / 수정 모달
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumFormName, setAlbumFormName] = useState('');
  const [albumFormDesc, setAlbumFormDesc] = useState('');

  // 사진 업로드 폼
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formAlbumId, setFormAlbumId] = useState('recent');
  const [formImages, setFormImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사용 가능한 년도 목록
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    items.forEach((item) => {
      if (item.date && item.date.length >= 4) {
        years.add(item.date.slice(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [items]);

  // 앨범별 사진 매수 및 대표 커버 맵
  const albumStats = useMemo(() => {
    const map = new Map<string, { count: number; cover?: string }>();
    albums.forEach((a) => {
      const albumItems = a.id === 'recent' ? items : items.filter((it) => it.albumId === a.id);
      const firstImg = albumItems.find((it) => it.images.length > 0)?.images[0];
      map.set(a.id, {
        count: albumItems.length,
        cover: a.coverImage || firstImg,
      });
    });
    return map;
  }, [albums, items]);

  // 검색 필터링된 아이템들
  const searchedItems = useMemo(() => {
    let list = [...items];

    // 특정 앨범 진입 시
    if (activeTab === 'albums' && selectedAlbumId && selectedAlbumId !== 'recent') {
      list = list.filter((it) => it.albumId === selectedAlbumId);
    }

    // 년도 필터 (날짜별 탭일 때)
    if (activeTab === 'timeline' && selectedYear !== 'all') {
      list = list.filter((it) => it.date.startsWith(selectedYear));
    }

    // 검색어 필터
    const q = keyword.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.authorName.toLowerCase().includes(q) ||
          it.date.includes(q),
      );
    }

    // 날짜 정렬
    list.sort((a, b) => {
      const comp = a.date.localeCompare(b.date);
      return sortOrder === 'desc' ? -comp : comp;
    });

    return list;
  }, [items, activeTab, selectedAlbumId, selectedYear, keyword, sortOrder]);

  // 날짜별 그룹화 (YYYY년 M월 D일 그룹)
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; displayDate: string; items: GalleryItem[] }[] = [];
    const dateMap = new Map<string, GalleryItem[]>();

    searchedItems.forEach((item) => {
      const key = item.date || '날짜 미정';
      if (!dateMap.has(key)) {
        dateMap.set(key, []);
      }
      dateMap.get(key)!.push(item);
    });

    dateMap.forEach((groupItems, dateKey) => {
      // 날짜 포맷: 2026. 09. 07 (월)
      let displayDate = dateKey;
      if (dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = dateKey.split('-');
        const dateObj = new Date(`${dateKey}T00:00:00`);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[dateObj.getDay()] || '';
        displayDate = `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일 (${dayName})`;
      }
      groups.push({ dateKey, displayDate, items: groupItems });
    });

    return groups;
  }, [searchedItems]);

  const activeItem = useMemo(
    () => (activeItemId ? items.find((p) => p.id === activeItemId) ?? null : null),
    [items, activeItemId],
  );

  const canManageItem = (item: GalleryItem) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return (item.authorId === user.id || item.authorName === user.name) && (canUpdate || canDelete);
  };

  // 신규 사진 등록 모달 열기
  const handleOpenUploadModal = (targetAlbumId?: string) => {
    setEditingItemId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAlbumId(targetAlbumId || selectedAlbumId || 'recent');
    setFormImages([]);
    setIsUploadModalOpen(true);
  };

  // 사진 수정 모달 열기
  const handleOpenEditModal = (item: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormDate(item.date);
    setFormAlbumId(item.albumId);
    setFormImages([...item.images]);
    setIsUploadModalOpen(true);
  };

  // 사진 파일 선택
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (formImages.length + files.length > 50) {
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

    Promise.all(readers).then((newImages) => {
      setFormImages((prev) => [...prev, ...newImages]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  // 사진 폼 제출
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('사진 제목이나 설명을 입력해주세요.');
      return;
    }
    if (formImages.length === 0) {
      alert('사진을 1장 이상 등록해주세요.');
      return;
    }

    if (editingItemId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                title: formTitle.trim(),
                description: formDescription.trim(),
                date: formDate,
                albumId: formAlbumId,
                images: formImages,
              }
            : it,
        ),
      );
    } else {
      const newItem: GalleryItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: formTitle.trim(),
        description: formDescription.trim(),
        images: formImages,
        albumId: formAlbumId,
        date: formDate,
        authorId: user?.id,
        authorName: user?.name ?? '익명',
        authorDept: user?.dept ?? '전사',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setItems((prev) => [newItem, ...prev]);
    }

    setIsUploadModalOpen(false);
    setEditingItemId(null);
  };

  // 사진 삭제
  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('이 사진을 갤러리에서 삭제하시겠습니까?')) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeItemId === id) setActiveItemId(null);
  };

  // 앨범 생성 및 수정
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
      setAlbums((prev) =>
        prev.map((a) => (a.id === editingAlbumId ? { ...a, name, description: albumFormDesc.trim() } : a)),
      );
    } else {
      const newAlbum: GalleryAlbum = {
        id: `alb_${Date.now()}`,
        name,
        description: albumFormDesc.trim(),
        createdAt: new Date().toISOString().split('T')[0],
      };
      setAlbums((prev) => [...prev, newAlbum]);
    }
    setIsAlbumModalOpen(false);
  };

  const handleDeleteAlbum = (albumId: string, albumName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${albumName}' 앨범을 삭제하시겠습니까?\n앨범 내 사진들은 삭제되지 않고 '최근 항목'에 유지됩니다.`)) {
      return;
    }
    // 사진의 albumId를 recent로 변경
    setItems((prev) => prev.map((it) => (it.albumId === albumId ? { ...it, albumId: 'recent' } : it)));
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    if (selectedAlbumId === albumId) setSelectedAlbumId(null);
  };

  // 라이트박스 이전/다음
  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeItem || activeItem.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activeItem.images.length - 1));
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activeItem || activeItem.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev < activeItem.images.length - 1 ? prev + 1 : 0));
  };

  const currentSelectedAlbum = albums.find((a) => a.id === selectedAlbumId);

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {/* ── 상단 헤더 & 모바일 갤러리 감성 네비게이션 ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-xs font-medium text-ink3 mb-1">
            그룹웨어 <span className="px-1">/</span> 회사 갤러리
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-soft text-xl text-teal shadow-xs">
              📸
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink flex items-center gap-2">
                <span>회사 갤러리</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-panel-alt text-ink2 border border-border">
                  {items.length}장의 사진
                </span>
              </h1>
              <p className="text-[11.5px] text-ink3 mt-0.5">
                스마트폰 사진첩처럼 날짜별 타임라인과 나만의 앨범으로 사진을 체계적으로 감상하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 상단 액션: 검색 & 사진 올리기 */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="사진 제목, 일자, 작성자 검색..."
              className="h-9 w-60 rounded-xl border border-border bg-panel-alt/50 pl-3 pr-8 text-[12px] text-ink outline-none focus:border-teal transition-all placeholder:text-ink3"
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

          {canCreate && (
            <Button size="md" variant="primary" onClick={() => handleOpenUploadModal()}>
              <span>➕ 사진 추가</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 스마트폰 갤러리 모드 스위처 (날짜별 타임라인 | 앨범) ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-panel-alt/40 p-1.5 rounded-2xl border border-border">
        {/* 세그먼트 버튼 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('timeline');
              setSelectedAlbumId(null);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-panel text-teal shadow-xs border border-border/50'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📅</span>
            <span>날짜별 (타임라인)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('albums')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all ${
              activeTab === 'albums'
                ? 'bg-panel text-teal shadow-xs border border-border/50'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📁</span>
            <span>앨범 ({albums.length})</span>
          </button>
        </div>

        {/* 탭별 보조 옵션 */}
        {activeTab === 'timeline' && (
          <div className="flex items-center gap-2 px-2">
            {/* 년도 셀렉트 */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-8 rounded-lg border border-border bg-panel px-2.5 text-[11.5px] font-bold text-ink outline-none"
            >
              <option value="all">전체 년도</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}년
                </option>
              ))}
            </select>

            {/* 정렬 순서 토글 */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1 text-[11.5px] font-bold text-ink2 hover:text-teal hover:border-teal/40 transition-colors"
            >
              <span>{sortOrder === 'desc' ? '⬇ 최신순' : '⬆ 과거순'}</span>
            </button>
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="flex items-center gap-2 px-2">
            {selectedAlbumId && (
              <button
                type="button"
                onClick={() => setSelectedAlbumId(null)}
                className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2.5 py-1 text-[11.5px] font-bold text-ink hover:text-teal"
              >
                <span>‹ 전체 앨범 목록</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenAlbumModal()}
              className="flex items-center gap-1 rounded-lg bg-teal-soft px-3 py-1 text-[11.5px] font-bold text-teal hover:bg-teal hover:text-white transition-all shadow-xs"
            >
              <span>➕ 새 앨범 만들기</span>
            </button>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── 1. 날짜별 (타임라인) 뷰 ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <div className="mt-6 space-y-8">
          {groupedByDate.length > 0 ? (
            groupedByDate.map((group) => (
              <div key={group.dateKey} className="space-y-3">
                {/* 날짜 섹션 헤더 (스마트폰 갤러리 스타일 날짜 바) */}
                <div className="sticky top-0 z-20 flex items-center justify-between backdrop-blur-md bg-panel/90 py-2 border-b border-border/60">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-base font-extrabold text-ink">{group.displayDate}</h2>
                    <span className="text-[11px] font-mono text-ink3">
                      {group.items.length}개의 기록
                    </span>
                  </div>
                </div>

                {/* 해당 일자의 사진 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {group.items.map((item) => (
                    <PhonePhotoCard
                      key={item.id}
                      item={item}
                      albumName={albums.find((a) => a.id === item.albumId)?.name}
                      canManage={canManageItem(item)}
                      onOpenEdit={(e) => handleOpenEditModal(item, e)}
                      onDelete={(e) => handleDeleteItem(item.id, e)}
                      onClick={() => {
                        setActiveItemId(item.id);
                        setActiveImageIndex(0);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyGalleryState
              keyword={keyword}
              onUpload={() => handleOpenUploadModal()}
              canCreate={canCreate}
            />
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── 2. 앨범별 뷰 ── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {activeTab === 'albums' && (
        <div className="mt-6">
          {!selectedAlbumId ? (
            /* 2-A. 전체 앨범 카드 그리드 목록 */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {albums.map((album) => {
                const stat = albumStats.get(album.id);
                const count = stat?.count || 0;
                const cover = stat?.cover;

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbumId(album.id)}
                    className="group flex flex-col cursor-pointer transition-transform hover:-translate-y-1"
                  >
                    {/* 앨범 커버 썸네일 (정사각형) */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-border bg-panel-alt shadow-xs group-hover:shadow-md group-hover:border-teal/50 transition-all">
                      {cover ? (
                        <img
                          src={cover}
                          alt={album.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-4xl select-none bg-gradient-to-br from-panel-alt to-border/30">
                          📁
                        </div>
                      )}

                      {/* 사진 매수 배지 */}
                      <div className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-mono font-bold text-white backdrop-blur-xs">
                        {count}장
                      </div>

                      {/* 앨범 옵션 (커스텀 앨범만) */}
                      {!album.isSystem && (
                        <div
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleOpenAlbumModal(album, e)}
                            className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-[11px] text-white hover:bg-black/80"
                            title="앨범 이름 수정"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAlbum(album.id, album.name, e)}
                            className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-[11px] text-white hover:bg-danger"
                            title="앨범 삭제"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 앨범 타이틀 & 서브텍스트 */}
                    <div className="mt-2.5 px-1">
                      <h3 className="text-sm font-bold text-ink group-hover:text-teal transition-colors truncate">
                        {album.name}
                      </h3>
                      <p className="text-[11px] text-ink3 font-medium">
                        {count}장의 사진 {album.description && `· ${album.description}`}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* 앨범 추가 카드 */}
              <div
                onClick={() => handleOpenAlbumModal()}
                className="flex aspect-square flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border hover:border-teal/50 bg-panel-alt/20 hover:bg-panel-alt/50 cursor-pointer transition-all text-center p-4"
              >
                <span className="text-3xl">➕</span>
                <span className="mt-2 text-xs font-bold text-ink">새 앨범 만들기</span>
                <span className="text-[10.5px] text-ink3 mt-0.5">원하는 테마별 앨범 생성</span>
              </div>
            </div>
          ) : (
            /* 2-B. 특정 앨범 상세 화면 */
            <div className="space-y-4">
              {/* 앨범 헤더 바 */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-panel p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAlbumId(null)}
                    className="grid h-9 w-9 place-items-center rounded-xl bg-panel-alt text-base text-ink hover:bg-teal-soft hover:text-teal transition-colors"
                    title="전체 앨범으로 나가기"
                  >
                    ‹
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-ink">{currentSelectedAlbum?.name}</h2>
                      <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-bold text-teal font-mono">
                        {searchedItems.length}장
                      </span>
                    </div>
                    {currentSelectedAlbum?.description && (
                      <p className="text-[11.5px] text-ink3 mt-0.5">
                        {currentSelectedAlbum.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canCreate && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleOpenUploadModal(selectedAlbumId)}
                    >
                      <span>➕ 이 앨범에 사진 추가</span>
                    </Button>
                  )}
                  {!currentSelectedAlbum?.isSystem && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => handleOpenAlbumModal(currentSelectedAlbum, e)}
                      >
                        ✏️ 앨범 편집
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) =>
                          handleDeleteAlbum(currentSelectedAlbum!.id, currentSelectedAlbum!.name, e)
                        }
                      >
                        🗑️ 앨범 삭제
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 앨범 내 사진 그리드 */}
              {searchedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                  {searchedItems.map((item) => (
                    <PhonePhotoCard
                      key={item.id}
                      item={item}
                      albumName={currentSelectedAlbum?.name}
                      canManage={canManageItem(item)}
                      onOpenEdit={(e) => handleOpenEditModal(item, e)}
                      onDelete={(e) => handleDeleteItem(item.id, e)}
                      onClick={() => {
                        setActiveItemId(item.id);
                        setActiveImageIndex(0);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panel-alt/20 py-20 text-center">
                  <span className="text-4xl">📷</span>
                  <h3 className="mt-3 text-base font-bold text-ink">이 앨범에 사진이 없습니다.</h3>
                  <p className="mt-1 text-[12px] text-ink3">사진을 업로드하여 이 앨범을 채워보세요.</p>
                  {canCreate && (
                    <div className="mt-4">
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() => handleOpenUploadModal(selectedAlbumId)}
                      >
                        이 앨범에 사진 추가하기
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 라이트박스 전체화면 뷰어 모달 ── */}
      {activeItem && (
        <div
          onClick={() => setActiveItemId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={() => setActiveItemId(null)}
            className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-bold text-white hover:bg-white/30 transition-all"
          >
            ✕
          </button>

          {/* 이전/다음 버튼 */}
          {activeItem.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-5 top-1/2 z-20 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-2xl font-bold text-white hover:bg-white/30 transition-all"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-5 top-1/2 z-20 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-2xl font-bold text-white hover:bg-white/30 transition-all"
              >
                ›
              </button>
            </>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-5xl w-full flex-col overflow-hidden rounded-3xl bg-panel shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* 메인 뷰어 이미지 */}
            <div className="relative flex max-h-[65vh] min-h-[350px] w-full items-center justify-center bg-black/95 overflow-hidden">
              <img
                src={activeItem.images[activeImageIndex] || activeItem.images[0]}
                alt={activeItem.title}
                className="max-h-[65vh] w-auto max-w-full object-contain select-none"
              />

              {activeItem.images.length > 1 && (
                <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-mono font-bold text-white backdrop-blur-xs">
                  {activeImageIndex + 1} / {activeItem.images.length}
                </div>
              )}
            </div>

            {/* 썸네일 스트립 바 (2장 이상) */}
            {activeItem.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto bg-panel-alt/50 px-4 py-2 border-t border-border/50">
                {activeItem.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      activeImageIndex === idx
                        ? 'border-teal ring-2 ring-teal/30 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="썸네일" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* 하단 메타 정보 & 액션 */}
            <div className="flex flex-col justify-between p-5 bg-panel border-t border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-ink">{activeItem.title}</h2>
                    <span className="rounded bg-teal-soft px-2 py-0.5 text-[10.5px] font-bold text-teal">
                      {albums.find((a) => a.id === activeItem.albumId)?.name || '기본 앨범'}
                    </span>
                    <span className="text-[11px] font-mono text-ink3">{activeItem.date}</span>
                  </div>
                  {activeItem.description && (
                    <p className="mt-1.5 text-[12.5px] text-ink2 leading-relaxed whitespace-pre-wrap">
                      {activeItem.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canManageItem(activeItem) && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          handleOpenEditModal(activeItem, e);
                          setActiveItemId(null);
                        }}
                      >
                        ✏️ 편집
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={(e) => handleDeleteItem(activeItem.id, e)}
                      >
                        🗑️ 삭제
                      </Button>
                    </>
                  )}
                  <a
                    href={activeItem.images[activeImageIndex] || activeItem.images[0]}
                    download={`${activeItem.title}_${activeImageIndex + 1}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-panel-alt px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-teal-soft hover:text-teal transition-all"
                  >
                    💾 다운로드
                  </a>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px] text-ink3 font-medium">
                <div>
                  <span>등록자: </span>
                  <span className="font-bold text-ink2">{activeItem.authorName}</span>
                  <span> ({activeItem.authorDept})</span>
                </div>
                <div className="font-mono">총 {activeItem.images.length}장의 사진</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 사진 올리기 / 편집 모달 ── */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                <span>{editingItemId ? '✏️ 사진 정보 수정' : '📸 사진 업로드'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="rounded-lg p-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              {/* 저장할 앨범 선택 & 촬영/기록 일자 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-ink2 mb-1">저장할 앨범 *</label>
                  <select
                    value={formAlbumId}
                    onChange={(e) => setFormAlbumId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                  >
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-ink2 mb-1">
                    촬영 / 등록 일자 *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                    required
                  />
                </div>
              </div>

              {/* 사진 첨부 영역 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11.5px] font-bold text-ink2">
                    사진 파일 * ({formImages.length}장 선택됨)
                  </label>
                  {formImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormImages([])}
                      className="text-[10.5px] font-semibold text-danger hover:underline"
                    >
                      전체 비우기
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFilesChange}
                  className="hidden"
                />

                {formImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-panel-alt/30 p-2.5">
                    {formImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square overflow-hidden rounded-xl border border-border group bg-panel"
                      >
                        <img src={img} alt="선택 사진" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[9px] text-white opacity-0 group-hover:opacity-100 hover:bg-danger transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-teal/50 bg-panel cursor-pointer transition-all"
                    >
                      <span className="text-xl">➕</span>
                      <span className="text-[9.5px] font-bold text-ink3 mt-0.5">추가</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-teal/50 bg-panel-alt/30 hover:bg-panel-alt/60 cursor-pointer transition-all"
                  >
                    <span className="text-3xl">📁</span>
                    <span className="mt-2 text-[12px] font-bold text-ink">
                      클릭하여 사진 선택 (다중 선택 가능)
                    </span>
                    <span className="mt-0.5 text-[10.5px] text-ink3">
                      한 번에 최대 50장까지 추가 가능
                    </span>
                  </div>
                )}
              </div>

              {/* 제목 */}
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">제목 *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 2026 하반기 전사 워크숍 기념사진"
                  className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                  required
                />
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">
                  메모 / 설명 (선택)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="사진에 대한 이야기나 장소를 적어주세요..."
                  rows={2}
                  className="w-full rounded-xl border border-border bg-panel-alt/50 p-3 text-[12px] text-ink outline-none focus:border-teal resize-none"
                />
              </div>

              {/* 버튼 */}
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsUploadModalOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" variant="primary" size="md">
                  {editingItemId ? '수정 완료' : `${formImages.length}장 추가 완료`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 앨범 생성 / 편집 모달 ── */}
      {isAlbumModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-panel p-6 shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                <span>{editingAlbumId ? '✏️ 앨범 수정' : '📁 새 앨범 만들기'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAlbumModalOpen(false)}
                className="rounded-lg p-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAlbum} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">앨범 이름 *</label>
                <input
                  value={albumFormName}
                  onChange={(e) => setAlbumFormName(e.target.value)}
                  placeholder="예: 2026 해외 워크숍, 축구 동호회 등"
                  className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1">
                  앨범 설명 (선택)
                </label>
                <input
                  value={albumFormDesc}
                  onChange={(e) => setAlbumFormDesc(e.target.value)}
                  placeholder="간단한 앨범 설명을 입력하세요..."
                  className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12px] text-ink outline-none focus:border-teal"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsAlbumModalOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" variant="primary" size="md">
                  {editingAlbumId ? '저장' : '앨범 생성'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** ── 스마트폰 갤러리 스타일 사진 카드 컴포넌트 ── */
function PhonePhotoCard({
  item,
  albumName,
  canManage,
  onOpenEdit,
  onDelete,
  onClick,
}: {
  item: GalleryItem;
  albumName?: string;
  canManage: boolean;
  onOpenEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const count = item.images.length;
  const currentImg = item.images[0] || '';


  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-xs hover:shadow-md hover:border-teal/50 transition-all cursor-pointer"
    >
      {/* 썸네일 이미지 (정사각형 비율로 모바일 갤러리 느낌 극대화) */}
      <div className="relative aspect-square w-full overflow-hidden bg-panel-alt select-none">
        {currentImg ? (
          <img
            src={currentImg}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-ink3">사진 없음</div>
        )}

        {/* 다중 사진 배지 */}
        {count > 1 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-white backdrop-blur-xs">
            <span>📷</span>
            <span>{count}</span>
          </div>
        )}

        {/* 호버 시 관리 액션 (수정 / 삭제) */}
        {canManage && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onOpenEdit}
              title="사진 수정"
              className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[10px] text-white hover:bg-teal transition-colors"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="사진 삭제"
              className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-[10px] text-white hover:bg-danger transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* 하단 그라디언트 오버레이 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 text-white">
          <h4 className="text-xs font-bold truncate leading-tight drop-shadow-xs">{item.title}</h4>
          <div className="flex items-center justify-between text-[9.5px] text-white/80 mt-0.5 font-mono">
            <span>{item.date}</span>
            {albumName && <span className="truncate max-w-[80px]">{albumName}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 빈 상태 뷰 */
function EmptyGalleryState({
  keyword,
  onUpload,
  canCreate,
}: {
  keyword: string;
  onUpload: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panel-alt/20 py-20 text-center">
      <span className="text-5xl">📷</span>
      <h3 className="mt-4 text-base font-bold text-ink">
        {keyword ? '검색 결과와 일치하는 사진이 없습니다.' : '등록된 사진이 없습니다.'}
      </h3>
      <p className="mt-1 text-[12px] text-ink3 max-w-sm">
        {keyword
          ? '다른 검색어로 다시 시도해보시거나 검색어를 초기화해보세요.'
          : '사내 행사 및 일상 사진을 올려 스마트폰처럼 멋진 갤러리를 만들어보세요.'}
      </p>
      {!keyword && canCreate && (
        <div className="mt-5">
          <Button size="md" variant="primary" onClick={onUpload}>
            첫 번째 사진 올리기
          </Button>
        </div>
      )}
    </div>
  );
}
