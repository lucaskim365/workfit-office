import type { SystemLog } from '@/domain/systemLog/schema';

/**
 * 시스템 로그 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sys-screens.LogMgmtContent 의 인라인 mock 이관)
 * PK(id)는 LOG-01~ 결정적 부여.
 */
export const SYSTEM_LOG_SEED: SystemLog[] = [];
