import { useState } from 'react';

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
        {tool && (
          <>
            <header style={{ background: tool.color }} className="flex h-14 shrink-0 items-center justify-between px-4">
              <span className="flex items-center gap-2.5 text-white">
                <span className="text-[17px]">{tool.icon}</span>
                <span className="text-[14.5px] font-extrabold">{tool.label}</span>
              </span>
              <button onClick={() => setOpen(null)} title="닫기" className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-white/20 text-[15px] text-white">
                ›
              </button>
            </header>
            <div className="grid flex-1 place-items-center text-center text-ink3">
              <div>
                <div className="mb-2 text-4xl opacity-40">{tool.icon}</div>
                <div className="text-[12.5px] font-semibold">{tool.label} 패널 — 연동 예정</div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
