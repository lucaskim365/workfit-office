/**
 * 시트 서식 편집기 도움말 — [도움말]을 누르면 화면의 부분을 하나씩 밝게 비추며 쓰는 법을 짧게 알려 준다.
 * 비출 곳은 화면 요소의 data-tour 값으로 찾는다(없으면 화면 가운데에 설명만).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type TourSide = 'cell' | 'settings' | 'history';

export interface TourStep {
  /** 비출 곳(data-tour 값) — 없으면 화면 가운데 */
  target?: string;
  /** 이 단계에서 열어 둘 옆 패널 탭 */
  side?: TourSide;
  title: string;
  /** 줄바꿈(\n)마다 한 줄 */
  body: string;
}

export const SHEET_EDITOR_TOUR: TourStep[] = [
  {
    title: '시트 서식 편집기',
    body: '엑셀처럼 문서 틀을 그리고, 기안자가 채울 칸을 정하는 곳입니다.\n순서는 ① 틀 그리기 → ② 칸에 부품 넣기 → ③ 미리보기 → ④ 저장입니다.\n[다음]을 눌러 화면을 하나씩 둘러보세요.',
  },
  {
    target: 'info',
    title: '서식 정보',
    body: '서식 이름, 문서에 찍힐 큰 제목(격식 문서명), 들어갈 폴더를 정합니다.\n연동 기능을 고르면 휴가·출장처럼 결재가 끝난 뒤 다른 화면에 저절로 반영됩니다.',
  },
  {
    target: 'sheet',
    title: '시트 — 문서 틀',
    body: '칸을 누르고 글자를 쓰면 됩니다. 끌어서 여러 칸을 한 번에 고릅니다.\n빗금 칸은 기안자가 고칠 수 없는 칸, 세로 점선은 A4 인쇄 폭입니다.\n행·열 머리 경계를 끌면 크기가 바뀝니다.',
  },
  {
    target: 'toolbar',
    title: '도구 막대',
    body: '글씨 굵기·색·정렬·테두리, 칸 병합, 행·열 추가와 삭제가 여기 있습니다.\n[문서 보기]는 실제 문서 모양, [격자 보기]는 엑셀 모양입니다.\n[칸 표시]를 켜면 필수·잠금 같은 칸 설정이 작은 표시로 보입니다.',
  },
  {
    target: 'palette',
    side: 'cell',
    title: '부품 — 칸 종류 넣기',
    body: '칸을 고르고 부품을 누르거나, 부품을 칸으로 끌어다 놓습니다.\n\'기안자가 쓰는 칸\'은 날짜·금액·선택처럼 기안자가 채우는 칸, \'저절로 채워지는 칸\'은 기안자·문서번호처럼 시스템이 채우는 칸입니다.\n넣은 부품은 하늘색으로 보이고, [빼기]로 뺍니다.',
  },
  {
    target: 'side',
    side: 'cell',
    title: '칸 속성',
    body: '고른 칸을 자세히 정합니다 — 고를 항목, 필수 입력, 수정 잠금, 직인 자리 등.\n선택 칸에서는 고른 값에 따라 보일 행이나 다른 칸의 항목을 바꿀 수 있습니다.\n아래 \'이 줄\'에서는 기안자가 행을 늘릴 수 있는 반복 구간을 정합니다.',
  },
  {
    target: 'side',
    side: 'settings',
    title: '서식 설정',
    body: '문서 전체에 걸리는 설정입니다 — 보존연한, 맺음말, 작성·열람 권한, 기본 수신·참조, 결재선 규칙.',
  },
  {
    target: 'side',
    side: 'history',
    title: '버전 기록',
    body: '저장할 때마다 새 버전이 쌓입니다. 이미 쓴 문서는 그때 버전 모양 그대로 남습니다.\n예전 버전을 미리 보거나 되살릴 수 있고, 저장 전에 메모를 적어 두면 나중에 찾기 쉽습니다.',
  },
  {
    target: 'actions',
    title: '불러오기 · 미리보기 · 저장',
    body: '[엑셀 불러오기] 쓰던 엑셀 양식(.xlsx)을 틀로 가져옵니다.\n[미리보기] 기안 화면과 결재 화면 모양을 저장 전에 확인합니다.\n[서식 저장] 저장해야 반영됩니다. \'사용\'을 켜면 기안 서식 목록에 나옵니다.',
  },
];

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const CARD_W = 320;
const GAP = 12;
const PAD = 6;

