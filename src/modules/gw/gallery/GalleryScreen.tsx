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
  { id: 'recent', name: '전체 (최근 항목)', description: '모든 사진이 등록된 기본 앨범', isSystem: true, createdAt: '2026-01-01' },
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

  // ── 3. 기본 탭: 앨범이 먼저 표시되도록 'albums' 기본값 ──
  const [activeTab, setActiveTab] = useState<'albums' | 'timeline'>('albums');

  // 앨범 탭에서 선택된 앨범 ID (기본: 'recent')
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('recent');

  // 날짜별 탭에서 선택된 년도-월 필터 ('all' 또는 '2026-09', '2026' 등)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('all');

  // 정렬 순서
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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

  // ── 3-1. 다중 선택 모드 & 일괄 앨범 이동 상태 ──
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveAlbumId, setTargetMoveAlbumId] = useState<string>('');

  // ── 앨범별 사진 매수 계산 ──
  const albumCounts = useMemo(() => {
    const counts: Record<string, number> = { recent: items.length };
    albums.forEach((a) => {
      counts[a.id] = 0;
    });
    items.forEach((it) => {
      counts[it.albumId] = (counts[it.albumId] || 0) + 1;
    });
    return counts;
  }, [albums, items]);

  // ── 날짜별 사이드바용 년도 - 월 계층 데이터 추출 ──
  const timelineNav = useMemo(() => {
    // map: year -> Set of months
    const yearMap = new Map<string, Set<string>>();
    const monthCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};

    items.forEach((it) => {
      if (it.date && it.date.length >= 7) {
        const yr = it.date.slice(0, 4);
        const ym = it.date.slice(0, 7); // YYYY-MM
        const mo = it.date.slice(5, 7);

        if (!yearMap.has(yr)) {
          yearMap.set(yr, new Set());
        }
        yearMap.get(yr)!.add(mo);

        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      }
    });

    const result: { year: string; count: number; months: { ym: string; monthStr: string; count: number }[] }[] = [];
    Array.from(yearMap.keys())
      .sort()
      .reverse()
      .forEach((yr) => {
        const sortedMonths = Array.from(yearMap.get(yr)!)
          .sort()
          .reverse()
          .map((mo) => ({
            ym: `${yr}-${mo}`,
            monthStr: `${parseInt(mo, 10)}월`,
            count: monthCounts[`${yr}-${mo}`] || 0,
          }));
        result.push({
          year: yr,
          count: yearCounts[yr] || 0,
          months: sortedMonths,
        });
      });

    return result;
  }, [items]);

  // ── 필터링된 사진 목록 ──
  const filteredItems = useMemo(() => {
    let list = [...items];

    // 1. 앨범 모드일 때
    if (activeTab === 'albums') {
      if (selectedAlbumId !== 'recent') {
        list = list.filter((it) => it.albumId === selectedAlbumId);
      }
    }

    // 2. 날짜별 모드일 때
    if (activeTab === 'timeline') {
      if (selectedYearMonth !== 'all') {
        list = list.filter((it) => it.date.startsWith(selectedYearMonth));
      }
    }

    // 3. 검색어 필터
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

    // 4. 날짜 정렬
    list.sort((a, b) => {
      const comp = a.date.localeCompare(b.date);
      return sortOrder === 'desc' ? -comp : comp;
    });

    return list;
  }, [items, activeTab, selectedAlbumId, selectedYearMonth, keyword, sortOrder]);

  // 날짜별 그룹화 (타임라인 모드 전용)
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; displayDate: string; items: GalleryItem[] }[] = [];
    const dateMap = new Map<string, GalleryItem[]>();

    filteredItems.forEach((item) => {
      const key = item.date || '날짜 미정';
      if (!dateMap.has(key)) {
        dateMap.set(key, []);
      }
      dateMap.get(key)!.push(item);
    });

    dateMap.forEach((groupItems, dateKey) => {
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
  }, [filteredItems]);

  const activeItem = useMemo(
    () => (activeItemId ? items.find((p) => p.id === activeItemId) ?? null : null),
    [items, activeItemId],
  );

  const canManageItem = (item: GalleryItem) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    return (item.authorId === user.id || item.authorName === user.name) && (canUpdate || canDelete);
  };

  // 모달 제어
  const handleOpenUploadModal = () => {
    setEditingItemId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAlbumId(selectedAlbumId !== 'recent' ? selectedAlbumId : 'alb_event');
    setFormImages([]);
    setIsUploadModalOpen(true);
  };

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

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('사진 제목을 입력해주세요.');
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

  const handleDeleteItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('이 사진을 갤러리에서 삭제하시겠습니까?')) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeItemId === id) setActiveItemId(null);
  };

  // 앨범 생성 / 수정 / 삭제
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
      setSelectedAlbumId(newAlbum.id);
    }
    setIsAlbumModalOpen(false);
  };

  const handleDeleteAlbum = (albumId: string, albumName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`'${albumName}' 앨범을 삭제하시겠습니까?\n앨범 내 사진들은 삭제되지 않고 '전체 (최근 항목)'에 유지됩니다.`)) {
      return;
    }
    setItems((prev) => prev.map((it) => (it.albumId === albumId ? { ...it, albumId: 'recent' } : it)));
    setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    if (selectedAlbumId === albumId) setSelectedAlbumId('recent');
  };

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

  // ── 3-2. 다중 선택 및 앨범 일괄 이동 핸들러 ──
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedItemIds(new Set());
  };

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

    setItems((prev) =>
      prev.map((item) =>
        selectedItemIds.has(item.id) ? { ...item, albumId: targetMoveAlbumId } : item,
      ),
    );

    alert(
      `${selectedItemIds.size}장의 사진을 '${targetName}' 앨범에 보관했습니다.\n(※ '전체 (최근 항목)'에는 모든 사진이 계속 보관되어 표시됩니다.)`,
    );
    setIsMoveModalOpen(false);
    setSelectedItemIds(new Set());
    setIsSelectionMode(false);
  };

  const currentAlbum = albums.find((a) => a.id === selectedAlbumId);

  return (
    <div className="mx-auto max-w-7xl pb-16">
      {/* ── 상단 헤더 ── */}
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
                앨범별 폴더 및 년도/날짜별 타임라인 사이드바로 사진을 쉽고 편리하게 정리하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 상단 액션: 검색 & 사진 올리기 & 다중 선택 */}
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

          {/* 사진 다중 선택 토글 버튼 */}
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode((prev) => !prev);
              setSelectedItemIds(new Set());
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
              isSelectionMode
                ? 'bg-teal text-white border-teal shadow-xs'
                : 'border-border bg-panel text-ink2 hover:bg-panel-alt hover:text-ink'
            }`}
          >
            <span>{isSelectionMode ? '✓ 선택 종료' : '☑️ 사진 선택'}</span>
          </button>

          {canCreate && (
            <Button size="md" variant="primary" onClick={handleOpenUploadModal}>
              <span>➕ 사진 추가</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 다중 선택 활성화 시 상단 고정 액션바 ── */}
      {isSelectionMode && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-teal/40 bg-panel/95 p-3.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal text-white font-bold text-xs shadow-xs font-mono">
              {selectedItemIds.size}
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink">
                {selectedItemIds.size > 0
                  ? `${selectedItemIds.size}장의 사진이 선택되었습니다`
                  : '사진을 클릭하여 선택하세요'}
              </h4>
              <p className="text-[11px] text-ink3">
                여러 장을 선택하여 원하는 앨범으로 한 번에 보관할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSelectAll}
            >
              <span>
                {selectedItemIds.size === filteredItems.length && filteredItems.length > 0
                  ? '전체 선택 해제'
                  : '전체 선택'}
              </span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={selectedItemIds.size === 0}
              onClick={handleOpenMoveModal}
            >
              <span>📁 앨범에 넣기 ({selectedItemIds.size})</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCancelSelection}
            >
              <span>선택 취소</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── 탭 스위처: [📁 앨범 (기본)] 먼저, 그 다음 [📅 날짜별] ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-panel-alt/40 p-1.5 rounded-2xl border border-border">
        <div className="flex items-center gap-1">
          {/* 1. 앨범 탭 (기본 우선 노출) */}
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
            <span>앨범 보관함 ({albums.length})</span>
          </button>

          {/* 2. 날짜별 탭 */}
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all ${
              activeTab === 'timeline'
                ? 'bg-panel text-teal shadow-xs border border-border/50'
                : 'text-ink3 hover:text-ink'
            }`}
          >
            <span>📅</span>
            <span>날짜별 (타임라인)</span>
          </button>
        </div>

        {/* 정렬 순서 토글 */}
        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          className="flex items-center gap-1 rounded-lg border border-border bg-panel px-3 py-1.5 text-[11.5px] font-bold text-ink2 hover:text-teal transition-colors"
        >
          <span>{sortOrder === 'desc' ? '⬇ 최신 날짜순' : '⬆ 과거 날짜순'}</span>
        </button>
      </div>

      {/* ── 메인 2단 레이아웃 (좌측 사이드바 + 우측 갤러리 그리드) ── */}
      <div className="mt-5 flex flex-col md:flex-row gap-5 items-start">
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ── A. 좌측 사이드바 영역 ── */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <aside
          className="w-full md:w-[240px] shrink-0 rounded-2xl border border-border bg-panel p-3.5 shadow-xs"
          style={{ width: '240px', minWidth: '240px' }}
        >
          {activeTab === 'albums' ? (
            /* 1. 앨범 사이드바: 앨범을 클릭할 수 있는 사이드바 */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <span>📁</span>
                  <span>앨범 목록</span>
                </span>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => handleOpenAlbumModal()}
                    className="flex items-center gap-1 text-[11px] font-bold text-teal hover:bg-teal-soft/60 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <span>+ 새 앨범</span>
                  </button>
                )}
              </div>

              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {albums.map((album) => {
                  const count = albumCounts[album.id] || 0;
                  const isSelected = selectedAlbumId === album.id;
                  return (
                    <div
                      key={album.id}
                      onClick={() => setSelectedAlbumId(album.id)}
                      className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal text-white shadow-xs'
                          : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <span className="text-base">{album.id === 'recent' ? '🗂️' : '📁'}</span>
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
                            onClick={(e) => handleDeleteAlbum(album.id, album.name, e)}
                            title="앨범 삭제"
                            className={`opacity-0 group-hover:opacity-100 p-0.5 text-xs rounded transition-opacity ${
                              isSelected ? 'text-white/80 hover:text-white' : 'text-ink3 hover:text-danger'
                            }`}
                          >
                            ✕
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
                  <span>📅</span>
                  <span>년도 · 월 선택</span>
                </span>
                <span className="text-[10px] font-mono text-ink3">총 {items.length}장</span>
              </div>

              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {/* 전체 기간 선택 */}
                <button
                  type="button"
                  onClick={() => setSelectedYearMonth('all')}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-bold transition-all ${
                    selectedYearMonth === 'all'
                      ? 'bg-teal text-white shadow-xs'
                      : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                  }`}
                >
                  <span>📅 전체 기간</span>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10px] font-mono ${
                      selectedYearMonth === 'all'
                        ? 'bg-white/20 text-white'
                        : 'bg-panel-alt text-ink3 border border-border/50'
                    }`}
                  >
                    {items.length}
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
                        onClick={() => setSelectedYearMonth(group.year)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold transition-colors ${
                          isYearSelected
                            ? 'bg-teal/15 text-teal border border-teal/30'
                            : 'text-ink hover:bg-panel-alt'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px]">📁</span>
                          <span>{group.year}년</span>
                        </span>
                        <span className="text-[10px] font-mono text-ink3">{group.count}장</span>
                      </button>

                      {/* 하위 월 목록 */}
                      <div className="ml-3 pl-2 border-l border-border/60 space-y-0.5">
                        {group.months.map((m) => {
                          const isMonthSelected = selectedYearMonth === m.ym;
                          return (
                            <button
                              key={m.ym}
                              type="button"
                              onClick={() => setSelectedYearMonth(m.ym)}
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

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ── B. 우측 메인 갤러리 그리드 영역 ── */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <main className="flex-1 min-w-0 w-full">
          {/* 상단 뷰어 안내 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 rounded-2xl border border-border bg-panel p-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">
                {activeTab === 'albums'
                  ? selectedAlbumId === 'recent'
                    ? '🗂️'
                    : '📁'
                  : '📅'}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink">
                    {activeTab === 'albums'
                      ? currentAlbum?.name
                      : selectedYearMonth === 'all'
                      ? '전체 타임라인 사진'
                      : `${selectedYearMonth.replace('-', '년 ')}월 사진`}
                  </h2>
                  <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-bold text-teal font-mono">
                    {filteredItems.length}장의 사진
                  </span>
                </div>
                {activeTab === 'albums' && currentAlbum?.description && (
                  <p className="text-[11.5px] text-ink3 mt-0.5">{currentAlbum.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canCreate && (
                <Button size="sm" variant="primary" onClick={handleOpenUploadModal}>
                  <span>➕ 이 위치에 사진 올리기</span>
                </Button>
              )}
              {activeTab === 'albums' && !currentAlbum?.isSystem && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => handleOpenAlbumModal(currentAlbum, e)}
                >
                  <span>✏️ 앨범명 수정</span>
                </Button>
              )}
            </div>
          </div>

          {/* 사진 그리드 출력 (날짜별 탭일 때는 날짜 헤더와 함께 그룹화) */}
          {activeTab === 'timeline' ? (
            groupedByDate.length > 0 ? (
              <div className="space-y-6">
                {groupedByDate.map((group) => (
                  <div key={group.dateKey} className="space-y-3">
                    <div className="sticky top-0 z-20 flex items-center justify-between backdrop-blur-md bg-panel/90 py-1.5 px-1 border-b border-border/60">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-extrabold text-ink">{group.displayDate}</h3>
                        <span className="text-[11px] font-mono text-ink3">
                          {group.items.length}개의 기록
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                      {group.items.map((item) => (
                        <PhonePhotoCard
                          key={item.id}
                          item={item}
                          albumName={albums.find((a) => a.id === item.albumId)?.name}
                          canManage={canManageItem(item)}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedItemIds.has(item.id)}
                          onToggleSelect={() => toggleSelectItem(item.id)}
                          onOpenEdit={(e) => handleOpenEditModal(item, e)}
                          onDelete={(e) => handleDeleteItem(item.id, e)}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleSelectItem(item.id);
                            } else {
                              setActiveItemId(item.id);
                              setActiveImageIndex(0);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState keyword={keyword} onUpload={handleOpenUploadModal} canCreate={canCreate} />
            )
          ) : filteredItems.length > 0 ? (
            /* 앨범 탭의 사진 그리드 */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {filteredItems.map((item) => (
                <PhonePhotoCard
                  key={item.id}
                  item={item}
                  albumName={albums.find((a) => a.id === item.albumId)?.name}
                  canManage={canManageItem(item)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedItemIds.has(item.id)}
                  onToggleSelect={() => toggleSelectItem(item.id)}
                  onOpenEdit={(e) => handleOpenEditModal(item, e)}
                  onDelete={(e) => handleDeleteItem(item.id, e)}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleSelectItem(item.id);
                    } else {
                      setActiveItemId(item.id);
                      setActiveImageIndex(0);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState keyword={keyword} onUpload={handleOpenUploadModal} canCreate={canCreate} />
          )}
        </main>
      </div>

      {/* ── 라이트박스 전체화면 뷰어 모달 ── */}
      {activeItem && (
        <div
          onClick={() => setActiveItemId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <button
            type="button"
            onClick={() => setActiveItemId(null)}
            className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-bold text-white hover:bg-white/30 transition-all"
          >
            ✕
          </button>

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

      {/* ── 일괄 앨범 이동 모달 ── */}
      {isMoveModalOpen && (
        <div
          onClick={() => setIsMoveModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-3xl bg-panel border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
                <span>📁</span>
                <span>선택한 사진 앨범에 넣기</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="rounded-lg p-1 text-sm font-bold text-ink3 hover:bg-panel-alt hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-xs text-ink2">
                <span>
                  선택한 사진 <strong className="text-teal font-mono font-bold">{selectedItemIds.size}장</strong>
                </span>
                <span className="text-[11px] text-ink3">보관할 대상 앨범을 선택하세요</span>
              </div>

              {/* 앨범 선택 라디오 목록 */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {albums
                  .filter((a) => !a.isSystem)
                  .map((album) => {
                    const isTarget = targetMoveAlbumId === album.id;
                    return (
                      <div
                        key={album.id}
                        onClick={() => setTargetMoveAlbumId(album.id)}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                          isTarget
                            ? 'border-teal bg-teal-soft/40 shadow-xs'
                            : 'border-border bg-panel-alt/30 hover:bg-panel-alt'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <span className="text-lg">📁</span>
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
                            onChange={() => setTargetMoveAlbumId(album.id)}
                            className="accent-teal h-4 w-4"
                          />
                        </div>
                      </div>
                    );
                  })}

                {albums.filter((a) => !a.isSystem).length === 0 && (
                  <div className="py-6 text-center text-xs text-ink3">
                    생성된 앨범이 없습니다. 먼저 새 앨범을 만들어주세요.
                  </div>
                )}
              </div>

              {/* 최근항목 상시 보존 안내 팁 */}
              <div className="rounded-2xl bg-panel-alt/60 p-3.5 border border-border text-[11.5px] text-ink3 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-ink">
                  <span>💡</span>
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
                  onClick={() => setIsMoveModalOpen(false)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={!targetMoveAlbumId}
                  onClick={handleExecuteMove}
                >
                  앨범에 넣기 ({selectedItemIds.size}장)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 사진 카드 컴포넌트 */
function PhonePhotoCard({
  item,
  albumName,
  canManage,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onOpenEdit,
  onDelete,
  onClick,
}: {
  item: GalleryItem;
  albumName?: string;
  canManage: boolean;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onOpenEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const count = item.images.length;
  const currentImg = item.images[0] || '';

  return (
    <div
      onClick={() => {
        if (isSelectionMode && onToggleSelect) {
          onToggleSelect();
        } else {
          onClick();
        }
      }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-panel shadow-xs transition-all cursor-pointer select-none ${
        isSelected
          ? 'border-teal ring-2 ring-teal ring-offset-2 scale-[0.98]'
          : 'border-border hover:shadow-md hover:border-teal/50'
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-panel-alt select-none">
        {currentImg ? (
          <img
            src={currentImg}
            alt={item.title}
            className={`h-full w-full object-cover transition-transform duration-300 ${
              isSelected ? 'scale-100 brightness-95' : 'group-hover:scale-105'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-ink3">사진 없음</div>
        )}

        {/* 다중 선택 모드 체크 서클 */}
        {isSelectionMode ? (
          <div className="absolute top-2.5 left-2.5 z-10">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all shadow-md ${
                isSelected
                  ? 'bg-teal border-white text-white scale-110 font-bold'
                  : 'bg-black/50 border-white/90 text-transparent hover:border-white hover:bg-black/70'
              }`}
            >
              <span className="text-[11px] leading-none">✓</span>
            </div>
          </div>
        ) : (
          canManage && (
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
          )
        )}

        {count > 1 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-white backdrop-blur-xs">
            <span>📷</span>
            <span>{count}</span>
          </div>
        )}

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

function EmptyState({
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
        {keyword ? '검색 결과와 일치하는 사진이 없습니다.' : '이 영역에 등록된 사진이 없습니다.'}
      </h3>
      <p className="mt-1 text-[12px] text-ink3 max-w-sm">
        {keyword
          ? '다른 검색어로 다시 시도해보시거나 검색어를 초기화해보세요.'
          : '사진을 업로드하여 갤러리를 채워보세요.'}
      </p>
      {!keyword && canCreate && (
        <div className="mt-5">
          <Button size="md" variant="primary" onClick={onUpload}>
            사진 올리기
          </Button>
        </div>
      )}
    </div>
  );
}
