import { useState, useMemo } from 'react';

interface Board {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

interface Post {
  id: number;
  boardId: string;
  title: string;
  content: string;
  author: string;
  date: string;
  views: number;
  isPinned?: boolean;
  hasAttachment?: boolean;
  commentsCount?: number;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  date: string;
}

const BOARDS: Board[] = [
  { id: 'notice', name: '공지사항', icon: '📢', desc: '회사의 주요 공지사항 및 긴급 안내를 전달합니다.' },
  { id: 'event', name: '경조사', icon: '💐', desc: '임직원들의 기쁜 소식과 슬픈 소식을 함께 나눕니다.' },
  { id: 'rule', name: '사내규정', icon: '📑', desc: '회사의 복무규정, 보안정책 및 내규를 확인합니다.' },
  { id: 'archive', name: '자료실', icon: '📁', desc: '업무 관련 매뉴얼, 양식 및 참고 문서를 내려받습니다.' },
];

const MOCK_POSTS: Post[] = [
  // 공지사항
  { id: 1, boardId: 'notice', title: '2026년 하계 전사 공동 연휴 일정 안내', content: '안녕하세요. 경영지원실입니다. 금년도 하계 공동 연휴 일정을 8월 14일(금)~8월 17일(월) 총 4일간으로 확정하여 안내드립니다. 각 부서에서는 사전에 업무 일정 조율 및 비상 연락 체계를 유지해 주시기 바랍니다.', author: '경영지원실', date: '2026-08-10', views: 124, isPinned: true, commentsCount: 3 },
  { id: 2, boardId: 'notice', title: '그룹웨어 신규 보안 강화 패치 적용 및 시스템 점검', content: '안전한 사내 업무 환경 조성을 위해 8월 12일(수) 오후 8시부터 10시까지 그룹웨어 보안 패치 작업이 진행됩니다. 점검 시간 중에는 전자결재 및 메신저 접속이 일시 차단될 수 있으니 미리 작업을 저장해 주시기 바랍니다.', author: '정보기술팀', date: '2026-08-08', views: 98, isPinned: true, hasAttachment: true },
  { id: 3, boardId: 'notice', title: '8월 전사 직무 및 안전 소양 교육 시행 안내', content: '산업안전보건법에 의거한 8월 전사 정기 교육을 아래와 같이 온라인 교육(Widdy) 플랫폼을 통해 개설하였습니다. 전 임직원은 8월 25일까지 반드시 수강 완료해 주시기 바랍니다.', author: '인재개발원', date: '2026-08-07', views: 45 },
  { id: 4, boardId: 'notice', title: '사내 주차장 이용 및 요일제 주차 등록 신청 안내', content: '사내 주차 공간 협소로 인한 혼잡을 줄이고자 차량 요일제를 전면 시행합니다. 신규 차량 등록이나 요일 변경이 필요하신 임직원 분들은 총무팀으로 신청서 서식을 작성해 제출바랍니다.', author: '총무팀', date: '2026-08-05', views: 67 },
  
  // 경조사
  { id: 5, boardId: 'event', title: '[결혼] AX개발본부 김승기 본부장 장녀 결혼 안내', content: '김승기 본부장의 장녀 예식 일정을 안내드립니다.\n- 일시: 2026년 8월 29일(토) 오후 1시\n- 장소: 더프라자호텔 3층 그랜드볼룸\n임직원 여러분의 따뜻한 축하 부탁드립니다.', author: '경영지원실', date: '2026-08-09', views: 245, isPinned: true, commentsCount: 5 },
  { id: 6, boardId: 'event', title: '[부고] 품질관리팀 최지혜 사원 조부상 안내', content: '최지혜 사원의 조부께서 별세하셨기에 삼가 알려드립니다.\n- 빈소: 서울성모병원 장례식장 5호실\n- 발인: 2026년 8월 13일(목) 오전 8시\n삼가 고인의 명복을 빕니다.', author: '품질관리팀', date: '2026-08-11', views: 180, isPinned: true },
  
  // 사내규정
  { id: 7, boardId: 'rule', title: '취업규칙 및 복무 규정 최신 개정본 (v2.4)', content: '법령 개정에 따라 당사 취업규칙 및 복무 규정이 일부 개정되었습니다. 주요 변경사항은 육아휴직 및 돌봄휴가 혜택 확대에 관한 조항입니다. 자세한 개정 세부 원문은 첨부파일을 참조하십시오.', author: '인사노무팀', date: '2026-08-01', views: 320, isPinned: true, hasAttachment: true },
  { id: 8, boardId: 'rule', title: '사내 정보 보안 및 개인정보 처리 위탁 지침 v1.1', content: '사내 PC 보안 가이드라인에 의거하여 개인정보를 취급하는 외주 위탁 업체들의 보안 지침 점검 및 교육 수기 기준표가 업데이트되어 공지합니다.', author: '보안팀', date: '2026-07-25', views: 154 },
  
  // 자료실
  { id: 9, boardId: 'archive', title: '2026년 표준 용역 및 자재 도급 계약서 양식', content: '2026년도 신규 계약 체결 시 사용하는 당사 공식 표준 외주 계약서 및 자재 수급 도급 표준 계약서 최종 한글/워드 서식 파일입니다.', author: '법무지원팀', date: '2026-08-03', views: 189, hasAttachment: true },
  { id: 10, boardId: 'archive', title: '그룹웨어 출장 및 지출결의 영수증 처리 가이드북 (PDF)', content: '출장 품의 및 지출결의 상신 시 헷갈리기 쉬운 법인카드 영수증 증빙 처리 방식과 증빙 불가 항목에 대한 종합 매뉴얼 PDF 파일입니다.', author: '재경팀', date: '2026-07-30', views: 210, hasAttachment: true },
];

const MOCK_COMMENTS: Comment[] = [
  { id: 1, author: '홍채원', content: '일정을 확인해 주셔서 감사합니다. 차질 없이 업무 진행하겠습니다.', date: '2026-08-10 15:40' },
  { id: 2, author: '박광래', content: '부서별 상세 연휴 일정 공유도 내일까지 필요한가요?', date: '2026-08-10 16:12' },
];

export default function BoardScreen() {
  const [activeBoard, setActiveBoard] = useState<string>('notice');
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'write'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // 폼 상태 (글쓰기용 Mock)
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    boardId: 'notice',
    isPinned: false,
    allowComments: true,
  });

  const activeBoardMeta = useMemo(() => {
    return BOARDS.find((b) => b.id === activeBoard) || BOARDS[0];
  }, [activeBoard]);

  const filteredPosts = useMemo(() => {
    let posts = MOCK_POSTS.filter((p) => p.boardId === activeBoard);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q)
      );
    }
    // 고정글(isPinned) -> 최신순 정렬
    return [...posts].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [activeBoard, searchQuery]);

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setViewMode('detail');
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    alert('기능 개발 준비 중입니다. (화면 레이아웃 테스트용)');
    setViewMode('list');
    setNewPost({
      title: '',
      content: '',
      boardId: activeBoard,
      isPinned: false,
      allowComments: true,
    });
  };

  return (
    <div className="flex h-full w-full gap-5 bg-panel p-6 text-[12.5px] text-ink">
      {/* ── 좌측 게시판 사이드바 (고정) ── */}
      <aside className="w-[240px] shrink-0 flex flex-col gap-4 rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-navy">🌐 그룹웨어 게시판</h2>
          <p className="mt-1 text-[11px] text-ink3">공식 정보 및 사내 공지를 열람합니다.</p>
        </div>

        <nav className="flex flex-col gap-1">
          {BOARDS.map((b) => {
            const isActive = b.id === activeBoard;
            return (
              <button
                key={b.id}
                onClick={() => {
                  setActiveBoard(b.id);
                  setSearchQuery('');
                  setViewMode('list'); // 다른 게시판 이동 시 목록으로 강제 이동
                }}
                className={`flex w-full items-center gap-3.5 rounded-lg px-3.5 py-3 text-left font-bold transition-all ${
                  isActive
                    ? 'bg-teal text-white shadow-xs'
                    : 'text-ink2 hover:bg-panel-alt hover:text-ink'
                }`}
              >
                <span className="text-base">{b.icon}</span>
                <span className="flex-1 truncate">{b.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── 우측 메인 컨텐츠 영역 (viewMode에 따라 전환) ── */}
      <main className="flex-1 flex flex-col gap-4 rounded-xl border border-border bg-panel p-5 shadow-sm overflow-hidden">
        
        {/* 1) 목록 뷰 (List View) */}
        {viewMode === 'list' && (
          <>
            {/* 상단 타이틀 & 헤더 */}
            <div className="flex flex-col gap-2 border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <span>{activeBoardMeta.icon}</span>
                  <span>{activeBoardMeta.name}</span>
                </h1>
                <button
                  onClick={() => {
                    setNewPost({ ...newPost, boardId: activeBoard });
                    setViewMode('write');
                  }}
                  className="rounded-lg bg-teal px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                  ✍️ 새 글 쓰기
                </button>
              </div>
              <p className="text-[11.5px] text-ink3">{activeBoardMeta.desc}</p>
            </div>

            {/* 필터 및 검색 바 */}
            <div className="flex items-center justify-end gap-2">
              <div className="relative w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목, 내용 또는 작성자 검색"
                  className="h-9 w-full rounded-lg border border-border-hi bg-panel px-3.5 pr-8 text-[12px] outline-none focus:border-teal transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 text-xs pointer-events-none">🔍</span>
              </div>
            </div>

            {/* 게시글 테이블 목록 */}
            <div className="flex-1 overflow-auto rounded-lg border border-border bg-panel">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-panel-alt/50 font-bold text-ink2">
                    <th className="p-3 w-14 text-center">번호</th>
                    <th className="p-3">제목</th>
                    <th className="p-3 w-28">작성자</th>
                    <th className="p-3 w-24">작성일</th>
                    <th className="p-3 w-16 text-center">조회</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.length > 0 ? (
                    filteredPosts.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => handlePostClick(p)}
                        className="border-b border-border hover:bg-panel-alt/30 cursor-pointer transition-colors"
                      >
                        <td className="p-3 text-center">
                          {p.isPinned ? (
                            <span className="text-teal font-bold" title="중요 공지">📌</span>
                          ) : (
                            <span className="text-ink3">{p.id}</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-ink flex items-center gap-1.5 min-w-0">
                          {p.isPinned && <span className="text-teal font-extrabold text-[10px] bg-teal-soft/40 border border-teal/20 rounded px-1 shrink-0">중요</span>}
                          <span className="truncate hover:text-teal transition-colors">{p.title}</span>
                          {p.hasAttachment && <span className="text-[10px] opacity-75 shrink-0" title="첨부파일 있음">📎</span>}
                          {p.commentsCount && (
                            <span className="text-[10px] font-bold text-teal bg-teal-soft px-1.5 py-0.5 rounded shrink-0">
                              {p.commentsCount}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-ink2 truncate">{p.author}</td>
                        <td className="p-3 text-ink3">{p.date}</td>
                        <td className="p-3 text-center text-ink3">{p.views}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-ink3">
                        게시물이 존재하지 않습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 2) 상세 조회 뷰 (Detail View) */}
        {viewMode === 'detail' && selectedPost && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 상단 액션 바 */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <button
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1.5 text-teal font-bold hover:underline"
              >
                <span>←</span> <span>목록으로</span>
              </button>
              <span className="text-xs text-ink3">
                {BOARDS.find((b) => b.id === selectedPost.boardId)?.name || '게시판'}
              </span>
            </div>

            {/* 본문/댓글 영역 */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
              <div className="space-y-2 border-b border-border pb-3">
                <h2 className="text-[15px] font-extrabold text-ink leading-snug">
                  {selectedPost.isPinned && <span className="text-teal mr-1.5">📌</span>}
                  {selectedPost.title}
                </h2>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink3">
                  <div className="flex items-center gap-3">
                    <span>작성자: <strong className="text-ink2">{selectedPost.author}</strong></span>
                    <span className="text-border">|</span>
                    <span>등록일: {selectedPost.date}</span>
                  </div>
                  <span>조회수: {selectedPost.views}</span>
                </div>
              </div>

              {/* 본문 내용 */}
              <div className="whitespace-pre-wrap leading-relaxed text-[13px] py-2 border-b border-border/60 pb-5 text-ink">
                {selectedPost.content}
              </div>

              {/* 첨부파일 영역 */}
              {selectedPost.hasAttachment && (
                <div className="rounded-lg border border-border bg-panel-alt/30 p-3.5 space-y-2">
                  <div className="font-bold text-[11px] text-ink2">📎 첨부파일 (1개)</div>
                  <div className="flex items-center justify-between gap-3 text-[11.5px] hover:text-teal cursor-pointer">
                    <span className="underline">회사_가이드라인_및_서식문서.docx</span>
                    <span className="text-[10px] text-ink3 font-mono">1.2 MB</span>
                  </div>
                </div>
              )}

              {/* 댓글 목록 */}
              <div className="space-y-3 pt-3">
                <h3 className="font-bold text-ink flex items-center gap-1.5">
                  💬 댓글 <span className="text-teal font-extrabold">{MOCK_COMMENTS.length}</span>
                </h3>
                
                <div className="space-y-2">
                  {MOCK_COMMENTS.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border bg-panel-alt/10 p-3.5 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-extrabold text-ink2">{c.author}</span>
                        <span className="text-ink3 font-mono">{c.date}</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-ink">{c.content}</p>
                    </div>
                  ))}
                </div>

                {/* 댓글 작성 폼 */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="의견을 입력하세요"
                    className="flex-1 h-9.5 rounded-lg border border-border-hi bg-panel px-3.5 text-[12px] outline-none focus:border-teal"
                  />
                  <button
                    onClick={() => alert('댓글 작성 기능 개발 준비 중입니다.')}
                    className="rounded-lg bg-teal px-5 text-[12px] font-bold text-white hover:opacity-90"
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3) 글작성 뷰 (Write View) */}
        {viewMode === 'write' && (
          <form onSubmit={handleCreatePost} className="flex-1 flex flex-col overflow-hidden">
            {/* 상단 액션 바 */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="flex items-center gap-1 text-ink2 hover:text-ink font-semibold"
              >
                <span>←</span> <span>작성 취소</span>
              </button>
              <span className="font-extrabold text-teal">✍️ 새 게시글 작성</span>
            </div>

            {/* 입력 영역 */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">게시판 선택</label>
                <select
                  value={newPost.boardId}
                  onChange={(e) => setNewPost({ ...newPost, boardId: e.target.value })}
                  className="h-9.5 w-full max-w-xs rounded-lg border border-border-hi bg-panel px-3 outline-none focus:border-teal"
                >
                  {BOARDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.icon} {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">제목</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="제목을 입력하세요"
                  required
                  className="h-9.5 w-full rounded-lg border border-border-hi bg-panel px-3.5 outline-none focus:border-teal"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-ink2">내용</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="본문 내용을 상세히 입력하세요"
                  required
                  rows={12}
                  className="w-full rounded-lg border border-border-hi bg-panel p-3.5 outline-none focus:border-teal resize-y leading-relaxed"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1.5">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink2">
                  <input
                    type="checkbox"
                    checked={newPost.isPinned}
                    onChange={(e) => setNewPost({ ...newPost, isPinned: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>📌 중요 공지로 설정 (목록 최상단 고정)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink2">
                  <input
                    type="checkbox"
                    checked={newPost.allowComments}
                    onChange={(e) => setNewPost({ ...newPost, allowComments: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>💬 댓글 허용</span>
                </label>
              </div>
            </div>

            {/* 작성 풋터 */}
            <div className="border-t border-border pt-3.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-lg border border-border-hi bg-panel px-4 py-2 font-bold text-ink2 hover:bg-panel-alt"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-lg bg-teal px-5 py-2 font-bold text-white hover:opacity-90"
              >
                등록
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
