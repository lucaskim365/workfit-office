import { z } from 'zod';

/**
 * 권한 역할 authRoles. PK=code. 조회전용.
 *
 * 시스템 관리 / 권한 관리 화면의 직무(역할) 마스터.
 * 메뉴별 [접근(조회), 수정] 권한 매트릭스를 함께 보관한다.
 * 메뉴 목록(MENUS)은 화면 상수이며, permissions 배열의 각 행이 그 순서에 1:1 대응한다.
 */
export const authRoleSchema = z.object({
  /** 역할 코드(PK). 예: OPERATOR, MANAGER. */
  code: z.string().min(1, '역할 코드는 필수입니다'),
  /** 역할명. 예: 작업자, 관리자. */
  name: z.string().min(1, '역할명은 필수입니다'),
  /** 메뉴별 [접근(조회), 수정] 권한. MENUS 순서와 동일한 길이·순서. */
  permissions: z.array(z.tuple([z.boolean(), z.boolean()])).default([]),
});

export type AuthRole = z.infer<typeof authRoleSchema>;
