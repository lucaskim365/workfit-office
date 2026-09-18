import { z } from 'zod';

/**
 * 역할 그룹 권한 변경 감사 로그 도메인 스키마 (roleGroupAuditLogs)
 * 
 * 엔터프라이즈 보안 감사 및 사후 추적성을 위한 인터셉터 데이터 모델.
 * 권한 생성, 수정, 삭제 시 변경 전/후의 Diff를 JSON 패치 형태로 영구 기록합니다.
 */
export const roleGroupAuditSchema = z.object({
  id: z.string().min(1),
  roleGroupId: z.string().min(1),
  roleCode: z.string().min(1),
  roleName: z.string().default(''),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  /** 변경된 필드들의 변경 전/후 값 스냅샷 */
  diff: z.record(z.string(), z.object({
    before: z.any().nullable().optional(),
    after: z.any().nullable().optional(),
  })),
  /** 수행자 정보 */
  performedBy: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    ip: z.string().optional(),
  }).optional(),
  /** 변경 일시 (ISO 문자열) */
  at: z.string(),
});

export type RoleGroupAudit = z.infer<typeof roleGroupAuditSchema>;
