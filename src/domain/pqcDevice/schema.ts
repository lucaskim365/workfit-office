import { z } from 'zod';

/**
 * PQC 설비·계측 데이터 인터페이스(PqcDevice) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 *
 * 설계서 PQC 설비계측 인터페이스 pqcDevices. PK=id. 조회전용.
 * (와이어프레임 qual-pqc-interface.jsx 의 인라인 Device mock 이관)
 */
export const PQC_STATUS = ['연결', '지연', '단절'] as const;

/** 태그 ↔ 검사항목 매핑(임베드). */
export const pqcTagSchema = z.object({
  tag: z.string(),
  item: z.string(),
  unit: z.string(),
  spec: z.string(),
});

/** 실시간 수집 스트림(임베드). val은 화면이 string|number 혼용. */
export const pqcStreamSchema = z.object({
  t: z.string(),
  item: z.string(),
  val: z.union([z.string(), z.number()]),
  res: z.string(),
});

export const pqcDeviceSchema = z.object({
  id: z.string().min(1, '디바이스 ID는 필수입니다'),
  name: z.string(),
  dev: z.string(),
  proto: z.string(),
  ep: z.string(),
  loc: z.string(),
  status: z.enum(PQC_STATUS),
  last: z.string(),
  today: z.number(),
  err: z.number(),
  lat: z.number(),
  auto: z.number(),
  spark: z.array(z.number()),
  tags: z.array(pqcTagSchema),
  stream: z.array(pqcStreamSchema),
});

export type PqcTag = z.infer<typeof pqcTagSchema>;
export type PqcStream = z.infer<typeof pqcStreamSchema>;
export type PqcDevice = z.infer<typeof pqcDeviceSchema>;
