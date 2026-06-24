import { z } from 'zod';

/**
 * 백업 정책 backupPolicies. PK=id. 조회전용.
 * 시스템 관리 / 데이터 백업 화면의 백업·삭제 정책 마스터.
 * (와이어프레임 sys-screens-2.DataBackupContent 의 인라인 POLICIES 이관)
 */
export const backupPolicySchema = z.object({
  /** PK — 정책 식별자(대상 데이터명 기반 슬러그). */
  id: z.string().min(1, '정책 ID는 필수입니다'),
  /** 대상 데이터명. */
  name: z.string().min(1, '대상 데이터명은 필수입니다'),
  /** 백업 주기. */
  cycle: z.string().default(''),
  /** 보관 기간. */
  keep: z.string().default(''),
  /** 처리 방식. */
  after: z.string().default(''),
  /** 예상 용량. */
  size: z.string().default(''),
  /** 활성 여부. */
  on: z.boolean().default(false),
});

export type BackupPolicy = z.infer<typeof backupPolicySchema>;
