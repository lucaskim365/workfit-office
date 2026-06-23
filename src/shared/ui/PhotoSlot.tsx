interface PhotoSlotProps {
  label?: string;
  className?: string;
  height?: number;
}

/** 사진 자리표시자 — 와이어프레임 image-slot 대응(끌어다 놓기 영역). */
export function PhotoSlot({ label = '사진', className = '', height }: PhotoSlotProps) {
  return (
    <div
      style={height ? { height } : undefined}
      className={`grid place-items-center rounded-lg border border-dashed border-border-hi bg-panel-alt text-[10px] font-medium text-ink3 ${className}`}
    >
      {label}
    </div>
  );
}
