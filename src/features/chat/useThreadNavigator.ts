import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { chatMessageRepo } from '@/data/chatMessage/chatMessage.repo';
import type { ChatMessage } from '@/domain/chatMessage/schema';
import { useThreadPaging } from './useChatThread';

/** 맨 위에서 이만큼(px) 안쪽으로 올라오면 옛 메시지를 더 받는다 — 끝에 닿기 전에 미리 */
const LOAD_OLDER_WITHIN_PX = 300;
const SEARCH_DEBOUNCE_MS = 250;

/** 말풍선 찾기 — 사진 묶음 속 메시지도 묶음 말풍선으로(data-msg-ids) */
function bubbleOf(box: HTMLElement | null, id: string): HTMLElement | null {
  if (!box) return null;
  return box.querySelector<HTMLElement>(`[data-msg-ids~="${CSS.escape(id)}"]`) ?? box.querySelector<HTMLElement>(`#msg-${CSS.escape(id)}`);
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * 방 화면(웹·모바일 공용) — 나눠 받은 메시지(최근 100건부터) 위에서의 스크롤·검색·이동.
 * - 맨 위 가까이 올리면 옛 메시지를 한 쪽 더 받고, 받은 뒤에도 보던 자리를 그대로 둔다.
 * - 검색은 서버에서도 찾는다(아직 안 받은 옛 메시지까지). 결과로 이동할 때 그 구간을 받아 온다. 처음엔 가장 최근 결과.
 * - reveal(id): 메시지가 안 받은 구간에 있으면 받아 온 뒤 그 말풍선을 돌려준다(답장 원문으로 이동).
 */
export function useThreadNavigator({
  roomId,
  messages,
  scrollRef,
  searchQuery,
}: {
  roomId: string;
  messages: ChatMessage[];
  scrollRef: RefObject<HTMLDivElement | null>;
  searchQuery: string;
}) {
  const paging = useThreadPaging(roomId);
  const { hasOlder, loading, loadOlder, loadSince } = paging;

  // ── 위로 올려 더 받기 ─────────────────────────────
  /** 더 받기 직전의 스크롤 높이·위치 — 앞에 붙은 만큼 내려 줘서 보던 메시지가 제자리에 있게 */
  const restoreRef = useRef<{ height: number; top: number } | null>(null);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > LOAD_OLDER_WITHIN_PX || !hasOlder || loading) return;
    restoreRef.current = { height: el.scrollHeight, top: el.scrollTop };
    loadOlder()
      .catch((e) => console.warn('[chat] 이전 메시지를 받지 못했습니다', e))
      // 받은 게 없어 화면이 그대로면 자리 맞추기를 거둔다(다음 변화에 엉뚱하게 적용되지 않게)
      .finally(() => requestAnimationFrame(() => (restoreRef.current = null)));
  }, [scrollRef, hasOlder, loading, loadOlder]);

  const firstId = messages[0]?.id;
  useLayoutEffect(() => {
    const r = restoreRef.current;
    const el = scrollRef.current;
    if (!r || !el) return;
    restoreRef.current = null;
    el.scrollTop = el.scrollHeight - r.height + r.top;
  }, [firstId, scrollRef]);

  // ── 원문·검색 결과로 이동 ─────────────────────────
  const firstIdRef = useRef(firstId);
  firstIdRef.current = firstId;
  const reveal = useCallback(
    async (id: string, at?: string): Promise<HTMLElement | null> => {
      const found = bubbleOf(scrollRef.current, id);
      // 받아 둔 것 중 맨 첫 메시지면 위로 조금 더 받는다 — 위에 아무것도 없으면 가운데로 못 오고 맨 위에 붙어 가려진다
      if (found && !(hasOlder && firstIdRef.current === id)) return found;
      const target = at ?? (await chatMessageRepo.get(id).catch(() => null))?.at;
      if (!target) return found;
      if (found) await loadOlder();
      else await loadSince(target);
      await nextFrame();
      await nextFrame();
      return bubbleOf(scrollRef.current, id);
    },
    [scrollRef, hasOlder, loadOlder, loadSince],
  );

  // ── 방 안 검색 ────────────────────────────────────
  const q = useDebounced(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const { data: hits } = useQuery({
    queryKey: ['chatSearch', roomId, q],
    queryFn: () => chatMessageRepo.searchText(roomId, q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
  /** 결과(시간 순) — 서버에서 찾은 것 + 받아 둔 메시지에서 찾은 것(방금 온 메시지는 서버 결과에 아직 없을 수 있다) */
  const matches = useMemo(() => {
    if (!q) return [];
    const k = q.toLowerCase();
    const byId = new Map<string, string>();
    for (const h of hits ?? []) byId.set(h.id, h.at);
    for (const m of messages) if (m.type !== 'system' && m.text?.toLowerCase().includes(k)) byId.set(m.id, m.at);
    return [...byId]
      .map(([id, at]) => ({ id, at }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [q, hits, messages]);

  /** 고른 결과 — -1 이면 가장 최근 결과 */
  const [picked, setPicked] = useState(-1);
  useEffect(() => setPicked(-1), [q, roomId]);
  // 서버 결과가 오면 그때의 가장 최근 결과로 고정 — 검색 중 새 메시지가 와도 보던 결과에서 움직이지 않게
  useEffect(() => {
    if (hits) setPicked((p) => (p < 0 && matches.length ? matches.length - 1 : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits]);
  const index = picked < 0 || picked >= matches.length ? matches.length - 1 : picked;
  const active = index >= 0 ? matches[index] : null;
  const prev = useCallback(() => matches.length && setPicked((index - 1 + matches.length) % matches.length), [index, matches.length]);
  const next = useCallback(() => matches.length && setPicked((index + 1) % matches.length), [index, matches.length]);

  const activeId = active?.id;
  const activeAt = active?.at;
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void reveal(activeId, activeAt).then((el) => {
      if (!cancelled) el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => {
      cancelled = true;
    };
    // 결과를 고를 때만 이동한다 — 메시지가 새로 와도 보던 결과에서 움직이지 않게
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return {
    hasOlder,
    loadingOlder: loading,
    onScroll,
    reveal,
    search: { count: matches.length, index, activeId: activeId ?? null, prev, next },
  };
}
