import { z } from 'zod';

/**
 * 금형 입·출고/위치(MoldLocation) 도메인 스키마 — 단일 진실 공급원(SSOT).
 * 설계서 금형위치 moldLocations. PK=code. 조회전용.
 * (와이어프레임 mold-location.jsx 의 인라인 LOC_ROWS 이관)
 */
export const moldLocationSchema = z.object({
  /** 금형/치공구 코드 (PK). */
  code: z.string().min(1, '금형 코드는 필수입니다'),
  name: z.string().min(1, '금형명은 필수입니다'),
  /** 분류 — 사출금형·프레스금형·지그·게이지 등. */
  cat: z.string().default(''),
  /** 지정(홈) 위치. */
  home: z.string().default(''),
  /** 현재 위치 / 점유처. */
  cur: z.string().default(''),
  /** 점유 담당(팀/업체). */
  holder: z.string().default(''),
  /** 상태 — 보관중·대출중·외부수리·이동중. */
  state: z.string().default(''),
  /** 현재 상태 시작일(MM-DD). */
  since: z.string().default(''),
});

export type MoldLocation = z.infer<typeof moldLocationSchema>;
