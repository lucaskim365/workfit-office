import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { INITIAL_GALLERY_POSTS, type GalleryPost } from '@/data/seeds/gallery.seed';

const STORAGE_KEY = 'workfit_gallery_posts_v2';

export default function GalleryScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<GalleryPost[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((p: any) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : p.imageUrl ? [p.imageUrl] : [],
        }));
      }
    } catch {
      // ignore
    }
    return INITIAL_GALLERY_POSTS;
  });

  // LocalStorage 동기화
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // ignore
    }
  }, [posts]);

  const [keyword, setKeyword] = useState('');

  // 메뉴 팝오버 열림 상태 (어떤 포스트의 메뉴인지)
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  // 라이트박스 상태
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // 등록/수정 모달 상태
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // 폼 입력 상태
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleGlobalClick = () => setOpenMenuPostId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // 검색 필터링
  const filteredPosts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorDept.toLowerCase().includes(q),
    );
  }, [posts, keyword]);

  const activePost = useMemo(
    () => (activePostId ? posts.find((p) => p.id === activePostId) ?? null : null),
    [posts, activePostId],
  );

  // 작성자 또는 관리자 본인 확인
  const canManagePost = (post: GalleryPost) => {
    if (!user) return false;
    if (user.roleGroup === 'ADMIN') return true;
    if (post.authorId && post.authorId === user.id) return true;
    if (post.authorName === user.name) return true;
    return false;
  };

  // 신규 등록 모달 열기
  const handleOpenUploadModal = () => {
    setEditingPostId(null);
    setFormTitle('');
    setFormDescription('');
    setFormImages([]);
    setIsUploadModalOpen(true);
  };

  // 수정 모달 열기
  const handleOpenEditModal = (post: GalleryPost, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuPostId(null);
    setEditingPostId(post.id);
    setFormTitle(post.title);
    setFormDescription(post.description);
    setFormImages([...post.images]);
    setIsUploadModalOpen(true);
  };

  // 다중 이미지 파일 선택 처리
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (formImages.length + files.length > 30) {
      alert('한 번에 최대 30장의 사진까지 등록할 수 있습니다.');
      return;
    }

    const readers: Promise<string>[] = [];
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        alert(`15MB를 초과하는 파일(${file.name})은 제외됩니다.`);
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

  // 선택된 개별 이미지 제거
  const handleRemoveFormImage = (idxToRemove: number) => {
    setFormImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // 대표 사진으로 지정 (해당 사진을 맨 앞 0번 인덱스로 이동)
  const handleSetCoverImage = (idxToCover: number) => {
    if (idxToCover === 0) return;
    setFormImages((prev) => {
      const target = prev[idxToCover];
      const rest = prev.filter((_, idx) => idx !== idxToCover);
      return [target, ...rest];
    });
  };

  // 등록 / 수정 폼 제출
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (formImages.length === 0) {
      alert('사진을 1장 이상 등록해주세요.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (editingPostId) {
      // 수정 모드
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== editingPostId) return p;
          const isContentChanged = p.title !== formTitle.trim() || p.description !== formDescription.trim();
          return {
            ...p,
            title: formTitle.trim(),
            description: formDescription.trim(),
            images: formImages,
            updatedAt: today,
            isEdited: p.isEdited || isContentChanged,
          };
        }),
      );
    } else {
      // 신규 등록 모드
      const newPost: GalleryPost = {
        id: `gal-${Date.now()}`,
        title: formTitle.trim(),
        description: formDescription.trim(),
        images: formImages,
        authorId: user?.id,
        authorName: user?.name ?? '익명',
        authorDept: user?.dept ?? '기타',
        createdAt: today,
        isEdited: false,
      };
      setPosts((prev) => [newPost, ...prev]);
    }

    setIsUploadModalOpen(false);
    setEditingPostId(null);
    setFormTitle('');
    setFormDescription('');
    setFormImages([]);
  };

  // 사진첩 삭제
  const handleDeletePost = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuPostId(null);
    if (!confirm('정말 이 사진첩을 삭제하시겠습니까?')) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (activePostId === id) setActivePostId(null);
  };

  // 라이트박스 이전/다음 사진 이동
  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activePost || activePost.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : activePost.images.length - 1));
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!activePost || activePost.images.length <= 1) return;
    setActiveImageIndex((prev) => (prev < activePost.images.length - 1 ? prev + 1 : 0));
  };

  // 키보드 좌우 화살표 & ESC 지원
  useEffect(() => {
    if (!activePost) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'Escape') setActivePostId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePost, activeImageIndex]);

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {/* 브레드크럼 */}
      <div className="mb-1 text-xs font-medium text-ink3">
        그룹웨어 <span className="px-1">/</span> 사진첩
      </div>

      {/* 헤더 & 상단 툴바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-soft text-xl text-teal shadow-xs">
            🖼️
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">사내 사진첩</h1>
            <p className="text-[11.5px] text-ink3 mt-0.5">사내 행사 등 각종 활동 사진을 공유하고 감상하는 갤러리입니다.</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제목, 내용, 작성자 검색..."
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

          <Button
            size="md"
            variant="primary"
            onClick={handleOpenUploadModal}
          >
            ➕ 사진 올리기
          </Button>
        </div>
      </div>

      {/* ── 사진첩 그리드 목록 ── */}
      {filteredPosts.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPosts.map((post) => (
            <GalleryCard
              key={post.id}
              post={post}
              canManage={canManagePost(post)}
              isMenuOpen={openMenuPostId === post.id}
              onToggleMenu={() => setOpenMenuPostId(openMenuPostId === post.id ? null : post.id)}
              onOpenEdit={(e) => handleOpenEditModal(post, e)}
              onDelete={(e) => handleDeletePost(post.id, e)}
              onClick={(selectedIdx) => {
                setActivePostId(post.id);
                setActiveImageIndex(selectedIdx);
              }}
            />
          ))}
        </div>
      ) : (
        /* 빈 사진첩 상태 */
        <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-panel-alt/20 py-20 text-center">
          <span className="text-4xl">📷</span>
          <h3 className="mt-3 text-base font-bold text-ink">
            {keyword ? '검색 결과와 일치하는 사진이 없습니다.' : '등록된 사진이 없습니다.'}
          </h3>
          <p className="mt-1 text-[12px] text-ink3 max-w-sm">
            {keyword
              ? '다른 검색어로 다시 시도해보시거나 검색어를 초기화해보세요.'
              : '선포식 사진들을 여러 장 선택하여 사진첩에 올려보세요.'}
          </p>
          {!keyword && (
            <div className="mt-5">
              <Button
                size="md"
                variant="primary"
                onClick={handleOpenUploadModal}
              >
                첫 번째 사진첩 올리기
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 라이트박스(Lightbox) 전체화면 다중 뷰어 모달 ── */}
      {activePost && (
        <div
          onClick={() => setActivePostId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          {/* 닫기 버튼 */}
          <button
            type="button"
            onClick={() => setActivePostId(null)}
            className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl font-bold text-white hover:bg-white/20 transition-all"
          >
            ✕
          </button>

          {/* 이전 버튼 */}
          {activePost.images.length > 1 && (
            <button
              type="button"
              onClick={handlePrevPhoto}
              className="absolute left-5 top-1/2 z-20 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-2xl font-bold text-white hover:bg-white/25 transition-all"
            >
              ‹
            </button>
          )}

          {/* 다음 버튼 */}
          {activePost.images.length > 1 && (
            <button
              type="button"
              onClick={handleNextPhoto}
              className="absolute right-5 top-1/2 z-20 -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-2xl font-bold text-white hover:bg-white/25 transition-all"
            >
              ›
            </button>
          )}

          {/* 모달 본문 카드 */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] max-w-5xl w-full flex-col overflow-hidden rounded-3xl bg-panel shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* 메인 뷰 이미지 영역 */}
            <div className="relative flex max-h-[60vh] min-h-[300px] w-full items-center justify-center bg-black/95 overflow-hidden">
              <img
                src={activePost.images[activeImageIndex] || activePost.images[0]}
                alt={`${activePost.title} - ${activeImageIndex + 1}`}
                className="max-h-[60vh] w-auto max-w-full object-contain select-none"
              />

              {/* 사진 순서 표시 배지 */}
              {activePost.images.length > 1 && (
                <div className="absolute top-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-mono font-bold text-white backdrop-blur-xs">
                  {activeImageIndex + 1} / {activePost.images.length}
                </div>
              )}
            </div>

            {/* 다중 사진 썸네일 스트립 바 (2장 이상일 때 노출) */}
            {activePost.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto bg-panel-alt/50 px-4 py-2 border-t border-border/50">
                {activePost.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${activeImageIndex === idx
                      ? 'border-teal ring-2 ring-teal/30 scale-105'
                      : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                  >
                    <img src={img} alt="썸네일" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* 하단 설명 및 메타 정보 */}
            <div className="flex flex-col justify-between p-5 sm:p-6 bg-panel border-t border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-ink">{activePost.title}</h2>
                    {activePost.isEdited && (
                      <span className="rounded bg-panel-alt px-1.5 py-0.5 text-[10px] font-bold text-amber border border-amber/20">
                        수정됨
                      </span>
                    )}
                  </div>
                  {activePost.description && (
                    <p className="mt-1.5 text-[12.5px] text-ink2 leading-relaxed whitespace-pre-wrap">
                      {activePost.description}
                    </p>
                  )}
                </div>

                {/* 우측 버튼 액션 (편집 & 다운로드) */}
                <div className="flex items-center gap-2 shrink-0">
                  {canManagePost(activePost) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        handleOpenEditModal(activePost, e);
                        setActivePostId(null);
                      }}
                    >
                      ✏️ 편집
                    </Button>
                  )}
                  <a
                    href={activePost.images[activeImageIndex] || activePost.images[0]}
                    download={`${activePost.title}_${activeImageIndex + 1}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1.5 rounded-md border border-border bg-panel-alt px-3 py-1.5 text-[10.5px] font-bold text-ink hover:bg-teal-soft hover:text-teal hover:border-teal/30 transition-all"
                  >
                    <span>💾</span>
                    <span>다운로드</span>
                  </a>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between border-t border-border/60 pt-3 text-[11px] text-ink3 font-medium">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-teal">{activePost.authorName}</span>
                  <span>({activePost.authorDept})</span>
                  <span>·</span>
                  <span className="font-mono">{activePost.createdAt}</span>
                  {activePost.isEdited && <span className="text-amber">(수정됨)</span>}
                </div>
                <div className="text-[10.5px] font-mono text-ink3">
                  총 {activePost.images.length}장의 사진
                </div>
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
                <span>{editingPostId ? '✏️ 사진첩 편집' : '📸 사진 올리기'}</span>
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
              {/* 이미지 다중 선택 & 미리보기 그리드 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11.5px] font-bold text-ink2">
                    사진 목록 * ({formImages.length}장 선택됨)
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
                  <div className="space-y-3">
                    {/* 선택된 사진 썸네일 그리드 */}
                    <div className="grid grid-cols-4 gap-2.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-panel-alt/30 p-2.5">
                      {formImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-border group bg-panel">
                          <img src={img} alt={`미리보기 ${idx + 1}`} className="h-full w-full object-cover" />
                          {idx === 0 ? (
                            <span className="absolute bottom-1 left-1 rounded bg-teal px-1.5 py-0.5 text-[8.5px] font-extrabold text-white shadow-xs">
                              ★ 대표 사진
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCoverImage(idx)}
                              title="이 사진을 대표 사진으로 설정"
                              className="absolute bottom-1 left-1 rounded bg-black/60 hover:bg-teal px-1.5 py-0.5 text-[8.5px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-xs"
                            >
                              ★ 대표로 설정
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveFormImage(idx)}
                            title="사진 삭제"
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[9px] text-white opacity-0 group-hover:opacity-100 hover:bg-danger transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {/* 추가 사진 추가 버튼 */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-teal/50 bg-panel cursor-pointer transition-all text-center"
                      >
                        <span className="text-xl">➕</span>
                        <span className="text-[9.5px] font-bold text-ink3 mt-0.5">사진 추가</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border hover:border-teal/50 bg-panel-alt/30 hover:bg-panel-alt/60 cursor-pointer transition-all"
                  >
                    <span className="text-3xl">📁</span>
                    <span className="mt-2 text-[12px] font-bold text-ink">클릭하여 사진 선택 (여러 장 가능)</span>
                    <span className="mt-0.5 text-[10.5px] text-ink3">한 번에 최대 30장까지 다중 선택 가능</span>
                  </div>
                )}
              </div>

              {/* 제목 입력 */}
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1.5">제목 *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 2026 비전 선포식 현장 스케치"
                  className="h-10 w-full rounded-xl border border-border bg-panel-alt/50 px-3 text-[12.5px] text-ink outline-none focus:border-teal transition-colors"
                  required
                />
              </div>

              {/* 설명 / 내용 입력 */}
              <div>
                <label className="block text-[11.5px] font-bold text-ink2 mb-1.5">내용 / 설명 (선택)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="사진들에 대한 간단한 설명이나 메모를 적어주세요..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-panel-alt/50 p-3 text-[12px] text-ink outline-none focus:border-teal transition-colors resize-none"
                />
              </div>

              {/* 모달 하단 버튼 */}
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
                  {editingPostId ? '수정 완료' : `${formImages.length}장 등록 완료`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** ── 개별 사진첩 카드 컴포넌트 (썸네일 호버 시 좌우 넘기기 지원) ── */
function GalleryCard({
  post,
  canManage,
  isMenuOpen,
  onToggleMenu,
  onOpenEdit,
  onDelete,
  onClick,
}: {
  post: GalleryPost;
  canManage: boolean;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onOpenEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: (selectedIdx: number) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const count = post.images.length;
  const currentImg = post.images[currentIdx] || post.images[0] || '';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev > 0 ? prev - 1 : count - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIdx((prev) => (prev < count - 1 ? prev + 1 : 0));
  };

  return (
    <div
      onClick={() => onClick(currentIdx)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-xs hover:shadow-md hover:border-teal/40 transition-all cursor-pointer relative"
    >
      {/* 썸네일 이미지 영역 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-panel-alt select-none">
        {currentImg ? (
          <img
            src={currentImg}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink3 text-xs">사진 없음</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

        {/* 좌측 상단 사진 매수 배지 */}
        {count > 1 && (
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-black/65 px-2 py-0.5 text-[10.5px] font-extrabold text-white backdrop-blur-xs shadow-xs z-10">
            <span>📷</span>
            <span>
              {currentIdx + 1}/{count}장
            </span>
          </div>
        )}

        {/* 호버 시 썸네일 좌/우 넘기기 버튼 (사진 2장 이상일 때 노출) */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              title="이전 사진 미리보기"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm font-bold text-white opacity-0 group-hover:opacity-100 hover:bg-black/90 hover:scale-110 transition-all backdrop-blur-xs"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="다음 사진 미리보기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm font-bold text-white opacity-0 group-hover:opacity-100 hover:bg-black/90 hover:scale-110 transition-all backdrop-blur-xs"
            >
              ›
            </button>

            {/* 하단 점 인디케이터 */}
            <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {post.images.slice(0, 8).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    currentIdx === i ? 'w-4 bg-white shadow-xs' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
              {count > 8 && <span className="h-1.5 w-1.5 rounded-full bg-white/40" />}
            </div>
          </>
        )}

        {/* 우측 상단 더보기(⋯) 관리 버튼 */}
        {canManage && (
          <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu();
              }}
              title="더보기"
              className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-black backdrop-blur-xs transition-all ${
                isMenuOpen
                  ? 'bg-teal text-white shadow-md'
                  : 'bg-black/55 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80'
              }`}
            >
              ⋯
            </button>

            {/* 드롭다운 메뉴 팝오버 */}
            {isMenuOpen && (
              <div className="absolute right-0 top-8 z-30 w-28 overflow-hidden rounded-xl border border-border bg-panel shadow-xl animate-in fade-in zoom-in-95 duration-150 py-1 text-[11.5px] font-bold">
                <button
                  type="button"
                  onClick={onOpenEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-ink hover:bg-teal-soft/40 hover:text-teal transition-colors"
                >
                  <span>✏️</span>
                  <span>편집</span>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-danger/10 transition-colors border-t border-border/50"
                >
                  <span>🗑️</span>
                  <span>삭제</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 포스트 정보 (제목 / 내용 / 일자 및 수정됨 표시) */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <h3 className="text-[13px] font-bold text-ink group-hover:text-teal transition-colors line-clamp-1">
            {post.title}
          </h3>
          {post.description && (
            <p className="mt-1 text-[11px] text-ink3 line-clamp-2 leading-relaxed">
              {post.description}
            </p>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-border/50 pt-2 text-[10.5px] text-ink3 font-medium">
          <span className="flex items-center gap-1">
            <span className="font-semibold text-ink2">{post.authorName}</span>
            {post.authorDept && <span>· {post.authorDept}</span>}
          </span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-[10px] text-ink3">{post.createdAt}</span>
            {post.isEdited && (
              <span className="rounded bg-panel-alt px-1 py-0.2 text-[9px] font-bold text-amber border border-amber/20">
                수정됨
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

