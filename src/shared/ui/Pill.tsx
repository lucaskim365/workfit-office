import type { ReactNode } from 'react';

export type Tone = 'info' | 'ok' | 'warn' | 'err' | 'mute';

const SOFT: Record<Tone, string> = {
  info: 'text-blue bg-blue/10',
  ok: 'text-ok bg-ok/10',
  warn: 'text-amber bg-amber/10',
  err: 'text-danger bg-danger/10',
  mute: 'text-ink3 bg-ink3/10',
};

const SOLID: Record<Tone, string> = {
  info: 'text-white bg-blue',
  ok: 'text-white bg-ok',
  warn: 'text-white bg-amber',
  err: 'text-white bg-danger',
  mute: 'text-white bg-ink3',
};

/** 상태 배지 — 와이어프레임 shared.jsx Pill 정본 이관. */
export function Pill({
  children,
  tone = 'info',
  solid = false,
}: {
  children: ReactNode;
  tone?: Tone;
  solid?: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${
        solid ? SOLID[tone] : SOFT[tone]
      }`}
    >
      {children}
    </span>
  );
}
