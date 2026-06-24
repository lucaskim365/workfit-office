import { z } from 'zod';

/**
 * 설비 검교정 불합격 calFails. PK=no. 조회전용.
 * 폼·Firestore·타입을 모두 이 스키마에서 파생한다.
 * (와이어프레임 cal-fail.jsx 의 인라인 FAIL_ROWS 이관)
 */
export const calFailSchema = z.object({
  /** 불합격 실적번호(PK·문서ID). 채번 CR-YYMM-NNN. */
  no: z.string().min(1, '불합격 실적번호는 필수입니다'),
  /** 계측기 시리얼번호(자산). */
  sn: z.string().min(1, '계측기 SN은 필수입니다'),
  name: z.string().min(1, '계측기명은 필수입니다'),
  /** 계측기 분류(압력계·토크렌치 등). */
  cat: z.string().default(''),
  /** 불합격일(MM-DD). */
  failDate: z.string().default(''),
  /** 측정오차. */
  err: z.string().default(''),
  /** 허용범위(tolerance). */
  tol: z.string().default(''),
  /** 관리부서. */
  dept: z.string().default(''),
  /** 처리구분(미조치·사용중지·수리신청·폐기). */
  dispo: z.string().default('미조치'),
  /** 판정 의견. */
  note: z.string().default(''),
});

export type CalFail = z.infer<typeof calFailSchema>;
