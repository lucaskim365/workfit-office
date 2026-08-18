import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { widdyChatRepo } from '@/data/widdyChat/widdyChat.repo';
import type { WiddyMessage, WiddyAttachment } from '@/domain/widdyChat/schema';
import { nowLocalIso } from '@/shared/lib/datetime';
import { getWiddyToken } from '@/data/widdyChat/widdyAuth';

/**
 * Widdy 챗봇 대화 훅 — 메시지 상태 + 낙관적 전송 + 게이트웨이 호출.
 * ([[data-layer-pattern]] 정본 패턴 / [[Widdy_RAG_연계_개발_계획서.md]] §10.1)
 *
 * ChatbotPanel 은 이 훅만 소비한다(백엔드/인증/API 는 repo 가 안다).
 */

/** 초기 인사. */
const GREETING = '안녕하세요,👋\nWiddy입니다. 사내 문서에 대해 무엇이든 물어보세요.';

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function useWiddyChat() {
  const [messages, setMessages] = useState<WiddyMessage[]>(() => [
    { id: makeId(), role: 'assistant', content: GREETING, citations: [], at: nowLocalIso(), status: 'done' },
  ]);
  const sessionRef = useRef<string>(makeId());

  const mutation = useMutation({
    mutationFn: (vars: {
      query: string;
      history: { role: 'user' | 'assistant'; content: string }[];
      attachment?: WiddyAttachment;
    }) =>
      // 서명 토큰을 게이트웨이로 전달 → 서버가 검증해 신뢰된 uid 로 ACL 판정.
      // (토큰 없음/만료 시 익명 — public 문서+일반질문만) [[widdyAuth]]
      widdyChatRepo.ask({
        query: vars.query,
        token: getWiddyToken() ?? undefined,
        sessionId: sessionRef.current,
        history: vars.history,
        attachment: vars.attachment,
      }),
  });

  const send = useCallback(
    (raw: string, attachment?: WiddyAttachment) => {
      const query = raw.trim();
      // 질문 또는 첨부 중 하나는 있어야 전송(첨부만 있으면 요약).
      if ((!query && !attachment) || mutation.isPending) return;
      const at = nowLocalIso();
      const userMsg: WiddyMessage = {
        id: makeId(),
        role: 'user',
        content: query || (attachment ? '이 파일을 요약해 주세요.' : ''),
        citations: [],
        at,
        status: 'done',
        attachmentName: attachment?.name,
      };
      const pendingId = makeId();
      const pending: WiddyMessage = { id: pendingId, role: 'assistant', content: '', citations: [], at, status: 'pending' };

      // 전송 전 대화(멀티턴 컨텍스트) — 오류 메시지는 제외.
      const history = messages
        .filter((m) => m.status !== 'error')
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, pending]);

      mutation.mutate(
        { query, history, attachment },
        {
          onSuccess: (res) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId ? { ...m, content: res.answer, citations: res.citations, status: 'done' } : m,
              ),
            ),
          onError: (e) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? { ...m, content: (e as Error).message || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', status: 'error' }
                  : m,
              ),
            ),
        },
      );
    },
    [messages, mutation],
  );

  return { messages, send, isSending: mutation.isPending };
}