/** data-tour 값이 같은 요소 중 화면에 보이는 첫 번째 */
function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function SheetEditorTour({ steps = SHEET_EDITOR_TOUR, onStep, onClose }: { steps?: TourStep[]; onStep?: (step: TourStep) => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** 비출 곳 — 화면 전체를 덮는 바탕(root) 기준 자리. 못 찾으면 null(가운데 설명만) */
  const [box, setBox] = useState<Box | null>(null);
  const [cardPos, setCardPos] = useState<{ left: number; top: number } | null>(null);

  // 단계가 바뀌면 그 단계의 탭을 열고, 비출 곳이 화면 밖이면 보이는 곳으로 옮긴다
  useEffect(() => {
    onStep?.(step);
    (document.activeElement as HTMLElement | null)?.blur?.();
    const t = setTimeout(() => {
      const el = step.target ? findTarget(step.target) : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: r.height > window.innerHeight ? 'start' : 'center' });
    }, 0);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  // 비출 곳의 자리를 계속 맞춘다(스크롤·창 크기·탭 전환으로 움직임).
  // 화면 글자 배율(body zoom) 때문에 화면 좌표와 바탕 안 좌표가 다를 수 있어, 바탕의 '화면 폭 ÷ 안쪽 폭'으로 나눠 맞춘다
  useEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const rr = root.getBoundingClientRect();
      const k = root.offsetWidth ? rr.width / root.offsetWidth : 1;
      const el = step.target ? findTarget(step.target) : null;
      if (!el) return setBox((b) => (b ? null : b));
      const r = el.getBoundingClientRect();
      // 화면 밖으로 나간 부분은 잘라 낸다(긴 시트·옆 패널)
      const left = Math.max(r.left, rr.left);
      const top = Math.max(r.top, rr.top);
      const next = {
        left: (left - rr.left) / k - PAD,
        top: (top - rr.top) / k - PAD,
        width: (Math.min(r.right, rr.right) - left) / k + PAD * 2,
        height: (Math.min(r.bottom, rr.bottom) - top) / k + PAD * 2,
      };
      setBox((b) => (b && Math.abs(b.left - next.left) < 0.5 && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.width - next.width) < 0.5 && Math.abs(b.height - next.height) < 0.5 ? b : next));
    };
    measure();
    const timer = setInterval(measure, 150);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step.target]);

  // 설명 카드 자리 — 비춘 곳의 오른쪽 → 왼쪽 → 아래 → 위 순으로 들어가는 곳에, 다 안 되면 비춘 곳 안 오른쪽 아래
  useLayoutEffect(() => {
    const root = rootRef.current;
    const card = cardRef.current;
    if (!root || !card) return;
    const W = root.offsetWidth;
    const H = root.offsetHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const clampX = (x: number) => Math.max(GAP, Math.min(x, W - cw - GAP));
    const clampY = (y: number) => Math.max(GAP, Math.min(y, H - ch - GAP));
    if (!box) return setCardPos({ left: (W - cw) / 2, top: Math.max(GAP, (H - ch) / 2) });
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    if (W - right >= cw + GAP * 2) setCardPos({ left: right + GAP, top: clampY(box.top) });
    else if (box.left >= cw + GAP * 2) setCardPos({ left: box.left - cw - GAP, top: clampY(box.top) });
    else if (H - bottom >= ch + GAP * 2) setCardPos({ left: clampX(box.left), top: bottom + GAP });
    else if (box.top >= ch + GAP * 2) setCardPos({ left: clampX(box.left), top: box.top - ch - GAP });
    else setCardPos({ left: clampX(right - cw - GAP * 2), top: clampY(bottom - ch - GAP * 2) });
  }, [box, i]);

  // 글쇠 — Esc 닫기, ←/→(Enter) 이전·다음. 뒤의 편집기로는 넘기지 않는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') (e.preventDefault(), last ? onClose() : setI(i + 1));
      else if (e.key === 'ArrowLeft') (e.preventDefault(), setI(Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [i, last, onClose]);

  return createPortal(
    // 바탕이 화면을 덮어 뒤의 편집기는 눌리지 않는다(둘러보는 동안 실수로 바뀌지 않게)
    <div ref={rootRef} className="fixed inset-0 z-[1000] overflow-hidden" role="dialog" aria-modal="true" aria-label="편집기 도움말">
      {box ? (
        <div
          className="absolute rounded-xl ring-2 ring-teal transition-all duration-200"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: 'rgba(15, 23, 42, 0.55)' }} />
      )}
      <div
        ref={cardRef}
        className="absolute rounded-xl border border-border bg-panel p-4 shadow-2xl transition-[left,top] duration-200"
        style={{ width: CARD_W, left: cardPos?.left ?? 0, top: cardPos?.top ?? 0, visibility: cardPos ? 'visible' : 'hidden' }}
      >
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-teal">
            {i + 1} / {steps.length}
          </span>
          <button type="button" onClick={onClose} title="도움말 닫기 (Esc)" aria-label="도움말 닫기" className="text-ink3 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-1.5 text-[14px] font-extrabold text-ink">{step.title}</div>
        <div className="space-y-1 text-[12px] leading-relaxed text-ink2">
          {step.body.split('\n').map((line, n) => (
            <p key={n}>{line}</p>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, n) => (
              <span key={n} className={`h-1.5 w-1.5 rounded-full ${n === i ? 'bg-teal' : 'bg-border-hi'}`} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink">
                이전
              </button>
            )}
            <button type="button" onClick={() => (last ? onClose() : setI(i + 1))} className="rounded-lg bg-teal px-3.5 py-1.5 text-[12px] font-bold text-white hover:opacity-90">
              {last ? '마침' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
