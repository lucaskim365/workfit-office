import { useEffect, useRef, useState } from 'react';

interface ToastData {
  type: string;
  who: string;
  text: string;
  icon: string;
  color: string;
}

const TOAST_SAMPLES: ToastData[] = [
  { type: '메신저', who: '이순신 (설비보전)', text: 'CMP02 점검 끝났어요. 가동 재개합니다.', icon: '✉', color: '#eecfa2' },
  { type: '메일', who: '품질보증팀', text: '[메일] SPC 룰 위반 건 확인 요청드립니다.', icon: '✉️', color: '#3a6ee0' },
  { type: '공지', who: 'MES 운영', text: 'v5.2 정기 배포 안내 (06/12 02:00)', icon: '📢', color: '#16b8cf' },
  { type: '알람', who: 'ETCH01', text: '챔버 온도 상한 근접 — 확인 필요', icon: '⚠️', color: '#e0483b' },
  { type: '메신저', who: '생산1팀 단톡방', text: '교대 인수인계 완료했습니다 👍', icon: '✉', color: '#eecfa2' },
  { type: '결재', who: '전자결재', text: '연차 휴가 신청이 승인되었습니다.', icon: '🖋️', color: '#6c5ce7' },
  { type: '메일', who: '구매팀', text: '[메일] PO-260611-05 입고 일정 변경', icon: '✉️', color: '#3a6ee0' },
  { type: '알람', who: 'OVEN05', text: '가스 유량 편차 발생 (WARN)', icon: '⚠️', color: '#e6960c' },
];

const TOAST_VISIBLE = 4200;
const TOAST_GAP = 1600;
const TOAST_ANIM = 450;

interface ToastItem {
  id: number;
  data: ToastData;
  leaving: boolean;
}

/** 우하단 실시간 알림 토스트 피드 — 와이어프레임 toast-feed.jsx 정본(샘플 순차 표시). */
export function ToastFeed() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idx = useRef(0);
  const uid = useRef(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const showNext = () => {
      const data = TOAST_SAMPLES[idx.current % TOAST_SAMPLES.length];
      idx.current += 1;
      const id = ++uid.current;
      setItems((list) => [...list, { id, data, leaving: false }]);
      timers.push(
        setTimeout(() => {
          setItems((list) => list.map((it) => (it.id === id ? { ...it, leaving: true } : it)));
          timers.push(setTimeout(() => setItems((list) => list.filter((it) => it.id !== id)), TOAST_ANIM + 50));
        }, TOAST_VISIBLE),
      );
      timers.push(setTimeout(showNext, TOAST_VISIBLE + TOAST_GAP));
    };
    timers.push(setTimeout(showNext, 1400));
    return () => timers.forEach(clearTimeout);
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
