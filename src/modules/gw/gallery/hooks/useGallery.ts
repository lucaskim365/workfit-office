import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import type {
  GalleryAlbum,
  GalleryItem,
  UploadImageItem,
  TimelineYearGroup,
  DateGroupedItems,
} from '../types';
import {
  loadAlbumsFromStorage,
  saveAlbumsToStorage,
  loadItemsFromStorage,
  saveItemsToStorage,
} from '../utils/galleryStorage';

export function useGallery() {
  const { user } = useAuth();

  // 1. 앨범 상태
  const [albums, setAlbums] = useState<GalleryAlbum[]>(loadAlbumsFromStorage);

  useEffect(() => {
    saveAlbumsToStorage(albums);
  }, [albums]);

  // 2. 사진 아이템 상태
  const [items, setItems] = useState<GalleryItem[]>(loadItemsFromStorage);

  useEffect(() => {
    saveItemsToStorage(items);
  }, [items]);

  // 3. 뷰 필터 및 정렬 상태
  const [activeTab, setActiveTab] = useState<'albums' | 'timeline'>('albums');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all_albums');
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [keyword, setKeyword] = useState<string>('');

  // ── 앨범별 사진 매수 계산 ──
  const albumCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    albums.forEach((a) => {
      counts[a.id] = 0;
    });
    items.forEach((it) => {
      if (counts[it.albumId] !== undefined) {
        counts[it.albumId] += 1;
      }
    });
    counts.recent = items.length;
    return counts;
  }, [albums, items]);

  // ── 앨범별 최신 사진 날짜 계산 ──
  const albumLatestDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    albums.forEach((alb) => {
      const albumPhotos =
        alb.id === 'recent' ? items : items.filter((it) => it.albumId === alb.id);

      if (albumPhotos.length > 0) {
        const latest = albumPhotos.reduce((max, it) => (it.date > max ? it.date : max), '');
        map[alb.id] = latest;
      } else {
        map[alb.id] = alb.createdAt || '';
      }
    });
    return map;
  }, [albums, items]);

  // ── 앨범별 커버 이미지 매핑 ──
  const albumCoverMap = useMemo(() => {
    const map: Record<string, string> = {};
    albums.forEach((alb) => {
      if (alb.coverImage) {
        map[alb.id] = alb.coverImage;
      } else {
        const match = items.find(
          (it) => (alb.id === 'recent' ? true : it.albumId === alb.id) && it.images?.length > 0,
        );
        if (match) {
          map[alb.id] = match.images[0];
        }
      }
    });
    return map;
  }, [albums, items]);

  // ── 날짜별 사이드바용 년도-월 계층 데이터 ──
  const timelineNav = useMemo((): TimelineYearGroup[] => {
    const yearMap = new Map<string, Set<string>>();
    const monthCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};

    items.forEach((it) => {
      if (it.date && it.date.length >= 7) {
        const yr = it.date.slice(0, 4);
        const ym = it.date.slice(0, 7);
        const mo = it.date.slice(5, 7);

        if (!yearMap.has(yr)) {
          yearMap.set(yr, new Set());
        }
        yearMap.get(yr)!.add(mo);

        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      }
    });

    const result: TimelineYearGroup[] = [];
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

  // ── 필터링 및 정렬된 사진 목록 ──
  const filteredItems = useMemo(() => {
    let list = [...items];

    if (activeTab === 'albums') {
      if (selectedAlbumId !== 'recent' && selectedAlbumId !== 'all_albums') {
        list = list.filter((it) => it.albumId === selectedAlbumId);
      }
    }

    if (activeTab === 'timeline') {
      if (selectedYearMonth !== 'all') {
        list = list.filter((it) => it.date.startsWith(selectedYearMonth));
      }
    }

    const q = keyword.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (it) =>
          (it.caption || '').toLowerCase().includes(q) ||
          (it.description || '').toLowerCase().includes(q) ||
          (it.title || '').toLowerCase().includes(q) ||
          (it.authorName || '').toLowerCase().includes(q) ||
          (it.date || '').includes(q),
      );
    }

    list.sort((a, b) => {
      const comp = a.date.localeCompare(b.date);
      return sortOrder === 'desc' ? -comp : comp;
    });

    return list;
  }, [items, activeTab, selectedAlbumId, selectedYearMonth, keyword, sortOrder]);

  // ── 날짜별 그룹화 (타임라인 전용) ──
  const groupedByDate = useMemo((): DateGroupedItems[] => {
    const groups: DateGroupedItems[] = [];
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

  // ── 현재 선택된 앨범 객체 ──
  const currentAlbum = useMemo(() => {
    if (selectedAlbumId === 'all_albums') {
      return {
        id: 'all_albums',
        name: '전체 앨범 보관함',
        description: '등록된 모든 앨범을 한눈에 둘러보고 정리하세요.',
        createdAt: '',
        isSystem: true,
      };
    }
    return albums.find((a) => a.id === selectedAlbumId);
  }, [albums, selectedAlbumId]);

  // ── 앨범 조작 함수 ──
  const createAlbum = useCallback((name: string, description?: string) => {
    const newAlb: GalleryAlbum = {
      id: `alb_${Date.now()}`,
      name: name.trim(),
      description: description?.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAlbums((prev) => [...prev, newAlb]);
    return newAlb;
  }, []);

  const updateAlbum = useCallback((id: string, name: string, description?: string) => {
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, name: name.trim(), description: description?.trim() }
          : a,
      ),
    );
  }, []);

  const deleteAlbum = useCallback((id: string) => {
    const count = items.filter((it) => it.albumId === id).length;
    // 앨범 내 사진들을 '기본 앨범(사내 행사)'으로 자동 이관
    setItems((prev) =>
      prev.map((it) => (it.albumId === id ? { ...it, albumId: 'alb_event' } : it)),
    );
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    return count;
  }, [items]);

  const setCoverImage = useCallback((albumId: string, imageUrl: string) => {
    setAlbums((prev) =>
      prev.map((alb) => (alb.id === albumId ? { ...alb, coverImage: imageUrl } : alb)),
    );
  }, []);

  // ── 사진 조작 함수 ──
  const addPhotos = useCallback(
    (params: {
      date: string;
      albumId: string;
      uploadImages: UploadImageItem[];
    }) => {
      const authorName = user?.name ? `${user.name} ${user.position || ''}`.trim() : '게스트';
      const authorDept = user?.dept || '전사';
      const authorId = user?.id || 'guest';
      const now = new Date().toISOString().split('T')[0];

      const newGalleryItems: GalleryItem[] = params.uploadImages.map((img, idx) => ({
        id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        description: img.caption.trim(),
        caption: img.caption.trim(),
        images: [img.url],
        albumId: params.albumId,
        date: params.date,
        authorId,
        authorName,
        authorDept,
        createdAt: now,
      }));

      setItems((prev) => [...newGalleryItems, ...prev]);
      return newGalleryItems.length;
    },
    [user],
  );

  const updatePhoto = useCallback(
    (id: string, params: { caption: string; date: string; albumId: string; imageUrl?: string }) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                description: params.caption.trim(),
                caption: params.caption.trim(),
                date: params.date,
                albumId: params.albumId,
                images: params.imageUrl ? [params.imageUrl] : it.images,
              }
            : it,
        ),
      );
    },
    [],
  );

  const deletePhoto = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const batchMovePhotos = useCallback((itemIds: Set<string>, targetAlbumId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        itemIds.has(item.id) ? { ...item, albumId: targetAlbumId } : item,
      ),
    );
  }, []);

  const batchCopyPhotos = useCallback((itemIds: Set<string>, targetAlbumId: string) => {
    setItems((prev) => {
      const selectedItems = prev.filter((it) => itemIds.has(it.id));
      const copiedItems: GalleryItem[] = selectedItems.map((item, idx) => ({
        ...item,
        id: `img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        albumId: targetAlbumId,
        createdAt: new Date().toISOString().split('T')[0],
      }));
      return [...copiedItems, ...prev];
    });
  }, []);

  const batchDeletePhotos = useCallback((itemIds: Set<string>) => {
    setItems((prev) => prev.filter((it) => !itemIds.has(it.id)));
  }, []);

  return {
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
    albumCounts,
    albumLatestDateMap,
    albumCoverMap,
    timelineNav,
    filteredItems,
    groupedByDate,
    currentAlbum,
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
  };
}
