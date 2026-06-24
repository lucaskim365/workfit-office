import { z } from 'zod';

/**
 * 시스템 관리자 sysAdmins. PK=id. (기준정보 users와 별개)
 * 시스템 관리 화면 전용 관리자 계정 마스터 — 조회 마스터.
 * 폼 검증·Firestore 검증·타입을 모두 이 스키마에서 파생한다.
 * RDB 이관 시 이 정의가 곧 테이블 DDL이 된다. ([[DB_이관_대비_설계원칙.md]] 원칙 5)
 */
export const SYS_ADMIN_LEVELS = ['슈퍼관리자', '시스템관리자', '운영관리자'] as const;
export const SYS_ADMIN_STATUS = ['사용', '잠금', '미사용'] as const;
export const SYS_ADMIN_TWOFA = ['ON', 'OFF'] as const;

export const sysAdminSchema = z.object({
  /** 계정 ID(PK). */
  id: z.string().min(1, '계정 ID는 필수입니다'),
  name: z.string().min(1, '성명은 필수입니다'),
  level: z.enum(SYS_ADMIN_LEVELS),
  /** 담당 모듈(표시 문구). */
  modules: z.string().default(''),
  status: z.enum(SYS_ADMIN_STATUS).default('사용'),
  /** 2단계 인증 사용 여부. */
  twoFa: z.enum(SYS_ADMIN_TWOFA).default('OFF'),
  /** 접속 IP 제한(CIDR). 제한 없으면 '-'. */
  ip: z.string().default('-'),
  /** 마지막 로그인 일시(YYYY-MM-DD HH:mm). */
  lastLogin: z.string().default(''),
});

export type SysAdmin = z.infer<typeof sysAdminSchema>;
