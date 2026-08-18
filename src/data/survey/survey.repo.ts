import type { User } from '@/domain/user/schema';
import {
  surveySchema,
  type Survey,
  type SurveyDraft,
  type SurveyStatus,
} from '@/domain/survey/schema';
import {
  assertPublishable,
  assertEndsAtChange,
  assertSurveyTransition,
  canCreateSurvey,
  canManageSurvey,
  deriveSurveyStatus,
  isSurveyAudience,
  publishedStatus,
  SurveyError,
  surveyEditScope,
} from '@/domain/survey/engine';
import { isSelectableSurveyCategory } from '@/domain/survey/category';
import { surveyQuestionSchema } from '@/domain/surveyQuestion/schema';
import {
  cloneSurvey,
  exclusive,
  loadSurveyStore,
  nextQuestionId,
  nextSurveyId,
  persistDocs,
  questionsOf,
  refreshSurveyStatuses,
  removeDocs,
  SURVEY_COLL,
  SURVEY_QUESTION_COLL,
  surveyStore,
} from './store';

export interface SurveyFilter {
  ownerUserId?: string;
  status?: SurveyStatus;
  categoryCode?: string;
  q?: string;
}

function applyFilter(rows: Survey[], filter?: SurveyFilter): Survey[] {
  if (!filter) return rows;
  const keyword = filter.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) =>
    (!filter.ownerUserId || row.ownerUserId === filter.ownerUserId)
    && (!filter.status || row.status === filter.status)
    && (!filter.categoryCode || row.categoryCode === filter.categoryCode)
    && (!keyword || [row.title, row.description].some((value) => value.toLowerCase().includes(keyword))),
  );
}

function requireSurvey(id: string): Survey {
  const found = surveyStore.surveys.find((row) => row.id === id);
  if (!found) throw new SurveyError('INVALID_INPUT', '설문을 찾을 수 없습니다.');
  return found;
}

function requireManageable(actor: User, id: string): Survey {
  const row = requireSurvey(id);
  if (!canManageSurvey(actor, row)) {
    throw new SurveyError('FORBIDDEN', '이 설문을 관리할 권한이 없습니다.');
  }
  return row;
}

/**
 * 설문 분류 검증.
 *
 * 정식 소스는 `commonCodes`의 `GW_SURVEY_CATEGORY`지만 공통코드 seed가 병렬 개발
 * 보호 대상이라 현재는 모듈 내부 fallback이 사실상의 원천이다. 공통코드가 등록되면
 * 조회 결과를 인자로 받도록 바꾼다. ([[jwheo/feat/survey/DESIGN.md]] §23)
 */
function assertCategory(code: string): void {
  if (!isSelectableSurveyCategory(undefined, code)) {
    throw new SurveyError('INVALID_INPUT', '사용할 수 없는 설문 분류입니다.');
  }
}

async function replaceSurvey(next: Survey): Promise<Survey> {
  const valid = surveySchema.parse(next);
  surveyStore.surveys = surveyStore.surveys.map((row) => (row.id === valid.id ? valid : row));
  await persistDocs(SURVEY_COLL, [valid]);
  return cloneSurvey(valid);
}

