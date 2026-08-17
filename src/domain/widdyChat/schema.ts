import { z } from 'zod';

/**
 * Widdy(위디) 챗봇 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 사내 문서 기반 RAG 질의응답. ([[Widdy_RAG_연계_개발_계획서.md]] §5, §10)
 *
 * 저장/전송 shape 은 계획서 §10.2 API 계약과 일치한다.
 * 백엔드(RAG 게이트웨이)는 data/widdyChat/widdyChat.repo 뒤에 격리된다.
 */

/** 답변 근거 출처(citation) — 검색된 문서 청크 1건. */
export const citationSchema = z.object({
  /** 연결된 앱 문서 ID(결재문서 등). 없으면 빈 문자열. */
  docId: z.string().default(''),
  /** 원본 소스 키(예: Garage key `approvals/....xlsx`) 또는 파일명. */
  source: z.string().default(''),
  /** 문서 내 청크 인덱스. */
  chunkIdx: z.number().default(0),
  /** 원본으로 이동할 URL(Garage 공개 URL 등). 없으면 표시만. */
  url: z.string().optional(),
});
export type Citation = z.infer<typeof citationSchema>;

export const WIDDY_ROLES = ['user', 'assistant'] as const;
export type WiddyRole = (typeof WIDDY_ROLES)[number];

/** 대화 메시지 상태 — 스트리밍/오류 렌더 분기용(전송 결과에는 저장 안 함). */
export type WiddyStatus = 'pending' | 'done' | 'error';

/** Widdy 대화 메시지 1건. */
export const widdyMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(WIDDY_ROLES),
  content: z.string().default(''),
  /** assistant 답변의 근거 출처. user 메시지는 빈 배열. */
  citations: z.array(citationSchema).default([]),
  /** 생성 시각(ISO). */
  at: z.string(),
});
export type WiddyMessage = z.infer<typeof widdyMessageSchema> & {
  /** UI 전용 상태(도메인 저장 대상 아님). */
  status?: WiddyStatus;
};

/** 게이트웨이 질의 파라미터. */
export interface WiddyAskParams {
  query: string;
  sessionId: string;
  /** 직전 대화(멀티턴 컨텍스트). role/content 만 전달. */
  history?: { role: WiddyRole; content: string }[];
}

/** 게이트웨이 응답(비스트리밍 MVP). */
export const widdyAskResultSchema = z.object({
  answer: z.string().default(''),
  citations: z.array(citationSchema).default([]),
  sessionId: z.string().default(''),
});
export type WiddyAskResult = z.infer<typeof widdyAskResultSchema>;
