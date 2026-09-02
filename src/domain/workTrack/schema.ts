import { z } from 'zod';

/**
 * 프로젝트 트랙 — 영업·사업관리·개발처럼 **동시에 도는 레인**.
 * ([[프로젝트관리_고도화_계획서.md]] §2)
 *
 * 트랙 이름은 코드에 박힌 enum이 아니라 **프로젝트마다 정하는 데이터**다. 영업팀도
 * 사업관리팀도 각자 자체 사업을 하고, 어느 구분에도 맞지 않는 사업도 있기 때문에
 * 유형(수주/자체)이 트랙 구성을 제약하지 않는다.
 *
 * 개수는 0~N개다. 0개면 트랙 레이어 자체가 없고 대과업이 최상위가 된다.
 * 프로젝트를 만들 때 `DEFAULT_TRACK_NAMES` 3개를 템플릿으로 채워주지만 강제가 아니다.
 *
 * ⚠ 트랙은 **과업이 아니다.** 담당자·기간·진행률을 입력받지 않고 이름·순서·색만 가진다.
 *    트랙의 진행률은 그 트랙에 직속된 대과업들에서 계산해 낸다([[rollup.ts]]).
 */
export const workTrackSchema = z.object({
  id: z.string().regex(/^TRK-\d{4}$/, '트랙 ID 형식이 올바르지 않습니다.'),
  projectId: z.string().regex(/^PRJ-\d{4}$/, '프로젝트 ID 형식이 올바르지 않습니다.'),
  name: z.string().trim().min(1, '트랙 이름을 입력하세요.').max(40),
  sortOrder: z.number().int().min(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '색상은 #RRGGBB 형식이어야 합니다.'),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedBy: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export type WorkTrack = z.infer<typeof workTrackSchema>;
export type WorkTrackDraft = Pick<WorkTrack, 'projectId' | 'name' | 'color'>;

/**
 * 프로젝트 생성 시 채워주는 기본 트랙. **편의일 뿐 강제가 아니다** —
 * 지우거나 이름을 바꾸거나 0개로 만들어도 된다.
 */
export const DEFAULT_TRACK_NAMES = ['영업', '사업관리', '개발'] as const;

/** 기본 트랙 색상(순서 대응). 사용자가 바꿀 수 있다. */
export const DEFAULT_TRACK_COLORS = ['#f59e0b', '#3b82f6', '#10b981'] as const;
