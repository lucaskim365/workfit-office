import { z } from 'zod';

/**
 * 알람·에러 코드 마스터(AlarmMaster) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 2.4 알람코드 `alarmMasters`. PK=type. 조회전용.
 * 설비 유형(type) 1개 = 1 도큐먼트이며, 코드 목록(codes)을 type별로 임베드한다.
 */
export const AL_SEVERITY = ['중대', '경고', '주의'] as const;
export const AL_AUTO = ['자동', '수동'] as const;

/** 임베드 알람 코드 1건 — type 도큐먼트의 codes 배열 원소. */
export const codeSchema = z.object({
  code: z.string().min(1, '코드는 필수입니다'),
  name: z.string().min(1, '알람 명칭은 필수입니다'),
  /** 등급 — 중대/경고/주의. */
  sev: z.enum(AL_SEVERITY),
  /** 발생 부위. */
  part: z.string().default(''),
  /** 인터록 발생 여부. */
  il: z.boolean().default(false),
  /** 자동 복구 구분 — 자동/수동. */
  auto: z.enum(AL_AUTO),
  /** 최근 30일 발생 건수. */
  cnt: z.number().int().nonnegative().default(0),
  /** 발생 원인. */
  cause: z.string().default(''),
  /** 조치 가이드(단계별). */
  fix: z.array(z.string()).default([]),
  /** 연계 점검 항목. */
  chk: z.string().default(''),
  /** MTBA(평균 발생 간격). */
  mtba: z.string().default(''),
  /** 최근 발생 시각. */
  last: z.string().default(''),
});

export type AlarmCode = z.infer<typeof codeSchema>;

export const alarmMasterSchema = z.object({
  /** PK — 설비 유형(예: CMP). 문서 ID로 사용. */
  type: z.string().min(1, '설비 유형은 필수입니다'),
  codes: z.array(codeSchema).default([]),
});

export type AlarmMaster = z.infer<typeof alarmMasterSchema>;
