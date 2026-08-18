import { capsIngestPayloadSchema, formatPayloadIssue } from './schema';
import { upsertCapsPayload } from './upsert';
import { verifyCapsRequest } from './verify';
import type { CapsStore } from './store';

/**
 * 런타임 무관 요청 처리 — 계약 §2·§6.
 *
 * Vercel 함수(`api/ingest.ts`)와 로컬 수신 서버(`scripts/caps-ingest-dev.ts`)가 같은
 * 함수를 쓴다. 호출부의 유일한 책임은 **파싱 전 raw body 문자열**과 헤더를 그대로
 * 넘기는 것이다.
 */
export interface CapsIngestRequest {
  rawBody: string;
  timestamp: string | undefined;
  signature: string | undefined;
  secret: string;
  store: CapsStore;
  now?: Date;
}

export interface CapsIngestResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handleCapsIngest(input: CapsIngestRequest): Promise<CapsIngestResponse> {
  const now = input.now ?? new Date();

  const verdict = verifyCapsRequest(
    input.secret,
    input.timestamp,
    input.signature,
    input.rawBody,
    Math.floor(now.getTime() / 1000),
  );
  // 401 본문은 최소화한다(계약 §6). 서명이 왜 틀렸는지는 공격자에게도 힌트가 된다.
  if (verdict !== 'ok') return { status: 401, body: { ok: false, error: 'unauthorized' } };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: 'invalid_payload', detail: 'body is not valid JSON' } };
  }

  const parsed = capsIngestPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      status: 400,
      body: { ok: false, error: 'invalid_payload', detail: formatPayloadIssue(parsed.error) },
    };
  }

  try {
    const upserted = await upsertCapsPayload(input.store, parsed.data, now);
    return { status: 200, body: { ok: true, upserted } };
  } catch (caught) {
    // 실패 사유를 syncMeta에 남긴다(계약 §4). 이것마저 실패하면 응답만 남긴다.
    try {
      input.store.mergeSet('syncMeta', 'caps', {
        lastError: caught instanceof Error ? caught.message : String(caught),
      });
      await input.store.flush();
    } catch {
      // 무시 — 대응은 5xx 응답을 본 에이전트의 재시도가 한다.
    }
    return { status: 500, body: { ok: false, error: 'internal' } };
  }
}
