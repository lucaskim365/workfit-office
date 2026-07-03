import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pill } from '@/shared/ui/Pill';
import profilePhoto from '@/assets/profile-honchaewon.png';

interface Tool {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const DOCK_TOOLS: Tool[] = [
  { key: 'gw', label: '그룹웨어', icon: '▦', color: '#16b8cf' },
  { key: 'bot', label: '챗봇', icon: '✦', color: '#17a89a' },
  { key: 'msg', label: '메신저', icon: '💬', color: '#e6960c' },
  { key: 'app', label: 'App Store', icon: '◳', color: '#6c5ce7' },
  { key: 'edu', label: '교육', icon: '◉', color: '#e0567a' },
];

const PANEL_W = 384;

/** 우측 가장자리 퀵 도크(세로 책갈피 탭 + 슬라이드 패널). 와이어프레임 quick-dock.jsx 정본.
 * scrolling: 본문 스크롤 중이면 탭을 더 밀어내고 흐리게(양보) → 멈추면 복귀. */
export function QuickDock({ scrolling = false }: { scrolling?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const tool = DOCK_TOOLS.find((t) => t.key === open);

  return (
    <>
      {/* dim */}
      <div
        onClick={() => setOpen(null)}
        className="fixed inset-0 z-[70] bg-navy-deep/30 transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* 세로 책갈피 탭 */}
      <div className="fixed right-0 top-1/2 z-[72] flex -translate-y-1/2 flex-col items-end">
        {DOCK_TOOLS.map((t, i) => {
          const peeked = hover === t.key || open === t.key;
          const first = i === 0;
          const last = i === DOCK_TOOLS.length - 1;
          // 평상시 22px만 노출, 스크롤 중엔 40px까지 양보(+흐리게), 호버/열림 시 완전 노출.
          const tx = peeked ? 0 : scrolling ? 40 : 22;
          return (
            <button
              key={t.key}
              onMouseEnter={() => setHover(t.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setOpen(open === t.key ? null : t.key)}
              style={{
                background: t.color,
                transform: `translateX(${tx}px)`,
                opacity: !peeked && scrolling ? 0.35 : 1,
                borderRadius: `${first ? 12 : 0}px 0 0 ${last ? 12 : 0}px`,
                boxShadow: '-4px 4px 14px rgba(16,24,48,.22)',
              }}
              className="flex w-8 flex-col-reverse items-center gap-2 pb-3.5 pt-3 text-white transition-[transform,opacity] duration-200"
            >
              <span className="rotate-[-90deg] text-base leading-none">{t.icon}</span>
              <span className="text-[12.5px] font-bold tracking-wide [writing-mode:sideways-lr]">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 슬라이드 패널 */}
      <aside
        style={{ width: PANEL_W, right: open ? 0 : -(PANEL_W + 12) }}
        className="fixed bottom-0 top-0 z-[73] flex flex-col bg-bg shadow-[-12px_0_40px_rgba(16,24,48,0.25)] transition-[right] duration-300"
      >
        {tool && tool.key === 'gw' && <GroupwarePanel onClose={() => setOpen(null)} />}
        {tool && tool.key !== 'gw' && (
          <>
            <DockHeader tool={tool} onClose={() => setOpen(null)} />
            <div className="menu-scroll min-h-0 flex-1 overflow-y-auto">
              {tool.key === 'bot' && <ChatbotPanel />}
              {tool.key === 'msg' && <MessengerPanel />}
              {tool.key === 'app' && <AppStorePanel />}
              {tool.key === 'edu' && <EduPanel />}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function DockHeader({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  return (
    <header style={{ background: tool.color }} className="flex h-14 shrink-0 items-center justify-between px-4">
      <span className="flex items-center gap-2.5 text-white">
        <span className="text-[17px]">{tool.icon}</span>
        <span className="text-[14.5px] font-extrabold">{tool.label}</span>
      </span>
      <button onClick={onClose} title="닫기" className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-white/20 text-[15px] text-white">
        ›
      </button>
    </header>
  );
}

/** 도크 패널 공용 카드(흰 배경 + 틸 액센트 바). */
function DockCard({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-3.5 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-sm bg-teal" />
        <span className="text-[12.5px] font-bold text-ink">{title}</span>
        {count && <span className="rounded-full bg-danger/10 px-[7px] py-px text-[10px] font-extrabold text-danger">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------- 그룹웨어 (앱 타일 그리드 + 결재 + 공지) ---------- */
function GroupwarePanel({ onClose }: { onClose: () => void }) {
  const CYAN = '#16b8cf';
  const apps = [
    { l: '전자결재', icon: '🖋️', badge: '3', hot: true },
    { l: '일정관리', icon: '📅', hot: true },
    { l: '메일', icon: '✉️', hot: true },
    { l: '자원예약', icon: '📦', badge: '99+' },
    { l: '전자설문', icon: '📋' },
    { l: '게시판', icon: '📌' },
    { l: '커뮤니티', icon: '💬' },
    { l: '문서관리', icon: '🗂️', badge: '9' },
    { l: '인명관리', icon: '👥' },
    { l: '업무관리', icon: '📗' },
    { l: '휴가관리', icon: '🏖️' },
    { l: '조직도', icon: '🏢' },
  ];
  const approvals: [string, string, string][] = [
    ['연차 휴가 신청', '김철수 · 생산1팀', '대기'],
    ['설비 구매 품의서', '이순신 · 설비보전팀', '대기'],
    ['외주 가공 계약 검토', '유관순 · 구매팀', '진행'],
  ];
  const notices: [string, string][] = [
    ['[필독] 2분기 안전점검 일정 안내', '06.18'],
    ['하계 휴가 신청 마감 안내', '06.16'],
    ['사내 동호회 지원금 신청', '06.12'],
  ];
  return (
    <div className="flex h-full flex-col bg-[#eaf7fb]">
      {/* 프로필 헤더 */}
      <header className="flex shrink-0 items-center gap-3 px-4 pb-[18px] pt-4" style={{ background: 'linear-gradient(135deg, #34d2de, #14b6cf)' }}>
        <img src={profilePhoto} alt="홍채원" className="h-[54px] w-[54px] shrink-0 rounded-full border-2 border-white/75 object-cover" />
        <div className="min-w-0 flex-1 text-white">
          <div className="text-[15.5px] font-extrabold tracking-tight">홍채원 <span className="text-[11.5px] font-semibold opacity-90">사원</span></div>
          <div className="mt-0.5 text-[10.5px] opacity-90">개발팀 · 사원</div>
        </div>
        <button title="알림" className="relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/20 text-[14px] text-white">
          🔔
          <span className="absolute -right-[3px] -top-[3px] grid h-[15px] min-w-[15px] place-items-center rounded-full border-[1.5px] border-white bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white">1</span>
        </button>
        <button onClick={onClose} title="닫기" className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-white/20 text-[16px] text-white">›</button>
      </header>

      {/* 앱 타일 + 결재 + 공지 (스크롤) */}
      <div className="menu-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        <div className="grid grid-cols-4 gap-2">
          {apps.map((a, i) => (
            <button key={i} className="relative flex aspect-square flex-col overflow-hidden rounded-xl border border-[#dcecf1] bg-panel shadow-[0_1px_5px_rgba(20,120,140,0.07)]">
              <div className="truncate px-1.5 py-[5px] text-left text-[9px] font-bold" style={{ background: a.hot ? CYAN : 'transparent', color: a.hot ? '#fff' : '#2a3344' }}>{a.l}</div>
              <div className="grid flex-1 place-items-center pb-0.5"><span className="text-[17px] leading-none">{a.icon}</span></div>
              {a.badge && <span className="absolute right-1 grid h-[14px] min-w-[14px] place-items-center rounded-full border-[1.5px] border-white bg-[#ff5b5b] px-[3px] text-[8px] font-extrabold text-white" style={{ top: a.hot ? 4 : 5 }}>{a.badge}</span>}
            </button>
          ))}
        </div>

        <DockCard title="결재 대기" count="2">
          {approvals.map((a, i) => (
            <div key={i} className={`flex items-center gap-2.5 py-2.5 ${i < approvals.length - 1 ? 'border-b border-border' : ''}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a[2] === '대기' ? 'bg-amber' : 'bg-blue'}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink">{a[0]}</div>
                <div className="text-[10px] text-ink3">{a[1]}</div>
              </div>
              <Pill tone={a[2] === '대기' ? 'warn' : 'info'}>{a[2]}</Pill>
            </div>
          ))}
        </DockCard>

        <DockCard title="공지사항">
          {notices.map((n, i) => (
            <div key={i} className={`flex justify-between gap-2 py-[9px] ${i < notices.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="truncate text-[11.5px] font-medium text-ink2">{n[0]}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-ink3">{n[1]}</span>
            </div>
          ))}
        </DockCard>
      </div>
    </div>
  );
}

/* ---------- 챗봇 ---------- */
function ChatbotPanel() {
  const chips = ['오늘 생산 실적 알려줘', '설비 알람 현황', '재고 부족 품목', '결재 상신 방법'];
  const msgs: { who: 'bot' | 'me'; t: string }[] = [
    { who: 'bot', t: '안녕하세요, 김승기님 👋\nMES 도우미입니다. 무엇을 도와드릴까요?' },
    { who: 'me', t: '오늘 M-Line 생산 실적 알려줘' },
    { who: 'bot', t: '오늘 M-Line 실적은 4,182 EA로 목표 대비 104.5% 달성했습니다. 종합 가동률(OEE)은 87.4%입니다. 📈' },
    { who: 'me', t: '불량률은 어때?' },
    { who: 'bot', t: '현재 불량률은 312 PPM으로 전일 대비 6.1% 개선됐어요. 주요 결함은 Scratch(LB-1001)입니다.' },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.who === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[82%] gap-2 ${m.who === 'me' ? 'flex-row-reverse' : 'flex-row'}`}>
              {m.who === 'bot' && <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-teal-soft text-[14px] text-teal">✦</span>}
              <div className={`whitespace-pre-line rounded-xl px-3 py-2.5 text-[12px] leading-relaxed shadow-[0_1px_2px_rgba(16,24,48,0.05)] ${m.who === 'me' ? 'bg-blue text-white' : 'border border-border bg-panel text-ink'}`}>{m.t}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border bg-panel p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {chips.map((c, i) => <span key={i} className="cursor-pointer rounded-full bg-teal-soft px-2.5 py-[5px] text-[10.5px] font-semibold text-teal">{c}</span>)}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border-hi bg-panel py-1.5 pl-4 pr-1.5">
          <span className="flex-1 text-[12px] text-ink3">메시지를 입력하세요…</span>
          <button className="grid h-[34px] w-[34px] place-items-center rounded-full bg-teal text-[14px] text-white">↑</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 메신저 ---------- */
function MessengerPanel() {
  const chats = [
    { name: '생산1팀 단톡방', last: '교대 인수인계 완료했습니다', t: '14:21', n: 3, grp: true, color: '#e6960c' },
    { name: '이순신 (설비보전)', last: 'CMP02 점검 끝났어요', t: '14:05', n: 1, color: '#3a6ee0' },
    { name: '품질보증팀', last: 'SPC 룰 위반 건 확인 부탁', t: '13:48', n: 0, grp: true, color: '#17a89a' },
    { name: '유관순 (현장관리)', last: '👍', t: '13:30', n: 0, color: '#e0483b' },
    { name: '공지방 · MES 운영', last: '[공지] v5.2 배포 안내', t: '11:02', n: 0, grp: true, color: '#1f2f55' },
    { name: '강감찬 (생산2팀)', last: '자재 입고 언제 되나요?', t: '어제', n: 0, color: '#8b5cf6' },
  ];
  return (
    <div>
      <div className="border-b border-border bg-panel px-4 py-3">
        <div className="flex items-center gap-2 rounded-full border border-border-hi px-3.5 py-2">
          <span className="text-[12px] text-ink3">🔍</span>
          <span className="text-[11.5px] text-ink3">이름, 채팅방 검색</span>
        </div>
      </div>
      {chats.map((c, i) => (
        <button key={i} className="flex w-full items-center gap-3 border-b border-border bg-panel px-4 py-3 text-left transition-colors hover:bg-panel-alt">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[17px] font-bold" style={{ background: c.color + '22', color: c.color }}>{c.grp ? '👥' : c.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-2">
              <span className="truncate text-[12.5px] font-bold text-ink">{c.name}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-ink3">{c.t}</span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2">
              <span className="truncate text-[11.5px] text-ink3">{c.last}</span>
              {c.n > 0 && <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-danger px-[5px] text-[9.5px] font-extrabold text-white">{c.n}</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- App Store (업무용 웹앱) ---------- */
function AppStorePanel() {
  const cats = ['전체', '생산', '품질', '설비', '물류', '안전', '분석'];
  const featured = { name: '설비 예지보전 AI', tag: 'NEW', desc: '센서 데이터로 고장 시점을 예측해 비가동을 줄입니다.', icon: '🤖', rating: '4.8', installs: '1.2k' };
  const apps = [
    { name: 'QR 작업지시', cat: '생산', icon: '📲', color: '#3a6ee0', desc: 'QR 스캔으로 작업 시작/종료 등록', rating: '4.7', state: 'installed' },
    { name: '실시간 OEE 보드', cat: '분석', icon: '📊', color: '#17a89a', desc: '라인별 종합효율 실시간 모니터', rating: '4.9', state: 'get' },
    { name: '불량 사진 리포트', cat: '품질', icon: '📷', color: '#e0483b', desc: '현장 불량 촬영·분류·자동 집계', rating: '4.5', state: 'get' },
    { name: '재고 스캐너', cat: '물류', icon: '📦', color: '#e6960c', desc: '바코드로 입출고·실사 처리', rating: '4.6', state: 'installed' },
    { name: '안전점검 체크', cat: '안전', icon: '🦺', color: '#16a34a', desc: '일일 안전점검 체크리스트', rating: '4.4', state: 'get' },
    { name: '설비 점검 일지', cat: '설비', icon: '🛠️', color: '#56607a', desc: 'PM 일정·점검 이력 기록', rating: '4.3', state: 'get' },
    { name: '교대 인수인계', cat: '생산', icon: '🔁', color: '#8b5cf6', desc: '교대조 간 인수인계 노트 공유', rating: '4.6', state: 'update' },
    { name: 'SPC 관리도', cat: '품질', icon: '📈', color: '#0ea5e9', desc: '공정 통계 관리도·이상 알림', rating: '4.8', state: 'get' },
  ];
  const [cat, setCat] = useState('전체');
  const list = cat === '전체' ? apps : apps.filter((a) => a.cat === cat);
  const stateStyle = (s: string) => {
    if (s === 'installed') return { label: '열기', cls: 'bg-bg-deep text-ink2' };
    if (s === 'update') return { label: '업데이트', cls: 'bg-blue-soft text-blue' };
    return { label: '받기', cls: 'bg-[#ece9fd] text-[#6c5ce7]' };
  };
  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* 카테고리 칩 */}
      <div className="menu-scroll flex gap-[7px] overflow-x-auto pb-0.5">
        {cats.map((c, i) => (
          <button key={i} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold ${cat === c ? 'bg-[#6c5ce7] text-white' : 'bg-panel-alt text-ink2'}`}>{c}</button>
        ))}
      </div>

      {/* 추천 앱 (히어로) */}
      {cat === '전체' && (
        <div className="flex flex-col gap-3 rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #7b6bf0, #5a4ad1)' }}>
          <span className="text-[10px] font-extrabold tracking-wider opacity-85">오늘의 추천</span>
          <div className="flex items-center gap-3">
            <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-white/20 text-[27px]">{featured.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14.5px] font-extrabold">{featured.name}</span>
                <span className="rounded bg-[#ffd54a] px-1.5 py-px text-[8px] font-extrabold text-[#5a4ad1]">{featured.tag}</span>
              </div>
              <div className="mt-0.5 text-[10.5px] leading-snug opacity-90">{featured.desc}</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] opacity-90">★ {featured.rating} · 설치 {featured.installs}</span>
            <button className="rounded-full bg-white px-5 py-[7px] text-[11.5px] font-extrabold text-[#5a4ad1]">받기</button>
          </div>
        </div>
      )}

      {/* 앱 리스트 */}
      <div className="flex flex-col gap-2">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[12.5px] font-extrabold text-ink">{cat === '전체' ? '업무 앱' : cat + ' 앱'}</span>
          <span className="text-[10.5px] text-ink3">{list.length}개</span>
        </div>
        {list.map((a, i) => {
          const st = stateStyle(a.state);
          return (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < list.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]" style={{ background: a.color + '1a', color: a.color }}>{a.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-bold text-ink">{a.name}</span>
                  <span className="shrink-0 rounded bg-panel-alt px-1.5 py-px text-[9px] font-bold text-ink3">{a.cat}</span>
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-ink3">{a.desc}</div>
                <div className="mt-0.5 text-[10px] text-ink3">★ {a.rating}</div>
              </div>
              <button className={`shrink-0 rounded-full px-[15px] py-[7px] text-[11px] font-extrabold ${st.cls}`}>{st.label}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 교육 (직원 교육 콘텐츠) ---------- */
function EduPanel() {
  const cats = ['전체', '필수', '직무', '안전', '품질', '리더십'];
  const [cat, setCat] = useState('전체');
  const inProgress = { title: '신규 입사자 안전보건 교육', chapter: '3 / 8 차시', percent: 38, due: 'D-5' };
  const courses = [
    { title: '산업안전보건 법정교육', cat: '필수', icon: '🦺', color: '#16a34a', dur: '50분', lessons: 6, state: '필수', badge: 'D-5' },
    { title: 'SPC 공정관리 기초', cat: '품질', icon: '📈', color: '#0ea5e9', dur: '1시간 20분', lessons: 9, state: '수강중', progress: 38 },
    { title: '설비 TPM 자주보전', cat: '직무', icon: '🛠️', color: '#56607a', dur: '45분', lessons: 5, state: '받기' },
    { title: '화학물질 취급 안전', cat: '안전', icon: '⚗️', color: '#e0483b', dur: '35분', lessons: 4, state: '필수', badge: 'D-12' },
    { title: '데이터로 보는 생산성', cat: '직무', icon: '📊', color: '#17a89a', dur: '1시간', lessons: 7, state: '받기' },
    { title: '현장 리더의 소통법', cat: '리더십', icon: '🤝', color: '#6c5ce7', dur: '55분', lessons: 6, state: '완료' },
    { title: '품질 4대 도구 실습', cat: '품질', icon: '🔧', color: '#3a6ee0', dur: '1시간 10분', lessons: 8, state: '받기' },
    { title: '직장 내 괴롭힘 예방', cat: '필수', icon: '🛡️', color: '#e6960c', dur: '40분', lessons: 4, state: '완료' },
  ];
  const list = cat === '전체' ? courses : courses.filter((c) => c.cat === cat);
  const stBtn = (s: string) => {
    if (s === '수강중') return { label: '이어보기', cls: 'bg-[#e0567a] text-white' };
    if (s === '완료') return { label: '복습', cls: 'bg-bg-deep text-ink2' };
    return { label: s === '필수' ? '시작' : '수강', cls: 'bg-[#fde8ee] text-[#e0567a]' };
  };
  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      {/* 카테고리 칩 */}
      <div className="menu-scroll flex gap-[7px] overflow-x-auto pb-0.5">
        {cats.map((c, i) => (
          <button key={i} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold ${cat === c ? 'bg-[#e0567a] text-white' : 'bg-panel-alt text-ink2'}`}>{c}</button>
        ))}
      </div>

      {/* 이어보기(진행 중) */}
      {cat === '전체' && (
        <div className="flex flex-col gap-2.5 rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #ec6f8e, #d44d72)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold tracking-wider opacity-90">이어보기</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[9.5px] font-extrabold">{inProgress.due}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-[14px] bg-white/20 text-[24px]">▶</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-extrabold">{inProgress.title}</div>
              <div className="mt-0.5 text-[10.5px] opacity-90">{inProgress.chapter}</div>
            </div>
          </div>
          <div>
            <div className="h-1.5 rounded bg-white/30"><div className="h-full rounded bg-white" style={{ width: `${inProgress.percent}%` }} /></div>
            <div className="mt-1.5 flex justify-between text-[10px]">
              <span className="opacity-90">진행률 {inProgress.percent}%</span>
              <span className="font-bold">이어보기 ▸</span>
            </div>
          </div>
        </div>
      )}

      {/* 학습 요약 */}
      {cat === '전체' && (
        <div className="grid grid-cols-3 gap-2">
          {([['이수', '12', 'text-[#e0567a]'], ['진행중', '2', 'text-[#0ea5e9]'], ['미이수', '3', 'text-amber']] as const).map((s, i) => (
            <div key={i} className="rounded-[11px] border border-border bg-panel px-2 py-[11px] text-center">
              <div className={`text-[18px] font-extrabold ${s[2]}`}>{s[1]}</div>
              <div className="mt-px text-[10px] font-semibold text-ink3">{s[0]}</div>
            </div>
          ))}
        </div>
      )}

      {/* 강의 리스트 */}
      <div className="flex flex-col gap-2">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[12.5px] font-extrabold text-ink">{cat === '전체' ? '추천 과정' : cat + ' 과정'}</span>
          <span className="text-[10.5px] text-ink3">{list.length}개</span>
        </div>
        {list.map((c, i) => {
          const b = stBtn(c.state);
          return (
            <div key={i} className={`flex items-center gap-3 py-2.5 ${i < list.length - 1 ? 'border-b border-border' : ''}`}>
              <span className="relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl text-[20px]" style={{ background: c.color + '1a', color: c.color }}>
                {c.icon}
                {c.badge && <span className="absolute -right-[5px] -top-[5px] rounded-full border-[1.5px] border-white bg-danger px-[5px] py-px text-[8px] font-extrabold text-white">{c.badge}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[12.5px] font-bold text-ink">{c.title}</span>
                  {c.cat === '필수' && <span className="shrink-0 rounded bg-[#fde8ee] px-1.5 py-px text-[8.5px] font-extrabold text-[#e0567a]">필수</span>}
                </div>
                <div className="mt-[3px] text-[10.5px] text-ink3">⏱ {c.dur} · {c.lessons}차시 · {c.cat}</div>
                {c.progress != null && (
                  <div className="mt-1.5 h-1 rounded-[3px] bg-bg-deep"><div className="h-full rounded-[3px] bg-[#e0567a]" style={{ width: `${c.progress}%` }} /></div>
                )}
              </div>
              <button className={`shrink-0 rounded-full px-3.5 py-[7px] text-[11px] font-extrabold ${b.cls}`}>{b.label}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