/** 상태·응답 여부별 수정 범위를 지켜 기본정보를 갱신한다. ([[DESIGN.md]] §9) */
function applyDraft(row: Survey, draft: SurveyDraft, now: Date): Survey {
  const scope = surveyEditScope(row, now);
  const deny = () => {
    throw new SurveyError('LOCKED', '현재 상태에서는 수정할 수 없는 항목입니다.');
  };
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((value, i) => value === b[i]);

  if (row.title !== draft.title && !scope.title) deny();
  if (row.description !== draft.description && !scope.description) deny();
  if (row.categoryCode !== draft.categoryCode && !scope.category) deny();
  if (row.anonymous !== draft.anonymous && !scope.anonymous) deny();
  if (row.showResultToRespondent !== draft.showResultToRespondent && !scope.showResult) deny();
  if (row.startsAt !== draft.startsAt && !scope.startsAt) deny();

  const audienceChanged = row.audienceType !== draft.audienceType
    || !sameList(row.audienceDeptIds, draft.audienceDeptIds)
    || !sameList(row.audienceUserIds, draft.audienceUserIds);
  if (audienceChanged && !scope.audience) deny();

  if (row.endsAt !== draft.endsAt) {
    if (draft.endsAt === null) {
      if (!scope.endsAt || scope.extendEndsAtOnly) deny();
    } else {
      assertEndsAtChange(row, draft.endsAt, now);
    }
  }

  assertCategory(draft.categoryCode);
  return {
    ...row,
    ...draft,
    audienceDeptIds: [...draft.audienceDeptIds],
    audienceUserIds: [...draft.audienceUserIds],
    version: row.version + 1,
    updatedAt: now.toISOString(),
  };
}

/**
 * 설문 Repository — 저장소 접근을 캡슐화하는 유일한 계층.
 * ([[DB_이관_대비_설계원칙.md]] 원칙 1 / [[data-layer-pattern]] 정본 패턴)
 * 실제 읽기·쓰기는 `./store` 가 맡는다. Firebase 미설정 시 in-memory seed 로 degrade.
 */
