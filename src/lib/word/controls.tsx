/** 도구 막대 부품 — 단추·구분선·색 고르기·펼침 상자(글자 도구 막대와 표 도구 막대가 같이 쓴다) */
import type { ReactNode } from 'react';

export function Btn({ on, title, onClick, children, disabled }: { on?: boolean; title: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-7 min-w-7 rounded px-1.5 text-[12.5px] leading-none ${on ? 'bg-[#dbe6f7] text-[#1d4ed8]' : 'text-[#333] hover:bg-[#eef1f5]'} disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

export const Sep = () => <span className="mx-0.5 h-5 w-px bg-[#d4dbe7]" />;

export const SELECT_CLS = 'h-7 rounded border border-[#d4dbe7] bg-white px-1 text-[12px] text-[#333] outline-none';

/** 펼침 상자 안 단추에서 상자 닫기 */
export function closePopover(el: Element): void {
  el.closest('details')?.removeAttribute('open');
}

/** 누르면 아래로 펼쳐지는 상자 */
export function Popover({ title, face, width = 132, children }: { title: string; face: ReactNode; width?: number; children: ReactNode }) {
  return (
    <details className="relative">
      <summary title={title} className="flex h-7 min-w-7 cursor-pointer list-none items-center justify-center rounded px-1.5 text-[12.5px] text-[#333] hover:bg-[#eef1f5]">
        {face}
        <span className="ml-0.5 text-[9px] text-[#8b95ab]">▾</span>
      </summary>
      <div className="absolute left-0 top-8 z-30 rounded-lg border border-[#d4dbe7] bg-white p-2 shadow-lg" style={{ width }}>
        {children}
      </div>
    </details>
  );
}

/** 색 칸들 — 고르면 상자를 닫는다 */
export function Swatches({ colors, current, onPick, noneLabel = '없음' }: { colors: string[]; current?: string | null; onPick: (v: string | null) => void; noneLabel?: string | null }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {colors.map((col) => (
        <button
          key={col}
          type="button"
          title={col}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            onPick(col);
            closePopover(e.currentTarget);
          }}
          className={`h-5 w-5 rounded border ${current === col ? 'border-[#1d4ed8] ring-1 ring-[#1d4ed8]' : 'border-[#d4dbe7]'}`}
          style={{ background: col }}
        />
      ))}
      {noneLabel && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            onPick(null);
            closePopover(e.currentTarget);
          }}
          className="col-span-5 mt-1 rounded border border-[#d4dbe7] py-0.5 text-[11px] text-[#56607a] hover:bg-[#eef1f5]"
        >
          {noneLabel}
        </button>
      )}
    </div>
  );
}

export function Palette({ title, colors, current, onPick, face }: { title: string; colors: string[]; current?: string | null; onPick: (v: string | null) => void; face: ReactNode }) {
  return (
    <Popover title={title} face={face}>
      <Swatches colors={colors} current={current} onPick={onPick} />
    </Popover>
  );
}
