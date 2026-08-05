import { userAbsenceSchema, type UserAbsenceConfig } from '@/domain/absence/schema';

const STORAGE_KEY_PREFIX = 'workfit_absence_config_';

export const absenceRepo = {
  /** 특정 사용자의 부재 및 대결 설정 조회. */
  async get(userId: string): Promise<UserAbsenceConfig> {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return userAbsenceSchema.parse(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse absence config from localStorage:', e);
    }
    return {
      userId,
      isAbsent: false,
      startDate: null,
      endDate: null,
      delegateUserId: null,
      reason: '',
      scope: 'ALL',
      allowedDocTypes: [],
      maxDelegateAmount: null,
      updatedAt: null,
    };
  },

  /** 사용자 부재 설정 저장. */
  async save(config: UserAbsenceConfig): Promise<UserAbsenceConfig> {
    const next: UserAbsenceConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${config.userId}`, JSON.stringify(next));
    return next;
  },

  /** 현 시점(now) 기준 사용자가 부재 및 대결 활성 상태인가 판별 (서식 범위 및 최고 금액 제한 검증 포함) */
  async isCurrentlyAbsent(
    userId: string,
    docType?: string,
    docAmount?: number | null
  ): Promise<{ isAbsent: boolean; delegateUserId: string | null; blockReason?: string }> {
    const cfg = await this.get(userId);
    if (!cfg.isAbsent || !cfg.delegateUserId) {
      return { isAbsent: false, delegateUserId: null };
    }
    const now = new Date();
    if (cfg.startDate) {
      const start = new Date(cfg.startDate);
      if (now < start) return { isAbsent: false, delegateUserId: null };
    }
    if (cfg.endDate) {
      const end = new Date(cfg.endDate);
      if (now > end) return { isAbsent: false, delegateUserId: null };
    }

    // 1. 서식 범위 검증: 특정 서식 한정인 경우 docType 매칭 검사
    if (cfg.scope === 'SPECIFIC_FORMS' && docType) {
      if (!cfg.allowedDocTypes || !cfg.allowedDocTypes.includes(docType)) {
        return { isAbsent: false, delegateUserId: null, blockReason: '대결 위임이 허용된 문서 서식이 아닙니다.' };
      }
    }

    // 2. 최고 금액 제한 검증: 금액이 존재하는 문서이고, maxDelegateAmount 가 설정되어 있는 경우
    if (docAmount != null && cfg.maxDelegateAmount != null && cfg.maxDelegateAmount > 0) {
      if (docAmount > cfg.maxDelegateAmount) {
        return {
          isAbsent: false,
          delegateUserId: null,
          blockReason: `대결 허용 최고 금액(${cfg.maxDelegateAmount.toLocaleString()}원)을 초과한 문서입니다.`,
        };
      }
    }

    return { isAbsent: true, delegateUserId: cfg.delegateUserId };
  },
};
