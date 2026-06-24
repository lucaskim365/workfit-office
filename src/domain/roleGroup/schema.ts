import { z } from 'zod';

/**
 * 역할그룹(RoleGroup) 도메인 스키마 — RBAC 권한그룹 + 메뉴권한 매트릭스.
 * 운영 시 Auth custom claims + Security Rules 로 강제. ([[데이터_모델_설계서.md]] roleGroups)
 */
export const PERM_MENUS = [
  '시스템관리', '사용자관리', '그룹권한관리', '공통코드정보',
  '품목정보', '설비정보', '불량항목정보', '접속이력관리',
] as const;
export const PERM_COLS = ['보기', '조회', '신규', '저장', '삭제', '엑셀'] as const;

export const memberSchema = z.object({ name: z.string(), code: z.string() });

export const roleGroupSchema = z.object({
  code: z.string().min(1, '역할그룹코드는 필수입니다'),
  name: z.string().min(1, '역할그룹명은 필수입니다'),
  desc: z.string().default(''),
  use: z.boolean().default(true),
  members: z.array(memberSchema).default([]),
  /** 메뉴권한 매트릭스 [PERM_MENUS index][PERM_COLS index]. */
  permissions: z.array(z.array(z.boolean())).default([]),
});

export type Member = z.infer<typeof memberSchema>;
export type RoleGroup = z.infer<typeof roleGroupSchema>;
