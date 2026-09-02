import { Functions } from 'appwrite';
import { client } from '@/shared/lib/appwrite';
import {
  widdyAskResultSchema,
  type Citation,
  type WiddyAskParams,
  type WiddyAskResult,
} from '@/domain/widdyChat/schema';

/** 스트리밍 토큰 콜백 — 조각(delta)이 도착할 때마다 호출된다. */
export type OnToken = (delta: string) => void;

/**
 * Widdy 챗봇 Repository — RAG 게이트웨이 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[Widdy_RAG_연계_개발_계획서.md]] §10)
 *
 * 게이트웨이(백엔드)는 아래 어댑터 뒤에 격리되며 환경변수로 선택한다.
 *   1) VITE_WIDDY_CHAT_URL     → HTTP(S) POST (DMZ 게이트웨이, 계획서 옵션 B)
 *   2) VITE_WIDDY_FUNCTION_ID  → Appwrite Function 실행 (계획서 옵션 A, 세션 인증)
 *   3) 둘 다 미설정            → 데모 스텁(graceful degrade, UI 개발/시연 유지)
 *
 * UI(ChatbotPanel)·features(useWiddyChat)는 이 파일의 ask() 만 호출한다.
 * 게이트웨이 교체 = 이 어댑터 구현 하나만 바꾸는 작업. 화면 무손상.
 */

type Driver = 'http' | 'function' | 'stub';

function selectDriver(): Driver {
  if (import.meta.env.VITE_WIDDY_CHAT_URL) return 'http';
  if (import.meta.env.VITE_WIDDY_FUNCTION_ID && client) return 'function';
  return 'stub';
}

/** 게이트웨이 응답(임의 JSON)을 도메인 결과로 안전 정규화. */
function normalize(raw: unknown, sessionId: string): WiddyAskResult {
  const parsed = widdyAskResultSchema.safeParse(raw);
  if (parsed.success) {
    return { ...parsed.data, sessionId: parsed.data.sessionId || sessionId };
  }
  // answer 만 문자열로 온 경우 등 관대하게 수용.
  const answer =
    typeof (raw as { answer?: unknown })?.answer === 'string'
      ? (raw as { answer: string }).answer
      : typeof raw === 'string'
        ? raw
        : '';
  return { answer, citations: [], sessionId };
}

// ─────────────────────────────────────────────────────────────
// 1) HTTP 게이트웨이 (DMZ, 인증 게이트 포함) — 계획서 옵션 B
//    (MVP: 비스트리밍 JSON. 스트리밍(SSE)은 후속 고도화.)
// ─────────────────────────────────────────────────────────────
async function askHttp(params: WiddyAskParams): Promise<WiddyAskResult> {
  const url = import.meta.env.VITE_WIDDY_CHAT_URL as string;
  const token = import.meta.env.VITE_WIDDY_CHAT_TOKEN as string | undefined;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Widdy 응답 실패 (${res.status})`);
  return normalize(await res.json(), params.sessionId);
}

// ─────────────────────────────────────────────────────────────
// 1-S) HTTP 게이트웨이 스트리밍(SSE) — /chat/stream
//    server3 chat_service 가 event: meta|token|done 프레임을 흘려보낸다.
//    체감 지연(첫 토큰) 대폭↓. Appwrite Function 은 스트리밍 불가 → http 드라이버 전용.
// ─────────────────────────────────────────────────────────────
/** VITE_WIDDY_CHAT_URL(…/chat) 로부터 스트림 URL(…/chat/stream) 도출. 명시 override: VITE_WIDDY_STREAM_URL. */
function streamUrl(): string {
  const explicit = import.meta.env.VITE_WIDDY_STREAM_URL as string | undefined;
  if (explicit) return explicit;
  const base = import.meta.env.VITE_WIDDY_CHAT_URL as string;
  return base.endsWith('/chat') ? `${base}/stream` : base.replace(/\/?$/, '/stream');
}

async function askHttpStream(params: WiddyAskParams, onToken: OnToken): Promise<WiddyAskResult> {
  const token = import.meta.env.VITE_WIDDY_CHAT_TOKEN as string | undefined;
  const res = await fetch(streamUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  if (!res.ok || !res.body) throw new Error(`Widdy 스트림 실패 (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let answer = '';
  let citations: Citation[] = [];
  let sessionId = params.sessionId;

  const dispatch = (event: string, dataStr: string) => {
    let data: { t?: unknown; citations?: unknown; sessionId?: unknown };
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (event === 'meta') {
      if (Array.isArray(data.citations)) citations = data.citations as Citation[];
      if (typeof data.sessionId === 'string' && data.sessionId) sessionId = data.sessionId;
    } else if (event === 'token') {
      const t = typeof data.t === 'string' ? data.t : '';
      if (t) {
        answer += t;
        onToken(t);
      }
    }
  };

  // SSE 프레임 파서: 프레임 구분 "\n\n", 프레임 내 event:/data: 라인.
  const drain = () => {
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) dispatch(event, dataLines.join('\n'));
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    drain();
  }
  buf += decoder.decode();
  drain();

  return { answer, citations, sessionId };
}

