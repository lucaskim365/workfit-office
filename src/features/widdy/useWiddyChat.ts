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

/** 느린 응답 대기 안내 문구. 첨부는 항상 로컬 분석(느림) → 즉시, 그 외는 지연 시에만. */
const HINT_ATTACH = '📎 첨부 파일을 분석하고 있어요. 내용이 길면 시간이 조금 걸릴 수 있어요…';
const HINT_DOC = '📄 사내 문서를 찾아보는 중이에요. 잠시만 기다려 주세요…';
/** 일반질문(Groq)은 대개 이 시간 안에 끝남 → 이보다 오래 걸리면 사내문서 검색으로 보고 안내. */
const HINT_DELAY_MS = 2500;

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
      onToken: (delta: string) => void;
    }) =>
      // 서명 토큰을 게이트웨이로 전달 → 서버가 검증해 신뢰된 uid 로 ACL 판정.
      // (토큰 없음/만료 시 익명 — public 문서+일반질문만) [[widdyAuth]]
      // askStream: http 드라이버는 SSE(토큰 스트리밍), function/stub 은 한 번에 폴백(동일 인터페이스).
      widdyChatRepo.askStream(
        {
          query: vars.query,
          token: getWiddyToken() ?? undefined,
          sessionId: sessionRef.current,
          history: vars.history,
          attachment: vars.attachment,
        },
        vars.onToken,
      ),
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
      // 첨부는 항상 로컬 분석(느림)이 확정 → 즉시 안내. 그 외는 지연되면(HINT_DELAY_MS) 안내.
      const pending: WiddyMessage = {
        id: pendingId, role: 'assistant', content: '', citations: [], at, status: 'pending',
        hint: attachment ? HINT_ATTACH : undefined,
      };

      // 전송 전 대화(멀티턴 컨텍스트) — 오류 메시지는 제외.
      const history = messages
        .filter((m) => m.status !== 'error')
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg, pending]);

      // 첨부가 없을 때: 응답이 늦으면(=사내문서 검색·로컬 생성) 안내 문구 노출.
      let hintTimer: ReturnType<typeof setTimeout> | undefined;
      if (!attachment) {
        hintTimer = setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingId && m.status === 'pending' ? { ...m, hint: HINT_DOC } : m)),
          );
        }, HINT_DELAY_MS);
      }
      const clearHintTimer = () => { if (hintTimer) clearTimeout(hintTimer); };

      // 스트리밍 델타 → pending 메시지 content 에 누적. 첫 토큰에 안내 타이머 해제.
      // (status 는 'pending' 유지 → onSuccess 에서 최종 답변·출처로 확정하며 'done')
      const onToken = (delta: string) => {
        clearHintTimer();
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId ? { ...m, content: (m.content || '') + delta, hint: undefined } : m)),
        );
      };

      mutation.mutate(
        { query, history, attachment, onToken },
        {
          onSuccess: (res) => {
            clearHintTimer();
            // 최종 확정: 서버가 준 authoritative answer·citations 로 덮어써 스트림 누적과 일치 보장.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId ? { ...m, content: res.answer, citations: res.citations, status: 'done', hint: undefined } : m,
              ),
            );
          },
          onError: (e) => {
            clearHintTimer();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingId
                  ? { ...m, content: (e as Error).message || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', status: 'error', hint: undefined }
                  : m,
              ),
            );
          },
        },
      );
    },
    [messages, mutation],
  );

  return { messages, send, isSending: mutation.isPending };
}
