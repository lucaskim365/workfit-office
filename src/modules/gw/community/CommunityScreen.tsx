import { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useCommunity } from '@/features/community/useCommunity';
import type { Club, JoinPolicy } from '@/domain/community/schema';

export default function CommunityScreen() {
  const { user } = useAuth();
  const {
    clubs,
    createClub,
    joinClub,
    leaveClub,
    addClubPost,
    addClubEvent,
    voteClubEvent,
    addClubGreeting
  } = useCommunity();

  // 소모임 탐색 스크롤 참조 ref
  const exploreSectionRef = useRef<HTMLDivElement>(null);

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

  // 내가 가입한 소모임 목록
  const myClubs = useMemo(() => {
    return clubs.filter((c) => c.members.some((m) => m.userId === CURRENT_USER.id));
  }, [clubs, CURRENT_USER.id]);

  // 가입하지 않은 추천 소모임 목록
  const recommendedClubs = useMemo(() => {
    return clubs.filter((c) => !c.members.some((m) => m.userId === CURRENT_USER.id)).slice(0, 3);
  }, [clubs, CURRENT_USER.id]);

  // 가입한 소모임들의 모든 게시글을 하나로 모은 통합 피드 목록
  const combinedPosts = useMemo(() => {
    const allPosts: { clubId: number; clubName: string; clubIcon: string; post: any }[] = [];
    myClubs.forEach((c) => {
      c.posts.forEach((p) => {
        allPosts.push({
          clubId: c.id,
          clubName: c.name,
          clubIcon: c.icon,
          post: p
        });
      });
    });
    // 최신 등록 순 정렬
    return allPosts.sort((a, b) => b.post.id - a.post.id);
  }, [myClubs]);

  // 소모임 상태
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [clubViewMode, setClubViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [isNoticeOpen, setIsNoticeOpen] = useState(true);
  const [clubTab, setClubTab] = useState<'post' | 'event' | 'member'>('post');
  
  // 소모임 개설 폼
  const [newClubName, setNewClubName] = useState('');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [newClubIcon, setNewClubIcon] = useState('⚽');
  const [newClubPolicy, setNewClubPolicy] = useState<JoinPolicy>('free');
  const [newClubCoverImage, setNewClubCoverImage] = useState<string>('');
  const [newClubTags, setNewClubTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // 소모임 관심사 가로 퀵 필터 칩 (소모임 앱 UI 적용)
  const [selectedInterest, setSelectedInterest] = useState<string>('전체');

  // 소모임 검색 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 소모임 내부 게시글 작성 폼
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isPostWriteOpen, setIsPostWriteOpen] = useState(false);

  // 소모임 신규 일정 등록 폼
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [isEventWriteOpen, setIsEventWriteOpen] = useState(false);

  // 방명록 / 가입인사 입력 폼
  const [greetingInput, setGreetingInput] = useState('');

  // 운영자(Owner) 관리 모달 상태
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editClubDesc, setEditClubDesc] = useState('');

  // 가입 대기 신청 상태 (임시 보관)
  const [joinRequests, setJoinRequests] = useState<Record<number, boolean>>({});

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

  // 검색 및 관심사 퀵 필터에 따른 소모임 검색
  const filteredClubs = useMemo(() => {
    let result = clubs;

    // 1. 관심사 퀵 필터링
    if (selectedInterest !== '전체') {
      const keyword = selectedInterest.split(' ')[1];
      result = result.filter(c => c.name.includes(keyword) || c.desc.includes(keyword) || c.icon === selectedInterest.split(' ')[0]);
    }

    // 2. 검색어 필터링
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = c.desc.toLowerCase().includes(q);
        const matchesTag = c.tags?.some((t) => t.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesTag;
      });
    }

    return result;
  }, [clubs, selectedInterest, searchQuery]);

  // 커버 이미지 첨부 핸들러
  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewClubCoverImage(URL.createObjectURL(file));
    }
  };

  // 소모임 태그 추가 키 핸들러
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      let val = tagInput.trim();
      if (!val) return;
      if (!val.startsWith('#')) val = `#${val}`;
      if (!newClubTags.includes(val)) {
        setNewClubTags([...newClubTags, val]);
      }
      setTagInput('');
    }
  };

  // 소모임 태그 제거
  const removeNewClubTag = (idx: number) => {
    setNewClubTags(newClubTags.filter((_, i) => i !== idx));
  };

  // 소모임 생성
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
      ],
      coverImage: newClubCoverImage || undefined,
      tags: newClubTags
    });

    setClubViewMode('list');
    setSelectedClubId(null);
    setNewClubName('');
    setNewClubDesc('');
    setNewClubIcon('⚽');
    setNewClubPolicy('free');
    setNewClubCoverImage('');
    setNewClubTags([]);
    setTagInput('');
  };

  // 소모임 가입 신청
  const handleJoinClub = (club: Club) => {
    if (club.joinPolicy === 'free') {
      joinClub(club.id, {
        userId: CURRENT_USER.id,
        name: CURRENT_USER.name,
        dept: CURRENT_USER.dept,
        position: CURRENT_USER.position,
        role: 'member'
      });
      alert(`[${club.name}] 소모임에 가입되었습니다!`);
    } else if (club.joinPolicy === 'approval') {
      setJoinRequests((prev) => ({ ...prev, [club.id]: true }));
      alert('가입 신청이 접수되었습니다. 운영자 승인 후 활동하실 수 있습니다.');
    } else {
      alert('이 소모임은 초대 전용입니다. 운영자의 초대가 필요합니다.');
    }
  };

  // 소모임 탈퇴
  const handleLeaveClub = (clubId: number) => {
    if (isClubOwner) {
      alert('운영자는 탈퇴할 수 없습니다. 탈퇴 전 다른 멤버에게 권한을 위임하거나 폐쇄해 주세요.');
      return;
    }
    if (confirm('소모임에서 탈퇴하시겠습니까?')) {
      leaveClub(clubId, CURRENT_USER.id);
      setClubViewMode('list');
      setSelectedClubId(null);
    }
  };

  // 소모임 게시글 작성
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

  // 소모임 새 일정 등록
  const handleCreateClubEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !selectedClubId) return;

    addClubEvent(selectedClubId, {
      title: eventTitle.trim(),
      date: eventDate,
      location: eventLocation.trim(),
      desc: eventDesc.trim(),
      creator: `${CURRENT_USER.name} ${CURRENT_USER.position}`.trim()
    });

    setEventTitle('');
    setEventDate('');
    setEventLocation('');
    setEventDesc('');
    setIsEventWriteOpen(false);
  };

  // 날짜 변환 헬퍼 (ISO 규격 포맷을 한글 다이어리형으로 전환)
  const formatEventDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const cleaned = dateStr.replace(' ', 'T');
      const date = new Date(cleaned);
      if (isNaN(date.getTime())) return dateStr;
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = dayNames[date.getDay()];
      return `${month}/${day} (${dayName}) ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  // 소모임 모의 관리 액션
  const handleSaveClubDesc = () => {
    if (!activeClub) return;
    activeClub.desc = editClubDesc;
    alert('소모임 소개글이 수정되었습니다.');
    setIsAdminModalOpen(false);
  };

  const handleCloseClub = () => {
    if (!activeClub) return;
    if (confirm(`진짜로 [${activeClub.name}] 소모임을 영구 폐쇄하시겠습니까?`)) {
      alert('소모임이 정상적으로 폐쇄되었습니다.');
      setIsAdminModalOpen(false);
      setSelectedClubId(null);
      setClubViewMode('list');
    }
  };

  return (
    <div className="flex h-full w-full gap-5 bg-panel p-6 text-[12.5px] text-ink relative overflow-hidden">
      
      {/* ── 좌측 네비게이션 사이드바 ── */}
      <aside className="w-[230px] shrink-0 flex flex-col gap-5 rounded-xl border border-border bg-panel p-4.5 shadow-sm">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-extrabold text-navy flex items-center gap-1.5">
              <span>☘️</span>
              <span>사내 커뮤니티</span>
            </h2>
          </div>

          <nav className="flex flex-col gap-1">
            <button
              onClick={() => {
                setSelectedClubId(null);
                setClubViewMode('list');
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left font-bold transition-all ${
                !selectedClubId && clubViewMode !== 'create'
                  ? 'bg-teal text-white shadow-xs'
                  : 'text-ink2 hover:bg-panel-alt hover:text-ink'
              }`}
            >
              <span>🏠</span>
              <span>커뮤니티 홈</span>
            </button>
          </nav>

          {/* 가입된 소모임 리스트 - 둥근 원형 아이콘(프로필 형태) 탑재 */}
          <div className="space-y-2 pt-3.5 border-t border-border">
            <div className="px-2 text-[10px] font-bold tracking-wider text-ink3 uppercase">가입한 소모임 ({myClubs.length})</div>
            <div className="flex flex-col gap-1">
              {myClubs.map((c) => {
                const cleanName = c.name.replace(/^[^\s]+\s+/, '');
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClubId(c.id);
                      setClubViewMode('detail');
                      setClubTab('post');
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left font-bold transition-all ${
                      selectedClubId === c.id && clubViewMode === 'detail'
                        ? 'bg-teal-soft/40 text-teal shadow-2xs'
                        : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                    }`}
                  >
                    {/* 원형 아이콘 프레임 */}
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-soft/50 text-base shadow-2xs border border-teal/10 shrink-0 select-none">
                      {c.icon}
                    </span>
                    <span className="truncate flex-1 text-[11.5px]">{cleanName}</span>
                  </button>
                );
              })}
              {myClubs.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-ink3 italic">가입된 모임이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── 우측 메인 콘텐츠 영역 ── */}
      <main className="flex-1 flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 shadow-sm overflow-hidden">
        
        {/* ==================== 1. 커뮤니티 통합 홈 (새소식 + 소모임 탐색 통합 뷰) ==================== */}
        {!selectedClubId && clubViewMode !== 'create' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 overflow-hidden">
            
            {/* 왼쪽 컬럼: 새 소식 피드 & 소모임 탐색 통합 스크롤 */}
            <div className="flex flex-col gap-4 overflow-hidden">
              
              {/* 공통 헤더 */}
              <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
                <div>
                  <h1 className="text-base font-extrabold text-ink">커뮤니티 홈</h1>
                  <p className="text-[11px] text-ink3 mt-0.5">사내 동호회 소식 확인 및 다양한 소모임을 한곳에서 탐색합니다.</p>
                </div>
                <button
                  onClick={() => setClubViewMode('create')}
                  className="rounded-lg bg-teal px-4 py-2 font-bold text-white shadow-xs hover:opacity-90 transition-opacity text-[11.5px]"
                >
                  ＋ 소모임 개설
                </button>
              </div>

              {/* 스크롤 가능한 본문 통합 컨테이너 */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                
                {/* 상단 파트: 최근 새 소식 (최신 피드 - 최대 5개 노출) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xs font-extrabold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>💬</span>
                      <span>새 소식 (최근 활동 피드)</span>
                    </h2>
                  </div>
                  <div className="space-y-3.5">
                    {combinedPosts.length > 0 ? (
                      combinedPosts.slice(0, 5).map((cp, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setSelectedClubId(cp.clubId);
                            setClubViewMode('detail');
                            setClubTab('post');
                          }}
                          className="rounded-xl border border-border bg-panel p-4.5 space-y-3.5 shadow-2xs hover:border-teal/30 hover:bg-panel-alt/10 transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-center text-[11px] border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-soft/60 text-[10.5px] shadow-3xs border border-teal/15 select-none font-bold shrink-0">
                                {cp.clubIcon}
                              </span>
                              <span className="text-teal font-extrabold text-[11.5px] hover:underline">
                                {cp.clubName}
                              </span>
                              <span className="text-ink3">•</span>
                              <span className="text-ink font-bold">{cp.post.author}</span>
                              <span className="text-ink3 font-mono">• {cp.post.date}</span>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-sm font-extrabold text-ink leading-snug">{cp.post.title}</h3>
                            <p className="text-[12px] text-ink2 leading-relaxed whitespace-pre-wrap mt-1">{cp.post.content}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-ink3 border-t border-border/40 pt-2 shrink-0">
                            <span>💬 댓글 0</span>
                            <span>📎 첨부파일 없음</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center bg-panel-alt/10 rounded-xl border border-dashed text-ink3 text-[11.5px]">
                        가입된 소모임이 없거나 최신 소식이 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 하단 파트: 소모임 탐색 (검색 및 카테고리 포함) */}
                <div ref={exploreSectionRef} className="space-y-3 pt-4 border-t border-border">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                    <h2 className="text-xs font-extrabold text-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>👥</span>
                      <span>소모임 탐색 (활동이 활발한 모임)</span>
                    </h2>

                    {/* 검색 인풋 */}
                    <div className="relative shrink-0">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="소모임 이름, 설명, 태그 검색..."
                        className="h-8 w-56 rounded-lg border border-border bg-panel pl-7 pr-3 text-[11px] outline-none focus:border-teal"
                      />
                      <span className="absolute left-2.5 top-2.5 text-ink3 text-[9px]">🔍</span>
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1.5 text-ink3 hover:text-ink font-bold text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 가로 퀵 필터 칩 */}
                  <div className="flex gap-2 overflow-x-auto pb-1.5 shrink-0 scrollbar-none">
                    {['전체', '⚽ 스포츠', '📚 독서', '💻 개발', '⭐ 친목/기타'].map((interest) => (
                      <button
                        key={interest}
                        onClick={() => {
                          setSelectedInterest(interest);
                          setSearchQuery('');
                        }}
                        className={`rounded-full px-3.5 py-1.5 font-bold text-[10.5px] border transition-all shrink-0 ${
                          selectedInterest === interest
                            ? 'bg-teal border-teal text-white shadow-2xs'
                            : 'bg-panel border-border text-ink2 hover:bg-panel-alt'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>

                  {/* 바둑판 소모임 리스트 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredClubs.map((c) => {
                      const joined = c.members.some((m) => m.userId === CURRENT_USER.id);
                      const waiting = joinRequests[c.id];
                      return (
                        <div key={c.id} className="rounded-xl border border-border bg-panel overflow-hidden flex flex-col justify-between gap-3 shadow-2xs hover:border-teal/30 transition-colors">
                          <div className="relative h-28 w-full overflow-hidden bg-panel-alt border-b border-border">
                            <img 
                              src={c.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'} 
                              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'; }}
                              className="w-full h-full object-cover" 
                            />
                            <span className="absolute left-3 top-3 px-2 py-0.5 rounded bg-black/60 font-bold text-white text-[9.5px]">
                              {c.joinPolicy === 'free' ? '🔓 자유가입' : c.joinPolicy === 'approval' ? '⏳ 승인제' : '🔒 초대전용'}
                            </span>
                          </div>

                          <div className="p-4 pt-2.5 flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <h3 className="text-sm font-extrabold text-ink">{c.name}</h3>
                              <div className="flex items-center gap-2 text-[10.5px] text-ink3">
                                <span className="text-teal font-extrabold">멤버 {c.memberCount}명</span>
                                <span>•</span>
                                <span className="font-semibold text-ink2">
                                  {c.joinPolicy === 'free' ? '자유가입' : c.joinPolicy === 'approval' ? '승인제' : '초대전용'}
                                </span>
                              </div>
                              <p className="text-[11.5px] text-ink2 line-clamp-2 leading-relaxed">{c.desc}</p>
                              
                              {c.tags && c.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {c.tags.map((t, idx) => (
                                    <span 
                                      key={idx} 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSearchQuery(t);
                                      }}
                                      className="text-[9.5px] text-teal font-bold bg-teal-soft/20 px-1.5 py-0.5 rounded cursor-pointer hover:bg-teal-soft/40"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setSelectedClubId(c.id);
                                  setClubViewMode('detail');
                                  setClubTab('post');
                                }}
                                className="flex-1 rounded-lg border border-border-hi bg-panel py-2 text-center font-bold text-ink2 hover:bg-panel-alt transition-colors text-[11px]"
                              >
                                상세 보기
                              </button>
                              {joined ? (
                                <span className="flex-1 rounded-lg bg-teal-soft/40 border border-teal/20 py-2 text-center font-bold text-teal text-[11px]">가입됨</span>
                              ) : waiting ? (
                                <span className="flex-1 rounded-lg bg-amber-soft border border-amber/20 py-2 text-center font-bold text-amber text-[11px]">대기중</span>
                              ) : (
                                <button
                                  onClick={() => handleJoinClub(c)}
                                  className="flex-1 rounded-lg bg-teal py-2 text-center font-bold text-white hover:opacity-90 transition-opacity text-[11px]"
                                >
                                  가입 신청
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredClubs.length === 0 && (
                    <div className="py-12 text-center text-ink3 border border-dashed rounded-xl text-[11.5px]">
                      🔍 조건에 맞는 소모임이 없습니다.
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* 오른쪽 컬럼: 추천 소모임 & 안내 배너 */}
            <aside className="hidden lg:flex flex-col gap-4 w-[260px] shrink-0 border-l border-border pl-4.5 pt-1">
              {recommendedClubs.length > 0 && (
                <div className="rounded-xl border border-border bg-panel p-4 space-y-3.5 shadow-xs">
                  {/* 추천 소모임 헤더 클릭 시 탐색 뷰 영역으로 스크롤 이동 */}
                  <h3 
                    onClick={() => exploreSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="font-extrabold text-ink2 text-xs flex items-center gap-1.5 cursor-pointer hover:text-teal transition-colors"
                  >
                    <span>💡</span>
                    <span>추천 소모임</span>
                  </h3>
                  <div className="divide-y divide-border">
                    {recommendedClubs.map((c) => {
                      const waiting = joinRequests[c.id];
                      const badgeText = c.id === 1 ? '🔥 인기 소모임' : c.id === 2 ? '✨ 신규 소모임' : '💻 최근 개설';
                      const badgeColor = c.id === 1 ? 'text-rose-500 bg-rose-50 border-rose-100' : c.id === 2 ? 'text-amber bg-amber-soft/20 border-amber/10' : 'text-teal bg-teal-soft/20 border-teal/10';
                      return (
                        <div key={c.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${badgeColor} mb-1`}>
                                {badgeText}
                              </span>
                              {/* 소모임 명칭 클릭 시 상세 정보창으로 즉각 이동 */}
                              <h4 
                                onClick={() => {
                                  setSelectedClubId(c.id);
                                  setClubViewMode('detail');
                                  setClubTab('post');
                                }}
                                className="font-bold text-ink truncate text-[11.5px] cursor-pointer hover:text-teal hover:underline transition-colors"
                              >
                                {c.name}
                              </h4>
                              <p className="text-[10px] text-ink3 mt-0.5">멤버 {c.memberCount}명</p>
                            </div>
                            {waiting ? (
                              <span className="text-[10px] font-bold text-amber bg-amber-soft/40 px-2 py-0.5 rounded-md">대기</span>
                            ) : (
                              <button
                                onClick={() => handleJoinClub(c)}
                                className="text-[10.5px] font-bold text-teal bg-teal-soft/40 hover:bg-teal-soft/60 px-2.5 py-1 rounded-md transition-colors shrink-0"
                              >
                                가입
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-dashed border-border bg-panel-alt/10 p-4 leading-relaxed text-[11px] text-ink3">
                📢 <strong>사내 동호회 지원제도 안내</strong><br />
                인증된 소모임 활동 보고 시 분기별 동호회 보조금이 지급되니, 많은 활용 바랍니다.
              </div>
            </aside>
          </div>
        )}

        {/* ==================== 2. 소모임 개설 폼 ==================== */}
        {clubViewMode === 'create' && (
          <form onSubmit={handleCreateClub} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <button
                type="button"
                onClick={() => setClubViewMode('list')}
                className="text-ink2 hover:text-ink font-semibold flex items-center gap-1"
              >
                <span>←</span> <span>돌아가기</span>
              </button>
              <span className="font-extrabold text-teal">➕ 신규 소모임 개설</span>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">대표 아이콘</label>
                <select
                  value={newClubIcon}
                  onChange={(e) => setNewClubIcon(e.target.value)}
                  className="h-9.5 w-28 rounded-lg border border-border-hi bg-panel px-2 outline-none focus:border-teal"
                >
                  <option value="⚽">⚽ 스포츠/운동</option>
                  <option value="🎮">🎮 게임/e스포츠</option>
                  <option value="📚">📚 독서/스터디</option>
                  <option value="🎸">🎸 음악/악기</option>
                  <option value="🏃">🏃 러닝/산책</option>
                  <option value="💻">💻 개발/기술</option>
                  <option value="⭐">⭐ 취미/기타</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">소모임 이름</label>
                <input
                  type="text"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="모임명을 입력하세요"
                  required
                  className="h-9.5 w-full max-w-md rounded-lg border border-border-hi bg-panel px-3.5 outline-none focus:border-teal"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">모임 소개</label>
                <textarea
                  value={newClubDesc}
                  onChange={(e) => setNewClubDesc(e.target.value)}
                  placeholder="소모임의 목적, 정기 활동 주기 등을 설명해 주세요."
                  required
                  rows={4}
                  className="w-full rounded-lg border border-border-hi bg-panel p-3.5 outline-none focus:border-teal resize-y leading-relaxed"
                />
              </div>

              {/* 태그 입력 필드 */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">🏷️ 소모임 태그 설정</label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="태그 키워드 입력 후 Enter (예: 운동, 독서)"
                  className="h-9.5 w-full max-w-md rounded-lg border border-border-hi bg-panel px-3.5 outline-none focus:border-teal"
                />
                {newClubTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {newClubTags.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-teal font-extrabold bg-teal-soft/30 px-2 py-0.5 rounded-full">
                        <span>{t}</span>
                        <button type="button" onClick={() => removeNewClubTag(idx)} className="text-[8px] font-bold text-ink3 hover:text-ink">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">가입 방식</label>
                <select
                  value={newClubPolicy}
                  onChange={(e) => setNewClubPolicy(e.target.value as JoinPolicy)}
                  className="h-9.5 w-full max-w-xs rounded-lg border border-border-hi bg-panel px-2 outline-none focus:border-teal"
                >
                  <option value="free">🔓 자유가입 (신청 시 즉시 가입)</option>
                  <option value="approval">⏳ 승인제 (운영자 승인 후 가입)</option>
                  <option value="invite">🔒 초대 전용 (초대로만 가입 가능)</option>
                </select>
              </div>

              {/* 대표 사진 첨부 필드 */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">🖼️ 대표 사진 (커버 이미지)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="block w-full text-xs text-ink3 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-semibold file:bg-panel-alt hover:file:bg-border-hi cursor-pointer"
                />
                {newClubCoverImage && (
                  <div className="relative h-28 w-48 rounded-lg overflow-hidden border border-border mt-1">
                    <img src={newClubCoverImage} alt="커버 미리보기" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewClubCoverImage('')}
                      className="absolute top-1 right-1 h-5 w-5 bg-black/60 text-white rounded-full text-[10px] font-bold flex items-center justify-center hover:bg-black"
                    >
                      ✕
                    </button>
                  </div>
                )}
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
                개설 완료
              </button>
            </div>
          </form>
        )}

        {/* ==================== 3. 개별 소모임 프라이빗 룸 ==================== */}
        {clubViewMode === 'detail' && activeClub && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <button
                onClick={() => {
                  setSelectedClubId(null);
                  setClubViewMode('list');
                }}
                className="flex items-center gap-1 text-teal font-bold hover:underline"
              >
                <span>←</span> <span>소모임 홈으로</span>
              </button>
              <div className="flex items-center gap-2">
                {isClubOwner && (
                  <button
                    onClick={() => {
                      setEditClubDesc(activeClub.desc);
                      setIsAdminModalOpen(true);
                    }}
                    className="rounded-lg border border-border-hi bg-panel px-3 py-1.5 text-[11px] font-bold text-ink2 hover:bg-panel-alt transition-colors"
                  >
                    ⚙️ 소모임 관리
                  </button>
                )}
                {isMyClub && !isClubOwner && (
                  <button
                    onClick={() => handleLeaveClub(activeClub.id)}
                    className="rounded-lg border border-border-hi text-ink3 hover:text-rose-500 hover:bg-rose-50 px-3 py-1.5 text-[11px] font-bold bg-panel transition-colors"
                  >
                    탈퇴하기
                  </button>
                )}
              </div>
            </div>

            {/* 소모임 대표 이미지 배너 헤더 */}
            <div className="relative h-28 w-full overflow-hidden rounded-t-xl bg-panel-alt border-x border-t border-border shrink-0 mt-3">
              <img 
                src={activeClub.coverImage || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'} 
                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'; }}
                className="w-full h-full object-cover" 
              />
            </div>
            
            {/* 오버랩 정보 섹션 */}
            <div className="bg-panel border-x border-b border-border rounded-b-xl p-4 flex gap-4 items-start shrink-0 mb-3 shadow-2xs relative">
              {/* 입체적인 에모지 프로필 배지 */}
              <div className="-mt-10 h-16 w-16 rounded-2xl border-2 border-panel bg-panel shadow-md flex items-center justify-center text-3xl shrink-0 z-10 select-none">
                {activeClub.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-0.5">
                    <h2 className="text-base font-extrabold text-ink">{activeClub.name}</h2>
                    <div className="flex items-center gap-2 text-[10.5px] text-ink3">
                      <span className="text-teal font-extrabold">멤버 {activeClub.memberCount}명</span>
                      <span>•</span>
                      <span className="font-semibold text-ink2">
                        {activeClub.joinPolicy === 'free' ? '자유가입' : activeClub.joinPolicy === 'approval' ? '승인제' : '초대전용'}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[11.5px] text-ink2 leading-relaxed mt-1.5">{activeClub.desc}</p>
                
                {/* 상세 화면 상단에도 태그 노출 */}
                {activeClub.tags && activeClub.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {activeClub.tags.map((t, idx) => (
                      <span key={idx} className="text-[9.5px] text-teal font-bold bg-teal-soft/20 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setClubTab('post')}
                className={`px-5 py-2.5 font-bold transition-colors ${
                  clubTab === 'post' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                }`}
              >
                게시글 ({activeClub.posts.length})
              </button>
              <button
                onClick={() => setClubTab('event')}
                className={`px-5 py-2.5 font-bold transition-colors ${
                  clubTab === 'event' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                }`}
              >
                일정 및 투표 ({activeClub.events.length})
              </button>
              <button
                onClick={() => setClubTab('member')}
                className={`px-5 py-2.5 font-bold transition-colors ${
                  clubTab === 'member' ? 'border-b-2 border-teal text-teal' : 'text-ink2 hover:text-ink'
                }`}
              >
                멤버 ({activeClub.memberCount})
              </button>
            </div>

            {/* 2열 레이아웃 바디 (네이버 밴드 스타일) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 overflow-hidden mt-2">
              
              {/* 왼쪽: 탭 본문 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto pr-1 py-1 space-y-4">
                {/* A. 게시글 탭 */}
                {clubTab === 'post' && (
                  <div className="space-y-4">
                    {isMyClub ? (
                      <>
                        {/* 새 글 작성 트리거를 텍스트 박스형 인풋 스타일로 개편 */}
                        {!isPostWriteOpen ? (
                          <div 
                            onClick={() => setIsPostWriteOpen(true)}
                            className="w-full rounded-xl border border-border bg-panel p-3.5 flex items-center gap-2.5 cursor-pointer hover:bg-panel-alt/50 transition-colors shadow-2xs"
                          >
                            <span className="text-teal text-sm">✏️</span>
                            <span className="text-ink3 text-[11.5px] flex-1">소모임에 새로운 이야기를 남겨보세요...</span>
                          </div>
                        ) : (
                          <form onSubmit={handleCreateClubPost} className="rounded-xl border border-border p-4 bg-panel-alt/25 space-y-3">
                            <div className="flex justify-between items-center shrink-0">
                              <span className="font-bold text-ink2 text-xs">활동 소식 공유</span>
                              <button
                                type="button"
                                onClick={() => setIsPostWriteOpen(false)}
                                className="text-[11px] text-ink3 hover:text-ink"
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
                              placeholder="내용을 상세히 입력하세요."
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
                                <div className="flex items-center gap-3 text-[11px] text-ink3 border-t border-border/40 pt-2 shrink-0">
                                  <span>💬 댓글 0</span>
                                  <span>📎 첨부파일 없음</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-12 border border-dashed rounded-xl text-center text-ink3">아직 작성된 글이 없습니다.</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-center border border-dashed rounded-xl bg-panel-alt/10 p-5 space-y-3">
                        <p className="text-ink3 text-[12.5px]">🔒 소모임 멤버에게만 활동 피드가 오픈됩니다.</p>
                        <button
                          onClick={() => handleJoinClub(activeClub)}
                          className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90 text-[11.5px]"
                        >
                          소모임 가입 후 소통 참여하기
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* B. 일정 및 투표 탭 (Naver Band RSVP Style) */}
                {clubTab === 'event' && (
                  <div className="space-y-4">
                    {isMyClub ? (
                      <>
                        {/* 새 일정 생성 토글 */}
                        {!isEventWriteOpen ? (
                          <button
                            onClick={() => setIsEventWriteOpen(true)}
                            className="w-full rounded-xl border border-dashed border-teal/40 bg-teal-soft/10 text-teal font-bold py-3 text-center hover:bg-teal-soft/20 transition-colors"
                          >
                            📅 새 일정 등록 및 RSVP 투표 개설
                          </button>
                        ) : (
                          <form onSubmit={handleCreateClubEvent} className="rounded-xl border border-border p-4 bg-panel-alt/25 space-y-3">
                            <div className="flex justify-between items-center shrink-0">
                              <span className="font-bold text-ink2 text-xs">📅 새 모임 일정 개설</span>
                              <button
                                type="button"
                                onClick={() => setIsEventWriteOpen(false)}
                                className="text-[11px] text-ink3 hover:text-ink"
                              >
                                취소
                              </button>
                            </div>
                            
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-ink2">모임 제목</label>
                              <input
                                type="text"
                                value={eventTitle}
                                onChange={(e) => setEventTitle(e.target.value)}
                                placeholder="예: 8월 2째주 정기 스터디"
                                required
                                className="h-8.5 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[11.5px]"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-ink2">일시</label>
                                <input
                                  type="datetime-local"
                                  value={eventDate}
                                  onChange={(e) => setEventDate(e.target.value)}
                                  required
                                  className="h-8.5 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[11.5px]"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold text-ink2">장소</label>
                                <input
                                  type="text"
                                  value={eventLocation}
                                  onChange={(e) => setEventLocation(e.target.value)}
                                  placeholder="예: 4층 대회의실"
                                  className="h-8.5 w-full rounded-lg border border-border bg-panel px-3 outline-none focus:border-teal text-[11.5px]"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-ink2">설명</label>
                              <textarea
                                value={eventDesc}
                                onChange={(e) => setEventDesc(e.target.value)}
                                placeholder="준비물 및 세부 공지사항을 기재하세요."
                                rows={3}
                                className="w-full rounded-lg border border-border bg-panel p-2.5 outline-none focus:border-teal text-[11.5px] leading-normal"
                              />
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsEventWriteOpen(false)}
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

                        {/* 모임 일정 및 투표 카드 목록 */}
                        <div className="space-y-4">
                          {activeClub.events && activeClub.events.length > 0 ? (
                            activeClub.events.map((e) => {
                              // 현재 내 투표 현황 파악
                              const myVote = e.votes[CURRENT_USER.id] || null;

                              // 투표 집계
                              const votesArray = Object.entries(e.votes);
                              const attendees = votesArray.filter(([_, type]) => type === 'attend').map(([uid]) => {
                                const found = activeClub.members.find(m => m.userId === uid);
                                return found ? `${found.name} ${found.position}` : uid;
                              });
                              const absenteesCount = votesArray.filter(([_, type]) => type === 'absent').length;
                              const undecidedCount = votesArray.filter(([_, type]) => type === 'undecided').length;

                              return (
                                <div key={e.id} className="rounded-xl border border-border bg-panel p-5 space-y-4 shadow-sm">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-extrabold text-ink">{e.title}</h4>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink3">
                                        {/* 사람 중심 한글 날짜 포맷팅 반영 */}
                                        <span>📅 {formatEventDate(e.date)}</span>
                                        <span>📍 {e.location || '장소 미정'}</span>
                                        <span>👤 작성자: {e.creator}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {e.desc && (
                                    <p className="text-[12px] text-ink2 leading-relaxed whitespace-pre-wrap bg-panel-alt/30 border border-border/30 rounded-lg p-3">
                                      {e.desc}
                                    </p>
                                  )}

                                  {/* 참석 명단 취합 현황 */}
                                  <div className="bg-panel-alt/50 border rounded-lg p-3 space-y-2">
                                    <div className="text-[11px] font-extrabold text-ink2 flex items-center justify-between border-b border-border/50 pb-1.5">
                                      <span>📊 RSVP 참석 투표 현황</span>
                                      <span className="text-teal">참석: {attendees.length}명 / 불참: {absenteesCount}명 / 미정: {undecidedCount}명</span>
                                    </div>
                                    {attendees.length > 0 ? (
                                      <div className="text-[11.5px] leading-relaxed text-ink flex flex-wrap gap-1.5 items-center">
                                        <span className="text-teal font-bold shrink-0">참석자:</span>
                                        {attendees.map((name, nIdx) => (
                                          <span key={nIdx} className="bg-teal-soft/40 border border-teal/20 text-teal text-[10.5px] px-2 py-0.5 rounded font-semibold">
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-ink3 italic">아직 투표한 참석자가 없습니다.</div>
                                    )}
                                  </div>

                                  {/* RSVP 투표 컨트롤 영역 */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => voteClubEvent(activeClub.id, e.id, CURRENT_USER.id, 'attend')}
                                      className={`flex-1 py-2 text-center rounded-lg font-bold text-[11.5px] transition-all border ${myVote === 'attend'
                                          ? 'bg-teal text-white border-teal shadow-xs'
                                          : 'bg-panel border-border text-ink2 hover:bg-panel-alt'
                                        }`}
                                    >
                                      👍 참석
                                    </button>
                                    <button
                                      onClick={() => voteClubEvent(activeClub.id, e.id, CURRENT_USER.id, 'absent')}
                                      className={`flex-1 py-2 text-center rounded-lg font-bold text-[11.5px] transition-all border ${myVote === 'absent'
                                          ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                                          : 'bg-panel border-border text-ink2 hover:bg-panel-alt'
                                        }`}
                                    >
                                      👎 불참
                                    </button>
                                    <button
                                      onClick={() => voteClubEvent(activeClub.id, e.id, CURRENT_USER.id, 'undecided')}
                                      className={`flex-1 py-2 text-center rounded-lg font-bold text-[11.5px] transition-all border ${myVote === 'undecided'
                                          ? 'bg-amber text-white border-amber shadow-xs'
                                          : 'bg-panel border-border text-ink2 hover:bg-panel-alt'
                                        }`}
                                    >
                                      ⏳ 미정
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-12 border border-dashed rounded-xl text-center text-ink3">등록된 정기 모임 일정이 없습니다.</div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-10 text-center border border-dashed rounded-xl bg-panel-alt/10 p-5 space-y-3">
                        <p className="text-ink3 text-[12.5px]">🔒 소모임 멤버에게만 모임 일정 및 참석 투표 기능이 활성화됩니다.</p>
                        <button
                          onClick={() => handleJoinClub(activeClub)}
                          className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90 text-[11.5px]"
                        >
                          소모임 가입 후 모임 참가하기
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* C. 멤버 탭 */}
                {clubTab === 'member' && (
                  <div className="border border-border rounded-xl bg-panel overflow-hidden">
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

              {/* 오른쪽: 소모임 사이드바 정보 위젯 */}
              <aside className="hidden lg:flex flex-col gap-4 w-[280px] shrink-0 border-l border-border pl-5 py-1 overflow-y-auto">
                {/* 1. 가입 인사 / 방명록 피드 위젯 */}
                <div className="rounded-xl border border-border bg-panel p-4 space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-ink2 text-xs border-b border-border/40 pb-2 flex items-center gap-1.5">
                    <span>💬</span>
                    <span>가입 인사 / 방명록 ({activeClub.greetings?.length || 0})</span>
                  </h3>
                  
                  {isMyClub && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!greetingInput.trim()) return;
                        addClubGreeting(activeClub.id, greetingInput.trim(), `${CURRENT_USER.name} ${CURRENT_USER.position}`);
                        setGreetingInput('');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={greetingInput}
                        onChange={(e) => setGreetingInput(e.target.value)}
                        placeholder="가입인사를 작성해 보세요!"
                        required
                        className="flex-1 h-7.5 rounded-lg border border-border bg-panel px-2.5 text-[11px] outline-none focus:border-teal"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-teal text-white px-2.5 text-[10.5px] font-bold hover:opacity-90 transition-opacity"
                      >
                        등록
                      </button>
                    </form>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeClub.greetings && activeClub.greetings.length > 0 ? (
                      activeClub.greetings.map((g) => (
                        <div key={g.id} className="p-2 bg-panel-alt/30 border border-border/40 rounded-lg text-[11px] space-y-1">
                          <div className="flex justify-between items-center text-[9.5px] text-ink3">
                            <span className="font-bold text-ink2">{g.author}</span>
                            <span>{g.date}</span>
                          </div>
                          <p className="text-ink text-[11px] leading-snug whitespace-pre-wrap">{g.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-ink3 italic py-2 text-center">등록된 가입인사가 없습니다.</div>
                    )}
                  </div>
                </div>

                {/* 2. 소모임 정보 카드 */}
                <div className="rounded-xl border border-border bg-panel p-4 space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-ink2 text-xs border-b border-border/40 pb-2 flex items-center gap-1.5">
                    <span>📢</span>
                    <span>소모임 정보</span>
                  </h3>
                  <div className="space-y-2.5 text-[11.5px] text-ink2">
                    <div className="flex justify-between">
                      <span className="text-ink3">개설 리더</span>
                      <span className="font-bold text-teal">{activeClub.members.find(m => m.role === 'owner')?.name || '관리자'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink3">가입 조건</span>
                      <span className="font-bold">{activeClub.joinPolicy === 'free' ? '자유 가입' : activeClub.joinPolicy === 'approval' ? '승인 필요' : '초대 전용'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink3">총 멤버 수</span>
                      <span className="font-bold text-teal">{activeClub.memberCount}명</span>
                    </div>
                  </div>
                </div>

                {/* 3. 다가오는 모임 일정 요약 */}
                <div className="rounded-xl border border-border bg-panel p-4 space-y-3 shadow-xs">
                  <h3 className="font-extrabold text-ink2 text-xs border-b border-border/40 pb-2 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>다가오는 일정 ({activeClub.events?.length || 0})</span>
                  </h3>
                  <div className="space-y-3">
                    {activeClub.events && activeClub.events.length > 0 ? (
                      activeClub.events.slice(0, 2).map((ev) => {
                        const displayDate = formatEventDate(ev.date);
                        return (
                          <div key={ev.id} className="p-2.5 bg-panel-alt/40 border border-border/50 rounded-lg flex flex-col gap-1 text-[11px] leading-snug">
                            <span className="font-bold text-ink truncate">{ev.title}</span>
                            <span className="text-teal font-extrabold text-[10px]">📅 {displayDate}</span>
                            <span className="text-ink3 text-[9.5px]">
                              투표: {Object.keys(ev.votes).length}명 참여완료
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[11px] text-ink3 italic py-2 text-center">등록된 일정이 없습니다.</div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* ==================== 4. 모의 소모임 관리자(Owner) 모달 ==================== */}
      {isAdminModalOpen && activeClub && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-panel border border-border w-[400px] rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="font-extrabold text-navy text-[13px]">⚙️ 소모임 관리자 메뉴</span>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-ink3 hover:text-ink font-bold">✕</button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-ink2 text-[11.5px]">소모임 소개글 수정</label>
                <textarea
                  value={editClubDesc}
                  onChange={(e) => setEditClubDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-panel p-2.5 outline-none focus:border-teal text-[11.5px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink2 text-[11.5px] block">회원 목록 관리 (방출 모의)</label>
                <div className="max-h-24 overflow-y-auto border border-border rounded-lg bg-panel-alt/10 p-2 divide-y divide-border/50">
                  {activeClub.members.map((m) => (
                    <div key={m.userId} className="flex justify-between items-center py-1 text-[11px]">
                      <span>{m.name} {m.position}</span>
                      {m.role !== 'owner' ? (
                        <button 
                          onClick={() => alert(`${m.name} 회원을 내보냈습니다. (시뮬레이션)`)}
                          className="text-rose-500 hover:underline font-bold text-[10px]"
                        >
                          방출
                        </button>
                      ) : (
                        <span className="text-amber text-[9px] font-bold">방장</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3 flex justify-between items-center">
              <button 
                onClick={handleCloseClub} 
                className="text-rose-500 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
              >
                🚨 소모임 폐쇄
              </button>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setIsAdminModalOpen(false)}
                  className="border border-border-hi px-3 py-1.5 rounded-lg text-[11px] hover:bg-panel-alt font-semibold"
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveClubDesc}
                  className="bg-teal text-white px-3.5 py-1.5 rounded-lg text-[11px] font-bold hover:opacity-90"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 기능 제한 공지 모달 ── */}
      {isNoticeOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs select-none text-ink">
          <div className="w-[400px] rounded-2xl border border-border bg-panel p-6 shadow-2xl flex flex-col gap-4 text-center font-sans">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber/10 text-2xl text-amber">
              ⚠️
            </div>
            <div className="space-y-1.5 text-center">
              <h3 className="text-base font-extrabold text-ink">서비스 이용 안내</h3>
              <p className="text-[12px] text-ink2 leading-relaxed">
                해당 페이지는 **아직 개발 및 구현 중**이므로<br />
                실제 기능 및 데이터를 정상적으로 이용할 수 없습니다.
              </p>
            </div>
            <button
              onClick={() => setIsNoticeOpen(false)}
              className="mt-2 w-full rounded-xl bg-teal py-2.5 font-bold text-white shadow-sm hover:opacity-90 transition-opacity text-[12px]"
            >
              확인하였습니다
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
