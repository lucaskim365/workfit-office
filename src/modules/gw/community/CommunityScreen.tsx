import { useState, useMemo } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useCommunity } from '@/features/community/useCommunity';
import type { Club, JoinPolicy } from '@/domain/community/schema';

export default function CommunityScreen() {
  const { user } = useAuth();
  const {
    feeds,
    clubs,
    createFeed,
    addFeedComment,
    addFeedReply,
    deleteFeed,
    createClub,
    joinClub,
    leaveClub,
    addClubPost
  } = useCommunity();

  // 대분류 탭: 'feed' (자유게시판) | 'club' (소모임)
  const [activeTab, setActiveTab] = useState<'feed' | 'club'>('feed');

  // 로그인 사용자 세션 가공
  const CURRENT_USER = useMemo(() => {
    return {
      id: user?.id || 'guest',
      name: user?.name ? `${user.name}`.trim() : '게스트',
      dept: user?.dept || '-',
      position: user?.position || '',
      isAdmin: user?.roleGroup === 'ADMIN'
    };
  }, [user]);

  // 가입된 내 소모임 목록 필터링 (사이드바 숏컷용)
  const myClubs = useMemo(() => {
    return clubs.filter((c) => c.members.some((m) => m.userId === CURRENT_USER.id));
  }, [clubs, CURRENT_USER.id]);

  // 가입하지 않은 추천 소모임 목록 (우측 위젯용)
  const recommendedClubs = useMemo(() => {
    return clubs.filter((c) => !c.members.some((m) => m.userId === CURRENT_USER.id)).slice(0, 3);
  }, [clubs, CURRENT_USER.id]);

  // 자유게시판 상태
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [feedInput, setFeedInput] = useState('');
  const [isAnonymousPost, setIsAnonymousPost] = useState(false);

  // 모달 사진 첨부 및 해시태그 상태
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // 댓글/대댓글 관련 UI 상태
  const [commentInput, setCommentInput] = useState('');
  const [replyInput, setReplyInput] = useState('');
  const [openReplyCommentId, setOpenReplyCommentId] = useState<number | null>(null);

  // 소모임 상태
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [clubViewMode, setClubViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [clubTab, setClubTab] = useState<'intro' | 'post' | 'member'>('intro');
  
  // 소모임 개설 폼
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [newClubIcon, setNewClubIcon] = useState('⚽');
  const [newClubPolicy, setNewClubPolicy] = useState<JoinPolicy>('free');

  // 소모임 내부 게시글 작성 폼
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostWriteOpen, setIsPostWriteOpen] = useState(false);

  // 가입 대기 신청 상태 (런타임 임시 상태)
  const [joinRequests, setJoinRequests] = useState<Record<number, boolean>>({});

  // 선택된 피드 상세 데이터
  const selectedFeed = useMemo(() => {
    return feeds.find((f) => f.id === selectedFeedId) || null;
  }, [feeds, selectedFeedId]);

  const activeClub = useMemo(() => {
    return clubs.find((c) => c.id === selectedClubId) || null;
  }, [clubs, selectedClubId]);

  const isMyClub = useMemo(() => {
    if (!activeClub) return false;
    return activeClub.members.some((m) => m.userId === CURRENT_USER.id);
  }, [activeClub, CURRENT_USER.id]);

  const isClubOwner = useMemo(() => {
    if (!activeClub) return false;
    return activeClub.members.some((m) => m.userId === CURRENT_USER.id && m.role === 'owner');
  }, [activeClub, CURRENT_USER.id]);



  // 사진 다중 선택 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const urls = filesArray.map((file) => URL.createObjectURL(file));
      setAttachedImages((prev) => [...prev, ...urls]);
    }
  };

  // 첨부 사진 1개 삭제
  const removeAttachedImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 해시태그 추가 핸들러
  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      let inputVal = hashtagInput.trim();
      if (!inputVal) return;

      if (!inputVal.startsWith('#')) {
        inputVal = `#${inputVal}`;
      }

      if (!tags.includes(inputVal)) {
        setTags([...tags, inputVal]);
      }
      setHashtagInput('');
    }
  };

  // 해시태그 칩 1개 삭제
  const removeTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  // 1. 피드 글 등록 (모달 팝업에서 제출)
  const handleCreateFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedInput.trim()) return;

    createFeed({
      author: isAnonymousPost ? '익명' : `${CURRENT_USER.name} ${CURRENT_USER.position}`.trim(),
      authorId: CURRENT_USER.id,
      isAnonymous: isAnonymousPost,
      content: feedInput.trim(),
      attachments: attachedImages,
      tags: tags
    });

    setFeedInput('');
    setIsAnonymousPost(false);
    setAttachedImages([]);
    setTags([]);
    setHashtagInput('');
    setIsWriteModalOpen(false);
  };

  // 2. 피드 댓글 등록 (Drawer에서 등록)
  const handleAddFeedComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedFeedId) return;

    addFeedComment(selectedFeedId, {
      author: `${CURRENT_USER.name} ${CURRENT_USER.position}`.trim(),
      content: commentInput.trim()
    });

    setCommentInput('');
  };

  // 3. 피드 대댓글 등록 (Drawer에서 등록)
  const handleAddFeedReply = (commentId: number) => {
    if (!replyInput.trim() || !selectedFeedId) return;

    addFeedReply(selectedFeedId, commentId, {
      author: `${CURRENT_USER.name} ${CURRENT_USER.position}`.trim(),
      content: replyInput.trim()
    });

    setReplyInput('');
    setOpenReplyCommentId(null);
  };

  // 4. 피드 삭제
  const handleDeleteFeed = (id: number) => {
    if (confirm('게시글을 삭제하시겠습니까?')) {
      deleteFeed(id);
      if (selectedFeedId === id) setSelectedFeedId(null);
    }
  };

  // 5. 소모임 생성
  const handleCreateClub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName.trim() || !newClubDesc.trim()) return;

    createClub({
      name: `${newClubIcon} ${newClubName}`,
      desc: newClubDesc.trim(),
      icon: newClubIcon,
      joinPolicy: newClubPolicy,
      members: [
        {
          userId: CURRENT_USER.id,
          name: CURRENT_USER.name,
          dept: CURRENT_USER.dept,
          position: CURRENT_USER.position,
          role: 'owner'
        }
      ]
    });

    setClubViewMode('list');
    setNewClubName('');
    setNewClubDesc('');
    setNewClubIcon('⚽');
    setNewClubPolicy('free');
  };

  // 6. 소모임 가입 신청
  const handleJoinClub = (club: Club) => {
    if (club.joinPolicy === 'free') {
      joinClub(club.id, {
        userId: CURRENT_USER.id,
        name: CURRENT_USER.name,
        dept: CURRENT_USER.dept,
        position: CURRENT_USER.position,
        role: 'member'
      });
      alert(`${club.name} 소모임에 가입 완료되었습니다!`);
    } else if (club.joinPolicy === 'approval') {
      setJoinRequests((prev) => ({ ...prev, [club.id]: true }));
      alert('가입 신청이 완료되었습니다. 소모임 운영자의 승인을 기다려주세요.');
    } else {
      alert('이 소모임은 초대 전용 소모임입니다. 운영자의 초대가 필요합니다.');
    }
  };

  // 7. 소모임 탈퇴
  const handleLeaveClub = (clubId: number) => {
    if (isClubOwner) {
      alert('소모임의 운영자는 바로 탈퇴할 수 없습니다. 탈퇴 전 다른 멤버에게 운영자 권한을 위임하거나 소모임을 폐쇄하십시오.');
      return;
    }
    if (confirm('소모임에서 탈퇴하시겠습니까?')) {
      leaveClub(clubId, CURRENT_USER.id);
      setClubViewMode('list');
      setSelectedClubId(null);
    }
  };

  // 8. 소모임 게시글 작성 (일반 1열 피드 뷰)
  const handleCreateClubPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !selectedClubId) return;

    addClubPost(selectedClubId, {
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      author: `${CURRENT_USER.name} ${CURRENT_USER.position}`.trim(),
      authorId: CURRENT_USER.id
    });

    setNewPostTitle('');
    setNewPostContent('');
    setIsPostWriteOpen(false);
  };

  return (
    <div className="flex h-full w-full gap-5 bg-panel p-6 text-[12.5px] text-ink relative overflow-hidden">
      
      {/* ── 좌측 네비게이션 사이드바 ── */}
      <aside className="w-[200px] shrink-0 flex flex-col gap-5 rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="space-y-5">
          {/* 타이틀 */}
          <div>
            <h2 className="text-sm font-extrabold text-navy flex items-center gap-1.5">
              <span>☘️</span>
              <span>커뮤니티</span>
            </h2>
          </div>

          {/* 탭 네비게이션 */}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setActiveTab('feed');
                setSelectedClubId(null);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${
                activeTab === 'feed'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span>💬</span>
              <span>자유게시판</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('club');
                setClubViewMode('list');
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-bold transition-all ${
                activeTab === 'club' && !selectedClubId
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span>👥</span>
              <span>소모임 탐색</span>
            </button>
          </nav>

          {/* 내 소모임 리스트 */}
          {myClubs.length > 0 && (
            <div className="space-y-1.5 pt-3 border-t border-border">
              <div className="px-2 text-[10px] font-bold tracking-wider text-ink3 uppercase">내 소모임</div>
              <div className="flex flex-col gap-0.5">
                {myClubs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClubId(c.id);
                      setClubViewMode('detail');
                      setClubTab('post');
                      setActiveTab('club');
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left font-semibold transition-colors ${
                      selectedClubId === c.id && activeTab === 'club'
                        ? 'bg-teal-soft/40 text-teal'
                        : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span className="truncate flex-1">{c.name.replace(/[^가-힣a-zA-Z0-9\s]/g, '').trim()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── 메인 콘텐츠 영역 ── */}
      <main className="flex-1 flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 shadow-sm overflow-hidden">
        
        {/* ==================== A. 자유게시판 (3단 Masonry & 인스타 스타일) ==================== */}
        {activeTab === 'feed' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 overflow-hidden">
            
            {/* 중앙 피드 영역 */}
            <div className="flex flex-col gap-4 overflow-hidden">
              {/* 상단 액션바 */}
              <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
                <div>
                  <h1 className="text-base font-extrabold text-ink">자유게시판</h1>
                  <p className="text-[11px] text-ink3 mt-0.5">인스타그램/핀터레스트처럼 동료들의 일상을 한눈에 즐겨보세요.</p>
                </div>
                <button
                  onClick={() => setIsWriteModalOpen(true)}
                  className="rounded-lg bg-teal px-4 py-2 font-bold text-white shadow-xs hover:opacity-90 transition-opacity text-[11.5px]"
                >
                  ＋ 글쓰기
                </button>
              </div>

              {/* Masonry 카드 피드 리스트 */}
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="columns-1 sm:columns-2 xl:columns-3 gap-4.5 space-y-4.5 [column-fill:_balance] w-full">
                  {feeds.map((f) => {
                    const hasPhotos = f.attachments && f.attachments.length > 0;
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFeedId(f.id)}
                        className="break-inside-avoid mb-4.5 rounded-2xl border border-border bg-panel overflow-hidden shadow-xs hover:shadow-md cursor-pointer transition-all hover:border-teal/30 flex flex-col"
                      >
                        {/* 1. 카드 헤더 (인스타 스타일) */}
                        <div className="p-3.5 flex items-center justify-between border-b border-border/20">
                          <div className="flex items-center gap-2">
                            <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                              f.isAnonymous ? 'bg-panel-alt border-border text-ink3' : 'bg-teal-soft/40 border-teal/20 text-teal'
                            }`}>
                              {f.isAnonymous ? '🔒' : f.author[0]}
                            </span>
                            <div>
                              <div className="font-extrabold text-ink leading-tight text-[11.5px]">{f.author}</div>
                              <div className="text-[9px] text-ink3 mt-0.5 font-mono">{f.date.split(' ')[1] || f.date}</div>
                            </div>
                          </div>
                          <span className="text-ink3 hover:text-ink text-xs font-bold">···</span>
                        </div>

                        {/* 2. 카드 미디어 영역 (첨부 사진) */}
                        {hasPhotos && (
                          <div className="relative aspect-video w-full overflow-hidden bg-panel-alt flex items-center justify-center">
                            <img
                              src={f.attachments?.[0]}
                              alt="첨부이미지"
                              className="w-full h-full object-cover"
                            />
                            {f.attachments && f.attachments.length > 1 && (
                              <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[9px] text-white font-bold tracking-wider">
                                📷 1/{f.attachments.length}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 3. 카드 본문 및 해시태그 */}
                        <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <p className="text-[12px] text-ink leading-relaxed whitespace-pre-wrap line-clamp-3">
                              {f.content}
                            </p>
                            {f.tags && f.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {f.tags.map((t, idx) => (
                                  <span key={idx} className="text-[10px] text-teal font-extrabold bg-teal-soft/20 px-1.5 py-0.5 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="border-t border-border/40 pt-3 flex items-center justify-between text-[11.5px]">
                            <div className="flex items-center gap-2">
                              <span className="text-teal font-extrabold">💬 댓글 {f.comments.length}</span>
                            </div>

                            {(f.authorId === CURRENT_USER.id || CURRENT_USER.isAdmin) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFeed(f.id);
                                }}
                                className="text-[10.5px] text-ink3 hover:text-danger hover:underline font-bold"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 우측 3단 위젯 사이드바 (자유게시판 전용 복원) */}
            <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto w-[260px] shrink-0 border-l border-border pl-4.5 pt-1">
              
              {/* 추천 소모임 카드 */}
              {recommendedClubs.length > 0 && (
                <div className="rounded-xl border border-border bg-panel p-4 space-y-3.5 shadow-xs">
                  <h3 className="font-extrabold text-ink2 text-xs flex items-center gap-1.5">
                    <span>💡</span>
                    <span>이런 소모임은 어때요?</span>
                  </h3>
                  <div className="divide-y divide-border">
                    {recommendedClubs.map((c) => {
                      const waiting = joinRequests[c.id];
                      return (
                        <div key={c.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-ink truncate text-[11.5px]">{c.name}</h4>
                            <p className="text-[10px] text-ink3 mt-0.5">멤버 {c.memberCount}명</p>
                          </div>
                          
                          {waiting ? (
                            <span className="text-[10px] font-bold text-amber bg-amber-soft/40 px-2 py-0.5 rounded-md">
                              대기
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoinClub(c)}
                              className="text-[10.5px] font-bold text-teal bg-teal-soft/40 hover:bg-teal-soft/60 px-2 py-0.5 rounded-md transition-colors"
                            >
                              가입
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 커뮤니티 이용 안내 */}
              <div className="rounded-xl border border-dashed border-border bg-panel-alt/10 p-4 leading-relaxed text-[11px] text-ink3">
                ☕ 커뮤니티는 전사 공식 공지나 규정이 오가는 게시판과 격리된 <strong>직원 자발적 자유 소통 구역</strong>입니다. 업무 밖의 기쁜 소식, 일상 대화, 취미 활동을 부담 없이 나눠주세요.
              </div>

            </aside>

          </div>
        )}

        {/* ==================== B. 소모임 ==================== */}
        {activeTab === 'club' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            
            {/* B-1) 소모임 탐색 목록 */}
            {clubViewMode === 'list' && (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
                  <div>
                    <h1 className="text-base font-extrabold text-ink">소모임 탐색</h1>
                    <p className="text-[11px] text-ink3 mt-0.5">사내 개설된 다양한 취미 및 관심사 모임을 탐색하고 교류하세요.</p>
                  </div>
                  <button
                    onClick={() => setClubViewMode('create')}
                    className="rounded-lg bg-teal px-4 py-2 font-bold text-white shadow-xs hover:opacity-90 transition-opacity text-[11.5px]"
                  >
                    ＋ 소모임 만들기
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
                  {clubs.map((c) => {
                    const myJoined = c.members.some((m) => m.userId === CURRENT_USER.id);
                    const waiting = joinRequests[c.id];
                    return (
                      <div key={c.id} className="rounded-xl border border-border bg-panel p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-teal/30 transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10.5px]">
                            <span className="px-2 py-0.5 rounded bg-panel-alt border font-bold text-ink2">
                              {c.joinPolicy === 'free' ? '🔓 자유가입' : c.joinPolicy === 'approval' ? '⏳ 운영자승인' : '🔒 초대 전용'}
                            </span>
                            <span className="text-teal font-extrabold">멤버 {c.memberCount}명</span>
                          </div>
                          <h3 className="text-sm font-extrabold text-ink">{c.name}</h3>
                          <p className="text-[11.5px] text-ink2 line-clamp-2 leading-relaxed">{c.desc}</p>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              setSelectedClubId(c.id);
                              setClubViewMode('detail');
                              setClubTab('intro');
                            }}
                            className="flex-1 rounded-lg border border-border-hi bg-panel py-2 text-center font-bold text-ink2 hover:bg-panel-alt transition-colors"
                          >
                            입장하기
                          </button>
                          {myJoined ? (
                            <span className="flex-1 rounded-lg bg-teal-soft/40 border border-teal/20 py-2 text-center font-bold text-teal">
                              가입됨
                            </span>
                          ) : waiting ? (
                            <span className="flex-1 rounded-lg bg-amber-soft border border-amber/20 py-2 text-center font-bold text-amber">
                              승인 대기
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoinClub(c)}
                              className="flex-1 rounded-lg bg-teal py-2 text-center font-bold text-white hover:opacity-90 transition-opacity"
                            >
                              가입 신청
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* B-2) 소모임 만들기 개설 */}
            {clubViewMode === 'create' && (
              <form onSubmit={handleCreateClub} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setClubViewMode('list')}
                    className="text-ink2 hover:text-ink font-semibold flex items-center gap-1"
                  >
                    <span>←</span> <span>취소</span>
                  </button>
                  <span className="font-extrabold text-teal">➕ 소모임 개설</span>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-ink2">대표 아이콘</label>
                    <select
                      value={newClubIcon}
                      onChange={(e) => setNewClubIcon(e.target.value)}
                      className="h-9.5 w-24 rounded-lg border border-border-hi bg-panel px-2 outline-none focus:border-teal"
                    >
                      <option value="⚽">⚽ 축구/풋살</option>
                      <option value="🎮">🎮 게임/e스포츠</option>
                      <option value="📚">📚 독서/토론</option>
                      <option value="🎸">🎸 음악/밴드</option>
                      <option value="🏃">🏃 운동/러닝</option>
                      <option value="💻">💻 개발/스터디</option>
                      <option value="⭐">⭐ 기타</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-ink2">소모임 이름</label>
                    <input
                      type="text"
                      value={newClubName}
                      onChange={(e) => setNewClubName(e.target.value)}
                      placeholder="이름을 입력하세요"
                      required
                      className="h-9.5 w-full max-w-md rounded-lg border border-border-hi bg-panel px-3.5 outline-none focus:border-teal"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-ink2">소모임 소개</label>
                    <textarea
                      value={newClubDesc}
                      onChange={(e) => setNewClubDesc(e.target.value)}
                      placeholder="소모임 활동 목적 및 주요 내용을 설명해 주세요."
                      required
                      rows={5}
                      className="w-full rounded-lg border border-border-hi bg-panel p-3.5 outline-none focus:border-teal resize-y leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-ink2">가입 방식 설정</label>
                    <select
                      value={newClubPolicy}
                      onChange={(e) => setNewClubPolicy(e.target.value as JoinPolicy)}
                      className="h-9.5 w-full max-w-xs rounded-lg border border-border-hi bg-panel px-2 outline-none focus:border-teal"
                    >
                      <option value="free">🔓 자유가입 (신청 시 즉시 가입)</option>
                      <option value="approval">⏳ 운영자 승인 (가입 신청 후 승인 필요)</option>
                      <option value="invite">🔒 초대 전용 (운영자 초대 인원만)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-border pt-3.5 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setClubViewMode('list')}
                    className="rounded-lg border border-border-hi bg-panel px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90"
                  >
                    소모임 만들기
                  </button>
                </div>
              </form>
            )}

            {/* B-3) 소모임 상세 공간 (프라이빗 룸) */}
            {clubViewMode === 'detail' && activeClub && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 상단 액션 바 */}
                <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
                  <button
                    onClick={() => setClubViewMode('list')}
                    className="flex items-center gap-1 text-teal font-bold hover:underline"
                  >
                    <span>←</span> <span>소모임 목록으로</span>
                  </button>
                  <div className="flex items-center gap-2">
                    {isMyClub && (
                      <button
                        onClick={() => handleLeaveClub(activeClub.id)}
                        className="rounded-lg border border-red-200 text-red px-3 py-1.5 text-[11px] font-bold bg-red-soft/20 hover:bg-red-soft/40 transition-colors"
                      >
                        탈퇴하기
                      </button>
                    )}
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-panel-alt border text-ink2">
                      {activeClub.joinPolicy === 'free' ? '자유가입' : activeClub.joinPolicy === 'approval' ? '운영자승인' : '초대전용'}
                    </span>
                  </div>
                </div>

                {/* 소모임 소개 요약 */}
                <div className="py-3 shrink-0">
                  <h2 className="text-base font-extrabold text-ink">{activeClub.name}</h2>
                  <p className="mt-1 text-[11.5px] text-ink3">{activeClub.desc}</p>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex border-b border-border shrink-0">
                  <button
                    onClick={() => setClubTab('intro')}
                    className={`px-4 py-2 font-bold transition-colors ${
                      clubTab === 'intro' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    홈 (소개)
                  </button>
                  <button
                    onClick={() => setClubTab('post')}
                    className={`px-4 py-2 font-bold transition-colors ${
                      clubTab === 'post' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    게시글 ({activeClub.posts.length})
                  </button>
                  <button
                    onClick={() => setClubTab('member')}
                    className={`px-4 py-2 font-bold transition-colors ${
                      clubTab === 'member' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                    }`}
                  >
                    멤버 ({activeClub.memberCount})
                  </button>
                </div>

                {/* 탭 본문 영역 */}
                <div className="flex-1 overflow-y-auto py-4 pr-1">
                  {/* [홈/소개 탭] */}
                  {clubTab === 'intro' && (
                    <div className="space-y-4 max-w-xl">
                      <div className="bg-panel-alt/10 border border-border/40 rounded-xl p-5 space-y-3">
                        <h4 className="font-extrabold text-ink text-xs">📋 소모임 목적 및 가이드</h4>
                        <p className="text-[12px] leading-relaxed text-ink2 whitespace-pre-wrap">{activeClub.desc}</p>
                      </div>
                      <div className="text-[11px] text-ink3 pl-1 flex gap-4">
                        <span>개설 운영자: <strong className="text-ink2">{activeClub.members.find(m => m.role === 'owner')?.name || '관리자'}</strong></span>
                        <span>현재 멤버: {activeClub.memberCount}명</span>
                      </div>
                    </div>
                  )}

                  {/* [게시글 탭 - 1열 일반 타임라인 피드 형태] */}
                  {clubTab === 'post' && (
                    <div className="max-w-xl space-y-4">
                      {isMyClub ? (
                        <>
                          {/* 새 글 작성 토글 */}
                          {!isPostWriteOpen ? (
                            <button
                              onClick={() => setIsPostWriteOpen(true)}
                              className="w-full rounded-xl border border-dashed border-teal/40 bg-teal-soft/10 text-teal font-bold py-3 text-center hover:bg-teal-soft/20 transition-colors"
                            >
                              ✍️ 소모임 활동 소식 올리기
                            </button>
                          ) : (
                            <form onSubmit={handleCreateClubPost} className="rounded-xl border border-border p-4 bg-panel-alt/25 space-y-3">
                              <div className="flex justify-between items-center shrink-0">
                                <span className="font-bold text-ink2 text-xs">새 게시글 작성</span>
                                <button
                                  type="button"
                                  onClick={() => setIsPostWriteOpen(false)}
                                  className="text-[11px] text-ink3 hover:text-ink font-semibold"
                                >
                                  취소
                                </button>
                              </div>
                              <input
                                type="text"
                                value={newPostTitle}
                                onChange={(e) => setNewPostTitle(e.target.value)}
                                placeholder="제목을 적어주세요"
                                required
                                className="h-9 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[11.5px]"
                              />
                              <textarea
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                                placeholder="내용을 적어주세요."
                                required
                                rows={4}
                                className="w-full rounded-lg border border-border bg-panel p-3 outline-none focus:border-teal resize-y leading-relaxed text-[11.5px]"
                              />
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setIsPostWriteOpen(false)}
                                  className="rounded-lg border px-3 py-1.5 text-[11px] font-bold hover:bg-panel"
                                >
                                  취소
                                </button>
                                <button
                                  type="submit"
                                  className="rounded-lg bg-teal text-white px-4 py-1.5 text-[11px] font-bold hover:opacity-90"
                                >
                                  등록
                                </button>
                              </div>
                            </form>
                          )}

                          {/* 1열 게시글 목록 */}
                          <div className="space-y-3">
                            {activeClub.posts.length > 0 ? (
                              activeClub.posts.map((p) => (
                                <div key={p.id} className="rounded-xl border border-border bg-panel p-4.5 space-y-2.5 shadow-xs">
                                  <div className="flex items-center justify-between text-[11px] text-ink3">
                                    <span className="font-bold text-ink2">{p.author}</span>
                                    <span className="font-mono">{p.date}</span>
                                  </div>
                                  <h4 className="font-extrabold text-ink text-sm leading-snug">{p.title}</h4>
                                  <p className="text-[12px] text-ink2 leading-relaxed whitespace-pre-wrap">{p.content}</p>
                                </div>
                              ))
                            ) : (
                              <div className="py-12 border border-dashed rounded-xl text-center text-ink3">아직 등록된 활동 소식이 없습니다.</div>
                            )}
                          </div>
                        </>
                      ) : (
                        // 비회원용 안내 카드
                        <div className="py-10 text-center border border-dashed rounded-xl bg-panel-alt/10 p-5 space-y-3">
                          <p className="text-ink3 text-[12.5px]">🔒 소모임 멤버에게만 활동글 공간이 제공됩니다.</p>
                          <button
                            onClick={() => handleJoinClub(activeClub)}
                            className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90 text-[11.5px]"
                          >
                            소모임 가입하고 같이 소통하기
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* [멤버 탭] */}
                  {clubTab === 'member' && (
                    <div className="max-w-md border border-border rounded-xl bg-panel overflow-hidden">
                      <div className="divide-y divide-border">
                        {activeClub.members.map((m) => (
                          <div key={m.userId} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-2">
                              <span className="grid h-7 w-7 place-items-center rounded bg-teal-soft/40 text-xs">👤</span>
                              <div>
                                <span className="font-bold text-ink">{m.name}</span>
                                <span className="text-[10px] text-ink3 ml-2">{m.dept} · {m.position}</span>
                              </div>
                            </div>
                            {m.role === 'owner' && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber/30 text-amber bg-amber-soft/20">
                                운영자
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
          </div>
        )}

      </main>

      {/* ==================== C. 글쓰기 모달 (Modal) ==================== */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-panel border border-border w-[480px] max-h-[85vh] rounded-xl p-5 shadow-2xl flex flex-col gap-4 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-2 shrink-0">
              <span className="font-extrabold text-navy text-[13px]">📝 새 글 작성</span>
              <button
                onClick={() => {
                  setIsWriteModalOpen(false);
                  setAttachedImages([]);
                  setTags([]);
                }}
                className="text-ink3 hover:text-ink font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFeed} className="space-y-4">
              {/* 실명/익명 옵션 */}
              <div className="flex gap-4 text-ink2 font-semibold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="author_mode"
                    checked={!isAnonymousPost}
                    onChange={() => setIsAnonymousPost(false)}
                    className="h-4 w-4"
                  />
                  <span>👤 실명으로 쓰기</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="author_mode"
                    checked={isAnonymousPost}
                    onChange={() => setIsAnonymousPost(true)}
                    className="h-4 w-4"
                  />
                  <span>🔒 익명으로 쓰기</span>
                </label>
              </div>

              {/* 본문 에어리어 */}
              <textarea
                value={feedInput}
                onChange={(e) => setFeedInput(e.target.value)}
                placeholder="어떤 가벼운 소식을 공유하고 싶으신가요?"
                required
                rows={4}
                className="w-full rounded-lg border border-border bg-panel p-3.5 outline-none focus:border-teal resize-none leading-relaxed text-[12px]"
              />

              {/* 1. 사진 다중 첨부 피처 */}
              <div className="space-y-2">
                <label className="font-bold text-ink2 block">📎 사진 첨부 (여러 장 가능)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-xs text-ink3 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-semibold file:bg-panel-alt hover:file:bg-border-hi cursor-pointer"
                />
                
                {/* 사진 썸네일 리스트 */}
                {attachedImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-1.5 border border-dashed rounded-lg bg-panel-alt/10 p-2">
                    {attachedImages.map((url, index) => (
                      <div key={index} className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden border border-border">
                        <img src={url} alt="미리보기" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeAttachedImage(index)}
                          className="absolute top-0 right-0 h-4 w-4 bg-black/60 text-white rounded-bl text-[9px] font-bold flex items-center justify-center hover:bg-black"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. 해시태그 추가 피처 */}
              <div className="space-y-2">
                <label className="font-bold text-ink2 block">🏷️ 해시태그 설정</label>
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyDown}
                  placeholder="태그 입력 후 Enter 또는 Space"
                  className="h-8.5 w-full rounded-lg border border-border bg-panel px-3 text-[11px] outline-none focus:border-teal"
                />
                {/* 추가된 태그 칩 리스트 */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t, index) => (
                      <span key={index} className="flex items-center gap-1 text-[10px] text-teal font-extrabold bg-teal-soft/30 px-2 py-0.5 rounded-full">
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="hover:text-ink text-[8px] font-bold ml-0.5"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsWriteModalOpen(false);
                    setAttachedImages([]);
                    setTags([]);
                  }}
                  className="rounded-lg border px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal text-white px-5 py-2 font-bold hover:opacity-90"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== D. 게시글 우측 상세 Drawer ==================== */}
      {selectedFeedId && selectedFeed && (
        <>
          {/* 어두운 백드롭 백경 */}
          <div
            onClick={() => setSelectedFeedId(null)}
            className="fixed inset-0 bg-black/25 z-40"
          />

          {/* 서랍식 슬라이딩 Drawer */}
          <div className="fixed right-0 top-0 h-full w-[450px] shadow-2xl z-50 bg-panel border-l border-border flex flex-col justify-between transition-transform duration-300 transform translate-x-0">
            {/* Drawer 헤더 */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] ${
                  selectedFeed.isAnonymous ? 'bg-panel-alt border-border text-ink3' : 'bg-teal-soft/40 border-teal/20 text-teal'
                }`}>
                  {selectedFeed.isAnonymous ? '🔒' : selectedFeed.author[0]}
                </span>
                <div>
                  <div className="font-extrabold text-ink2">{selectedFeed.author}</div>
                  <div className="text-[9px] text-ink3 font-mono mt-0.5">{selectedFeed.date}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedId(null)}
                className="text-ink3 hover:text-ink font-bold text-sm px-2.5 py-1 rounded hover:bg-panel-alt"
              >
                ✕
              </button>
            </div>

            {/* Drawer 본문 및 댓글 스레드 (스크롤 영역) */}
            <div className="flex-1 overflow-y-auto p-4.5 space-y-4">
              
              {/* 첨부된 사진 여러 장 가로 슬라이더로 렌더링 (인스타 스타일) */}
              {selectedFeed.attachments && selectedFeed.attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin select-none m-0.5 pb-2 border-b border-border/20">
                  {selectedFeed.attachments.map((url, idx) => (
                    <div key={idx} className="relative h-44 w-64 shrink-0 rounded-xl overflow-hidden border border-border bg-panel-alt">
                      <img src={url} alt="슬라이더 사진" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[9px] text-white font-bold">
                        {idx + 1}/{selectedFeed.attachments?.length}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 피드 게시글 본문 */}
              <p className="text-[12.5px] text-ink leading-relaxed whitespace-pre-wrap pl-1">{selectedFeed.content}</p>

              {/* 피드 등록 해시태그 */}
              {selectedFeed.tags && selectedFeed.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {selectedFeed.tags.map((t, idx) => (
                    <span key={idx} className="text-[10px] text-teal font-extrabold bg-teal-soft/20 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 구분선 */}
              <div className="border-t border-border/60 pt-3">
                <h4 className="font-bold text-ink2 text-[11.5px]">댓글 ({selectedFeed.comments.length})</h4>
              </div>

              {/* 댓글 목록 */}
              <div className="space-y-3.5 pb-5">
                {selectedFeed.comments.length > 0 ? (
                  selectedFeed.comments.map((c) => (
                    <div key={c.id} className="space-y-1.5 text-[11.5px]">
                      <div className="bg-panel border border-border/40 rounded-lg p-2.5 flex flex-col gap-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <strong className="text-ink2">{c.author}</strong>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-ink3 font-mono">{c.date}</span>
                            <button
                              onClick={() => setOpenReplyCommentId(openReplyCommentId === c.id ? null : c.id)}
                              className="text-[10px] text-teal font-extrabold hover:underline"
                            >
                              답글
                            </button>
                          </div>
                        </div>
                        <p className="text-ink leading-relaxed">{c.content}</p>
                      </div>

                      {/* 대댓글 리스트 */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="pl-5 space-y-1.5">
                          {c.replies.map((r) => (
                            <div key={r.id} className="bg-panel-alt/40 border border-border/20 rounded-lg p-2.5 flex items-start gap-2">
                              <span className="text-teal/60 font-bold text-[10px]">└</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <strong className="text-ink2">{r.author}</strong>
                                  <span className="text-[9px] text-ink3 font-mono">{r.date}</span>
                                </div>
                                <p className="mt-0.5 text-ink leading-relaxed">{r.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 대댓글 등록 폼 */}
                      {openReplyCommentId === c.id && (
                        <div className="pl-5 flex gap-1.5 pt-1.5">
                          <input
                            type="text"
                            value={replyInput}
                            onChange={(e) => setReplyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddFeedReply(c.id);
                            }}
                            placeholder="답글을 입력하세요"
                            className="flex-1 h-8 rounded-lg border border-border bg-panel px-3 text-[11px] outline-none focus:border-teal"
                          />
                          <button
                            onClick={() => handleAddFeedReply(c.id)}
                            className="rounded-lg bg-teal px-3 text-[11px] font-bold text-white hover:opacity-90"
                          >
                            등록
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-ink3 text-[11px]">아직 댓글이 없습니다. 첫 의견을 남겨보세요!</div>
                )}
              </div>
            </div>

            {/* Drawer 댓글 기입 푸터 (고정 하단) */}
            <form onSubmit={handleAddFeedComment} className="p-3 border-t border-border bg-panel shrink-0 flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="댓글을 남겨보세요"
                required
                className="flex-1 h-9 rounded-lg border border-border bg-panel px-3.5 text-[11.5px] outline-none focus:border-teal"
              />
              <button
                type="submit"
                className="rounded-lg bg-teal px-4 text-[11.5px] font-bold text-white hover:opacity-90"
              >
                등록
              </button>
            </form>
          </div>
        </>
      )}

    </div>
  );
}