// ─────────────────────────────────────────────────────────────
// 2) Appwrite Function 게이트웨이 — 계획서 옵션 A (세션 인증 자동)
// ─────────────────────────────────────────────────────────────
async function askFunction(params: WiddyAskParams): Promise<WiddyAskResult> {
  const functionId = import.meta.env.VITE_WIDDY_FUNCTION_ID as string;
  const functions = new Functions(client!);
  // createExecution(functionId, body?, async?, path?, method?) — body 는 문자열.
  const exec = await functions.createExecution(functionId, JSON.stringify(params), false);
  let body: unknown = exec.responseBody;
  try {
    body = JSON.parse(exec.responseBody);
  } catch {
    /* 문자열 그대로 → normalize 가 처리 */
  }
  return normalize(body, params.sessionId);
}

// ─────────────────────────────────────────────────────────────
// 3) 데모 스텁 — 백엔드 미연결 시 UI 유지(graceful degrade)
// ─────────────────────────────────────────────────────────────
async function askStub(params: WiddyAskParams): Promise<WiddyAskResult> {
  await new Promise((r) => setTimeout(r, 350)); // 응답 지연 흉내
  return {
    answer:
      '🔧 Widdy RAG 게이트웨이가 아직 연결되지 않았습니다(데모 모드).\n' +
      '질문은 정상 접수되었습니다. VITE_WIDDY_CHAT_URL 또는 VITE_WIDDY_FUNCTION_ID 연결 시 ' +
      '사내 문서를 근거로 답변합니다.\n\n' +
      `— 입력하신 질문: “${params.query}”`,
    citations: [],
    sessionId: params.sessionId,
  };
}

export const widdyChatRepo = {
  /** 질의 → 답변+출처. 백엔드는 환경변수로 선택(미설정 시 데모 스텁). */
  async ask(params: WiddyAskParams): Promise<WiddyAskResult> {
    switch (selectDriver()) {
      case 'http':
        return askHttp(params);
      case 'function':
        return askFunction(params);
      default:
        return askStub(params);
    }
  },

  /**
   * 질의 → 스트리밍 답변. http 드라이버에서만 실제 SSE(체감 첫토큰↓).
   * function/stub 드라이버는 스트리밍을 지원하지 않으므로 비스트리밍 ask() 결과를
   * 한 번에 onToken 으로 흘려 동일 인터페이스를 유지(호출부 무분기). 최종 결과는 반환값으로 확정.
   */
  async askStream(params: WiddyAskParams, onToken: OnToken): Promise<WiddyAskResult> {
    if (selectDriver() === 'http') return askHttpStream(params, onToken);
    const r = await this.ask(params);
    if (r.answer) onToken(r.answer);
    return r;
  },
};
