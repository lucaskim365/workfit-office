import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, LayoutGrid, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import { arrange, mobilePath, type WidgetSlot } from '@/modules/exec/dashboard';
import {
  isHalf,
  loadLayout,
  MOBILE_DEFAULT_LAYOUT,
  mobileStorageKey,
  MODULES,
  placementsOf,
  WIDGET_IDS,
  WIDGETS,
  type WidgetId,
} from '@/modules/exec/registry';
import { WidgetLinkProvider, WidgetMiniProvider } from '@/modules/exec/widgets';

/**
 * 하단 탭 '경영 현황' — 휴대폰용 위젯 화면(2열). 요약을 지원하는 위젯은 반 칸, 나머지는 한 줄 전체.
 * 갤럭시 홈 화면처럼 위젯을 길게 누르면 편집 모드가 되고, 누른 채 끌어 자리를 옮긴다.
 * 편집 중에는 − 로 빼고, 오른쪽 아래 단추로 반 칸 ↔ 한 줄을 바꾸고, 아래 '위젯'으로 더한다.
 * 배치는 이 기기에 사용자별로 저장한다(데이터베이스는 건드리지 않는다). 위젯 안 링크는 모바일 화면으로 연다.
 */

type Slot = WidgetSlot<WidgetId>;
const HALF_H = 140;
const LONG_PRESS_MS = 450;
const EDIT_PRESS_MS = 160;
const MOVE_CANCEL_PX = 10;
const EDGE = 70;

/** 위젯 하나 — 반 칸이면 요약으로 그린다 */
function WidgetView({ slot }: { slot: Slot }) {
  const { Component } = WIDGETS[slot.id];
  return (
    <WidgetMiniProvider value={isHalf(slot)}>
      <Component />
    </WidgetMiniProvider>
  );
}

/** 위젯 더하기 시트의 미리보기 — 실제 위젯을 줄여 보인다 */
function SheetPreview({ id, placed, onAdd }: { id: WidgetId; placed: boolean; onAdd: () => void }) {
  const def = WIDGETS[id];
  const half = Boolean((def as { mini?: boolean }).mini);
  const cardW = half ? 150 : 236;
  const renderW = half ? 170 : 380;
  return (
    <button
      type="button"
      disabled={placed}
      onClick={onAdd}
      className={`flex shrink-0 flex-col gap-1.5 text-left ${placed ? 'opacity-45' : 'active:scale-[.97]'}`}
      style={{ width: cardW }}
    >
      <span className="relative block h-[132px] overflow-hidden rounded-2xl bg-[#e9f0f7]">
        <span className="pointer-events-none absolute top-2 left-2 block select-none" style={{ width: renderW, zoom: (cardW - 16) / renderW }} aria-hidden="true" inert>
          {half ? <span className="block" style={{ height: HALF_H }}><WidgetMiniProvider value><def.Component /></WidgetMiniProvider></span> : <def.Component />}
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#e9f0f7] to-transparent" />
      </span>
      <span className="truncate px-0.5 text-[12.5px] font-bold text-ink">{def.title}</span>
      {placed && <span className="-mt-1 px-0.5 text-[11px] text-ink3">배치됨</span>}
    </button>
  );
}

