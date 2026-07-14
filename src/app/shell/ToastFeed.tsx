import { useEffect, useRef, useState } from 'react';
import { registerToastListener } from '@/features/notification/useNotifications';

interface ToastData {
  type: string;
  who: string;
  text: string;
  icon: string;
  color: string;
}

const TOAST_VISIBLE = 4200;
const TOAST_ANIM = 450;

interface ToastItem {
  id: number;
  data: ToastData;
  leaving: boolean;
}

/** 우하단 실시간 알림 토스트 피드 — Live Notification 구독으로 실시간 토스트 노출 */
export function ToastFeed() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const uid = useRef(0);

  useEffect(() => {
    return registerToastListener((data) => {
      const id = ++uid.current;
      setItems((list) => [...list, { id, data, leaving: false }]);
      
      setTimeout(() => {
        setItems((list) => list.map((it) => (it.id === id ? { ...it, leaving: true } : it)));
        setTimeout(() => setItems((list) => list.filter((it) => it.id !== id)), TOAST_ANIM + 50);
      }, TOAST_VISIBLE);
    });
  }, []);

  const close = (id: number) => setItems((list) => list.filter((x) => x.id !== id));

  return (
    <div className="pointer-events-none fixed bottom-[18px] right-[18px] z-[80] flex flex-col items-end gap-2.5">
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            borderLeft: `3px solid ${it.data.color}`,
            transform: it.leaving ? 'translateX(24px)' : 'translateX(0)',
            opacity: it.leaving ? 0 : 1,
            transition: `opacity ${TOAST_ANIM}ms ease, transform ${TOAST_ANIM}ms cubic-bezier(.4,0,.2,1)`,
            animation: it.leaving ? 'none' : 'toast-in .4s cubic-bezier(.4,0,.2,1)',
          }}
          className="pointer-events-auto flex w-80 items-start gap-3 rounded-[13px] border border-border bg-panel px-3.5 py-[13px] shadow-[0_12px_32px_rgba(16,24,48,0.18)]"
        >
          <span
            style={{ background: `${it.data.color}1a`, color: it.data.color }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[17px]"
          >
            {it.data.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <span style={{ color: it.data.color, background: `${it.data.color}14` }} className="rounded-[5px] px-[7px] py-px text-[9.5px] font-extrabold">
                {it.data.type}
              </span>
              <span className="truncate text-[11.5px] font-bold text-ink">{it.data.who}</span>
            </div>
            <div className="text-[11.5px] leading-snug text-ink2">{it.data.text}</div>
          </div>
          <button onClick={() => close(it.id)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[13px] text-ink3 hover:text-ink">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