export const surveyRepo = {
  async list(filter?: SurveyFilter): Promise<Survey[]> {
    await loadSurveyStore();
    refreshSurveyStatuses();
    return applyFilter(surveyStore.surveys, filter)
      .map(cloneSurvey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<Survey | null> {
    await loadSurveyStore();
    refreshSurveyStatuses();
    const found = surveyStore.surveys.find((row) => row.id === id);
    return found ? cloneSurvey(found) : null;
  },

  /**
   * 참여할 설문 — 대상에 포함된 진행 중 설문과, 이미 참여해 기록이 남은 설문.
   *
   * `users.dept`가 부서명 문자열이라 부서 대상 판정에는 해석된 부서 ID가 필요하다.
   * ([[jwheo/feat/survey/DESIGN.md]] §11.1)
   */
  async listForRespondent(actor: User, actorDeptId: string | null): Promise<Survey[]> {
    await loadSurveyStore();
    refreshSurveyStatuses();
    const participated = new Set(
      surveyStore.participations.filter((row) => row.userId === actor.id).map((row) => row.surveyId),
    );
    return surveyStore.surveys
      .filter((row) => isSurveyAudience(row, actor, actorDeptId))
      .filter((row) => row.status === 'ACTIVE' || participated.has(row.id))
      .map(cloneSurvey)
      .sort((a, b) => (a.endsAt ?? '').localeCompare(b.endsAt ?? ''));
  },

  createDraft(actor: User, draft: SurveyDraft): Promise<Survey> {
    return exclusive(async () => {
      await loadSurveyStore();
      if (!canCreateSurvey(actor)) {
        throw new SurveyError('FORBIDDEN', '사용 중인 계정만 설문을 만들 수 있습니다.');
      }
      assertCategory(draft.categoryCode);
      const now = new Date();
      const valid = surveySchema.parse({
        ...draft,
        id: nextSurveyId(now),
        ownerUserId: actor.id,
        status: 'DRAFT',
        audienceDeptIds: [...draft.audienceDeptIds],
        audienceUserIds: [...draft.audienceUserIds],
        questionCount: 0,
        responseCount: 0,
        publishedAt: null,
        firstRespondedAt: null,
        closedAt: null,
        version: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      surveyStore.surveys = [...surveyStore.surveys, valid];
      await persistDocs(SURVEY_COLL, [valid]);
      return cloneSurvey(valid);
    });
  },

  updateBasics(actor: User, id: string, draft: SurveyDraft): Promise<Survey> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const row = requireManageable(actor, id);
      return replaceSurvey(applyDraft(row, draft, new Date()));
    });
  },

  publish(actor: User, id: string): Promise<Survey> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const row = requireManageable(actor, id);
      const now = new Date();
      assertPublishable(row, questionsOf(id), now);
      const status = publishedStatus(row.startsAt as string, now);
      assertSurveyTransition(row.status, status);
      return replaceSurvey({
        ...row,
        status,
        publishedAt: now.toISOString(),
        version: row.version + 1,
        updatedAt: now.toISOString(),
      });
    });
  },

  close(actor: User, id: string): Promise<Survey> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const row = requireManageable(actor, id);
      assertSurveyTransition(deriveSurveyStatus(row), 'CLOSED');
      const now = new Date().toISOString();
      return replaceSurvey({ ...row, status: 'CLOSED', closedAt: now, version: row.version + 1, updatedAt: now });
    });
  },

  archive(actor: User, id: string): Promise<Survey> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const row = requireManageable(actor, id);
      assertSurveyTransition(deriveSurveyStatus(row), 'ARCHIVED');
      const now = new Date().toISOString();
      return replaceSurvey({ ...row, status: 'ARCHIVED', version: row.version + 1, updatedAt: now });
    });
  },

  /**
   * 설문 복제 — 기본정보·질문·선택지만 새 초안으로 옮긴다.
   * 응답·참여 기록·통계는 복제하지 않고 기간은 비운다. ([[DESIGN.md]] §8.4)
   */
  duplicate(actor: User, id: string): Promise<Survey> {
    return exclusive(async () => {
      if (!canCreateSurvey(actor)) {
        throw new SurveyError('FORBIDDEN', '사용 중인 계정만 설문을 만들 수 있습니다.');
      }
      await loadSurveyStore();
      refreshSurveyStatuses();
      const source = requireSurvey(id);
      const sourceQuestions = questionsOf(id);
      const now = new Date();
      const stamp = now.toISOString();
      const copy = surveySchema.parse({
        ...source,
        id: nextSurveyId(now),
        title: `${source.title} 복사본`.slice(0, 100),
        ownerUserId: actor.id,
        status: 'DRAFT',
        audienceDeptIds: [...source.audienceDeptIds],
        audienceUserIds: [...source.audienceUserIds],
        startsAt: null,
        endsAt: null,
        questionCount: sourceQuestions.length,
        responseCount: 0,
        publishedAt: null,
        firstRespondedAt: null,
        closedAt: null,
        version: 1,
        createdAt: stamp,
        updatedAt: stamp,
      });
      const copiedQuestions = sourceQuestions.map((question, index) => surveyQuestionSchema.parse({
        ...question,
        id: nextQuestionId(index),
        surveyId: copy.id,
        options: question.options.map((option) => ({ ...option })),
        createdAt: stamp,
        updatedAt: stamp,
      }));
      surveyStore.surveys = [...surveyStore.surveys, copy];
      surveyStore.questions = [...surveyStore.questions, ...copiedQuestions];
      await persistDocs(SURVEY_COLL, [copy]);
      await persistDocs(SURVEY_QUESTION_COLL, copiedQuestions);
      return cloneSurvey(copy);
    });
  },

  /** 초안만 삭제한다. 배포된 설문은 마감·보관으로 처리한다. */
  remove(actor: User, id: string): Promise<void> {
    return exclusive(async () => {
      await loadSurveyStore();
      refreshSurveyStatuses();
      const row = requireManageable(actor, id);
      if (row.status !== 'DRAFT') {
        throw new SurveyError('INVALID_STATUS', '배포된 설문은 삭제할 수 없습니다. 마감 후 보관하세요.');
      }
      const questionIds = surveyStore.questions.filter((item) => item.surveyId === id).map((item) => item.id);
      surveyStore.surveys = surveyStore.surveys.filter((item) => item.id !== id);
      surveyStore.questions = surveyStore.questions.filter((item) => item.surveyId !== id);
      // 질문을 먼저 지운다. 설문만 지우고 실패하면 주인 없는 질문 문서가 남는다.
      await removeDocs(SURVEY_QUESTION_COLL, questionIds);
      await removeDocs(SURVEY_COLL, [id]);
    });
  },
};