/** 위젯 더하기 — 모듈을 누르면 그 모듈의 위젯 미리보기가 옆으로 펼쳐진다 */
function WidgetSheet({ layout, onAdd, onClose }: { layout: Slot[]; onAdd: (id: WidgetId) => void; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(MODULES[0]);
  return createPortal(
    <div className="fixed inset-0 z-[140] flex flex-col justify-end bg-black/35" onClick={onClose}>
      <div
        role="dialog"
        aria-label="위젯"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[82vh] w-full max-w-[480px] flex-col rounded-t-[26px] bg-panel"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-[18px] font-extrabold text-ink">위젯</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-full text-ink3 active:bg-panel-alt"><X size={19} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {MODULES.map((m) => {
            const ids = WIDGET_IDS.filter((id) => WIDGETS[id].module === m);
            const on = open === m;
            return (
              <div key={m} className="border-b border-border last:border-0">
                <button type="button" onClick={() => setOpen(on ? null : m)} className="flex w-full items-center justify-between px-2 py-3.5">
                  <span className="text-[14.5px] font-bold text-ink">{m}</span>
                  <span className="flex items-center gap-2 text-[12px] text-ink3">
                    {ids.length}
                    <ChevronDown size={17} className={`transition-transform ${on ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {on && (
                  <div className="-mx-3 flex gap-3 overflow-x-auto px-5 pb-4">
                    {ids.map((id) => (
                      <SheetPreview key={id} id={id} placed={layout.some((s) => s.id === id)} onAdd={() => onAdd(id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface Drag { id: WidgetId; grabX: number; grabY: number; x: number; y: number; w: number; h: number }

export default function MobileExecScreen() {
  const { user } = useAuth();
  const [layout, setLayout] = useState<Slot[]>(() => loadLayout(user?.id, MOBILE_DEFAULT_LAYOUT, mobileStorageKey));
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** 놓일 자리(끄는 위젯을 뺀 목록에서의 순번) */
  const [at, setAt] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: WidgetId; x: number; y: number; timer: number } | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const dragRef = useRef<Drag | null>(null);
  const atRef = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => { setLayout(loadLayout(user?.id, MOBILE_DEFAULT_LAYOUT, mobileStorageKey)); }, [user?.id]);

  // 예전 웹 배치(칸 자리)가 있으면 그 순서를 따른다 — 처음 한 번 정리
  const ordered = (() => {
    if (!layout.some((s) => s.x !== undefined)) return layout;
    const boxes = arrange(placementsOf(layout));
    return [...layout].sort((a, b) => boxes.get(a.id)!.y - boxes.get(b.id)!.y || boxes.get(a.id)!.x - boxes.get(b.id)!.x).map(({ id, size }) => ({ id, size }));
  })();

  const save = (next: Slot[]) => {
    setLayout(next);
    if (!user?.id) return;
    try { localStorage.setItem(mobileStorageKey(user.id), JSON.stringify(next)); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

  const base = drag ? ordered.filter((s) => s.id !== drag.id) : ordered;
  const view = drag ? [...base.slice(0, at), ordered.find((s) => s.id === drag.id)!, ...base.slice(at)] : ordered;

  /** 화면 좌표 → 판(board) 안 좌표. 편집 중 판이 줄어 있어도 맞게 */
  const toBoard = (clientX: number, clientY: number) => {
    const board = boardRef.current!;
    const r = board.getBoundingClientRect();
    const scale = r.width ? board.offsetWidth / r.width : 1;
    return { x: (clientX - r.left) * scale, y: (clientY - r.top) * scale };
  };

  const beginDrag = (id: WidgetId) => {
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-mslot="${id}"]`);
    if (!el) return;
    setEditing(true);
    navigator.vibrate?.(12);
    suppressClick.current = true;
    const p = toBoard(last.current.x, last.current.y);
    const left = el.offsetLeft;
    const top = el.offsetTop;
    const d: Drag = { id, grabX: p.x - left, grabY: p.y - top, x: left, y: top, w: el.offsetWidth, h: el.offsetHeight };
    const start = ordered.findIndex((s) => s.id === id);
    dragRef.current = d;
    atRef.current = start;
    setAt(start);
    setDrag(d);
  };

  const onPointerDown = (id: WidgetId, e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-mbtn]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    last.current = { x: e.clientX, y: e.clientY };
    const timer = window.setTimeout(() => {
      press.current = null;
      beginDrag(id);
    }, editing ? EDIT_PRESS_MS : LONG_PRESS_MS);
    press.current = { id, x: e.clientX, y: e.clientY, timer };
  };

  // 끌기 — 손가락을 따라 위젯이 움직이고, 지나가는 위젯 앞뒤로 자리가 생긴다
  useEffect(() => {
    const scroller = scrollerRef.current;
    const cancelPress = () => {
      if (press.current) window.clearTimeout(press.current.timer);
      press.current = null;
    };
    const onMove = (e: PointerEvent) => {
      last.current = { x: e.clientX, y: e.clientY };
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_CANCEL_PX) cancelPress();
      const d = dragRef.current;
      if (!d || !boardRef.current) return;
      const pt = toBoard(e.clientX, e.clientY);
      const next = { ...d, x: pt.x - d.grabX, y: pt.y - d.grabY };
      dragRef.current = next;
      setDrag(next);
      // 지나가는 위젯 — 앞쪽 반이면 앞에, 뒤쪽 반이면 뒤에
      const others = ordered.filter((s) => s.id !== d.id);
      let target = atRef.current;
      for (const [j, s] of others.entries()) {
        const el = boardRef.current.querySelector<HTMLElement>(`[data-mslot="${s.id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
        const before = isHalf(s) ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
        target = before ? j : j + 1;
        break;
      }
      const boardRect = boardRef.current.getBoundingClientRect();
      if (e.clientY > boardRect.bottom - 10) target = others.length;
      if (target !== atRef.current) {
        atRef.current = target;
        setAt(target);
      }
      // 가장자리 가까이 가면 저절로 스크롤
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (e.clientY < sr.top + EDGE) scroller.scrollBy(0, -12);
        else if (e.clientY > sr.bottom - EDGE) scroller.scrollBy(0, 12);
      }
    };
    const onUp = () => {
      cancelPress();
      // 손을 뗀 바로 뒤에 오는 클릭만 막는다 — 그 뒤 누르는 단추는 그대로 눌린다
      if (suppressClick.current) window.setTimeout(() => { suppressClick.current = false; }, 0);
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      const slot = ordered.find((s) => s.id === d.id)!;
      const rest = ordered.filter((s) => s.id !== d.id);
      save([...rest.slice(0, atRef.current), slot, ...rest.slice(atRef.current)]);
      setDrag(null);
    };
    // 끄는 동안 화면이 같이 스크롤되지 않게
    const onTouchMove = (e: TouchEvent) => { if (dragRef.current) e.preventDefault(); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    scroller?.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      scroller?.removeEventListener('touchmove', onTouchMove);
    };
  });

  const remove = (id: WidgetId) => save(ordered.filter((s) => s.id !== id));
  const toggleSize = (id: WidgetId) => save(ordered.map((s) => (s.id === id ? { ...s, size: isHalf(s) ? 12 : 6 } : s)));
  const add = (id: WidgetId) => {
    save([...ordered, { id, size: (WIDGETS[id] as { mini?: boolean }).mini ? 6 : 12 }]);
    setSheet(false);
    requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' }));
  };

  const dragSlot = drag ? ordered.find((s) => s.id === drag.id) : undefined;

  return (
    <WidgetLinkProvider value={mobilePath}>
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overscroll-contain"
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          ref={boardRef}
          className={`relative grid grid-cols-2 gap-3 px-3 pt-3 pb-6 transition-transform duration-200 [grid-auto-flow:row_dense] ${editing ? 'origin-top scale-[.93]' : ''}`}
        >
          {view.map((slot) => {
            const half = isHalf(slot);
            const isDragged = drag?.id === slot.id;
            const canResize = Boolean((WIDGETS[slot.id] as { mini?: boolean }).mini);
            return (
              <div
                key={slot.id}
                data-mslot={slot.id}
                onPointerDown={(e) => onPointerDown(slot.id, e)}
                className={`relative min-w-0 select-none [-webkit-touch-callout:none] ${half ? 'col-span-1' : 'col-span-2'}`}
                style={half ? { height: HALF_H } : undefined}
              >
                {isDragged ? (
                  <div className="h-full min-h-[120px] rounded-[20px] border-2 border-dashed border-[#0876c8]/60 bg-[#0876c8]/[.06]" style={{ height: drag.h }} />
                ) : (
                  <div className={`h-full ${editing ? 'pointer-events-none rounded-[20px] ring-2 ring-white/90 ring-offset-0' : ''}`}>
                    <WidgetView slot={slot} />
                  </div>
                )}
                {editing && !isDragged && (
                  <>
                    <button
                      type="button"
                      data-mbtn
                      onClick={() => remove(slot.id)}
                      aria-label={`${WIDGETS[slot.id].title} 빼기`}
                      className="absolute -top-2 -left-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-[#5b6b80] text-white shadow-md active:scale-90"
                    >
                      <Minus size={16} strokeWidth={3} />
                    </button>
                    {canResize && (
                      <button
                        type="button"
                        data-mbtn
                        onClick={() => toggleSize(slot.id)}
                        aria-label={half ? `${WIDGETS[slot.id].title} 크게` : `${WIDGETS[slot.id].title} 작게`}
                        className="absolute -right-2 -bottom-2 z-10 grid h-7 w-7 place-items-center rounded-full border-2 border-[#0876c8] bg-panel text-[#0876c8] shadow-md active:scale-90"
                      >
                        {half ? <Maximize2 size={13} strokeWidth={2.6} /> : <Minimize2 size={13} strokeWidth={2.6} />}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {/* 손가락을 따라다니는 위젯 */}
          {drag && dragSlot && (
            <div
              className="pointer-events-none absolute z-50 scale-[1.04] rounded-[20px] shadow-[0_18px_40px_-12px_rgba(16,40,80,.45)]"
              style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
            >
              <WidgetView slot={dragSlot} />
            </div>
          )}
          {ordered.length === 0 && (
            <button
              type="button"
              onClick={() => { setEditing(true); setSheet(true); }}
              className="col-span-2 grid h-40 place-items-center rounded-[20px] border-2 border-dashed border-border text-[13px] font-bold text-ink3"
            >
              위젯 더하기
            </button>
          )}
        </div>

        {/* 편집 바 — 갤럭시 홈 편집처럼 아래에 */}
        {editing && (
          <div className="sticky bottom-0 z-20 flex items-center justify-center gap-3 bg-gradient-to-t from-[#f2f8fc] via-[#f2f8fc] to-transparent px-4 pt-6 pb-4">
            <button type="button" onClick={() => setSheet(true)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-panel text-[14px] font-bold text-ink shadow-md active:scale-[.98]">
              <LayoutGrid size={18} />위젯
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-12 flex-1 rounded-2xl bg-[#0876c8] text-[14px] font-bold text-white shadow-md active:scale-[.98]">
              완료
            </button>
          </div>
        )}
      </div>
      {sheet && <WidgetSheet layout={ordered} onAdd={add} onClose={() => setSheet(false)} />}
    </WidgetLinkProvider>
  );
}
