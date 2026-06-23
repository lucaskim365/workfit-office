interface ToggleProps {
  on: boolean;
  onChange?: (v: boolean) => void;
}

/** 토글 스위치 — 와이어프레임 S2Toggle 정본. */
export function Toggle({ on, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!on)}
      className={`inline-flex h-[22px] w-[38px] items-center rounded-full p-0.5 transition-colors ${
        on ? 'justify-end bg-teal' : 'justify-start bg-border-hi'
      }`}
    >
      <span className="h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
    </button>
  );
}
