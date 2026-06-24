import { z } from 'zod';

/**
 * 자재 외주불출 matSubconIssues. PK=no.
 * 외주(사급) 자재 출고 — 협력사 무상/유상 지급 내역의 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * ⚠ 생산 모듈 subconIssues 와 별개 컬렉션이다.
 */
export const SI_TYPES = ['무상', '유상'] as const;
/** 거래명세서 발행 상태. */
export const SI_ISSUE_STATUS = ['발행완료', '미발행'] as const;
/** 출고 진행 상태. */
export const SI_STATUS = ['출고완료', '출고대기'] as const;

export const matSubconIssueSchema = z.object({
  /** 출고번호(PK). 예: SI-260611-11 */
  no: z.string().min(1, '출고번호는 필수입니다'),
  /** 외주처(협력사). */
  vendor: z.string().min(1, '외주처는 필수입니다'),
  /** 품목 코드. */
  code: z.string().min(1, '품목 코드는 필수입니다'),
  /** 품목명. */
  name: z.string().min(1, '품목명은 필수입니다'),
  /** 출고 수량. */
  qty: z.number(),
  /** 사급유형 — 무상/유상. */
  type: z.enum(SI_TYPES),
  /** 명세서 발행 상태. */
  issueStatus: z.enum(SI_ISSUE_STATUS),
  /** 출고 상태. */
  status: z.enum(SI_STATUS),
  /** 강조(선택) 행 여부 — 화면 하이라이트용. */
  urgent: z.boolean().optional(),
});

export type MatSubconIssue = z.infer<typeof matSubconIssueSchema>;
