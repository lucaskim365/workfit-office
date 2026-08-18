import { surveySchema, type Survey } from '@/domain/survey/schema';
import { surveyQuestionSchema, type SurveyQuestion } from '@/domain/surveyQuestion/schema';
import { surveyAnswerSchema, type SurveyAnswer } from '@/domain/surveyAnswer/schema';
import { surveyParticipationSchema, type SurveyParticipation } from '@/domain/surveyParticipation/schema';
import { surveyResponseSchema, type SurveyResponse } from '@/domain/surveyResponse/schema';
import { deriveSurvey } from '@/domain/survey/engine';
import { SURVEY_SEED } from '@/data/seeds/survey.seed';
import { SURVEY_QUESTION_SEED } from '@/data/seeds/surveyQuestion.seed';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * 전자설문 저장소 — 다섯 컬렉션을 한곳에서 다룬다.
 * 저장은 컬렉션별 공유 CrudBackend(VITE_DB_DRIVER)로 위임한다.
 * ([[data-layer-pattern]] 정본 패턴 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 설문과 질문은 `questionCount` 비정규화와 설문 복제 때문에 서로를 함께 갱신해야 하므로
 * repository 파일마다 상태를 따로 두지 않고 여기에 모은다.
 *
 * 읽기는 `surveyStore` 를 **동기로** 본다. 채번·집계·검증에서 여러 컬렉션을 교차 참조해
 * 전부 async 로 바꾸면 변경 범위만 커진다. 대신 repo 의 공개 메서드 진입점에서
 * `loadSurveyStore()` 로 채운 뒤 동기로 읽는다.
 */
export interface SurveyStore {
  surveys: Survey[];
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  answers: SurveyAnswer[];
  participations: SurveyParticipation[];
}

export const SURVEY_COLL = 'surveys';
export const SURVEY_QUESTION_COLL = 'surveyQuestions';
export const SURVEY_RESPONSE_COLL = 'surveyResponses';
export const SURVEY_ANSWER_COLL = 'surveyAnswers';
export const SURVEY_PARTICIPATION_COLL = 'surveyParticipations';

export const surveyStore: SurveyStore = {
  surveys: SURVEY_SEED.map((row) => surveySchema.parse(row)),
  questions: SURVEY_QUESTION_SEED.map((row) => surveyQuestionSchema.parse(row)),
  responses: [],
  answers: [],
  participations: [],
};

/** 안전 파싱 어댑터 — 불량 문서 하나 때문에 목록 전체가 죽지 않도록 건너뛴다. */
const safeParser = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }) =>
  (raw: unknown): T | null => {
    const parsed = schema.safeParse(raw);
    return parsed.success && parsed.data !== undefined ? parsed.data : null;
  };

const surveysBackend = createCrudBackend<Survey>({
  coll: SURVEY_COLL,
  parse: safeParser(surveySchema),
  idOf: (row) => row.id,
  seed: SURVEY_SEED.map((row) => surveySchema.parse(row)),
});

const questionsBackend = createCrudBackend<SurveyQuestion>({
  coll: SURVEY_QUESTION_COLL,
  parse: safeParser(surveyQuestionSchema),
  idOf: (row) => row.id,
  seed: SURVEY_QUESTION_SEED.map((row) => surveyQuestionSchema.parse(row)),
  // 선택지는 배열-of-객체라 Appwrite 스칼라 속성에 못 담는다 → JSON 문자열.
  jsonFields: ['options'],
});

const responsesBackend = createCrudBackend<SurveyResponse>({
  coll: SURVEY_RESPONSE_COLL,
  parse: safeParser(surveyResponseSchema),
  idOf: (row) => row.id,
  seed: [],
});

const answersBackend = createCrudBackend<SurveyAnswer>({
  coll: SURVEY_ANSWER_COLL,
  parse: safeParser(surveyAnswerSchema),
  idOf: (row) => row.id,
  seed: [],
});

const participationsBackend = createCrudBackend<SurveyParticipation>({
  coll: SURVEY_PARTICIPATION_COLL,
  parse: safeParser(surveyParticipationSchema),
  idOf: (row) => row.id,
  seed: [],
});

/**
 * 컬렉션명 → 백엔드. `persistDocs`/`removeDocs` 가 컬렉션명만 받는 기존 시그니처를
 * 유지하려고 둔 디스패치 표다(호출부 5개 파일을 건드리지 않기 위해).
 */
const BACKENDS: Record<string, { save(item: { id: string }): Promise<void>; remove(id: string): Promise<void> }> = {
  [SURVEY_COLL]: surveysBackend,
  [SURVEY_QUESTION_COLL]: questionsBackend,
  [SURVEY_RESPONSE_COLL]: responsesBackend,
  [SURVEY_ANSWER_COLL]: answersBackend,
  [SURVEY_PARTICIPATION_COLL]: participationsBackend,
};

/**
 * 저장소 → `surveyStore` 적재. repo 의 공개 메서드마다 처음에 부른다.
 * memory 드라이버(로컬)면 아무것도 하지 않고 seed 를 그대로 쓴다 — 캐시가 곧 저장소다.
 *
 * ⚠ 응답·답변은 설문이 쌓일수록 커진다. 지금은 전건을 읽지만 결과 집계가 느려지면
 * `surveyId` 로 좁히는 질의가 필요하고 그때 인덱스도 함께 걸어야 한다.
 */
export async function loadSurveyStore(): Promise<void> {
  if (dbDriver === 'memory') return;
  const [surveys, questions, responses, answers, participations] = await Promise.all([
    surveysBackend.loadAll(),
    questionsBackend.loadAll(),
    responsesBackend.loadAll(),
    answersBackend.loadAll(),
    participationsBackend.loadAll(),
  ]);
  surveyStore.surveys = surveys;
  surveyStore.questions = questions;
  surveyStore.responses = responses;
  surveyStore.answers = answers;
  surveyStore.participations = participations;
}

/**
 * 문서 여러 건 저장. 호출부는 `surveyStore` 배열도 함께 갱신한다(캐시).
 * memory 드라이버면 아무것도 하지 않는다 — 캐시가 곧 저장소다.
 *
 * ⚠ Firestore 시절의 writeBatch(≤500)가 사라지고 **건별 순차 쓰기**가 됐다.
 * 공유 백엔드가 원시연산(save/remove)만 노출하기 때문이다. 설문 제출 1건은
 * 답변 수만큼 쓰기가 나가므로, 질문 수가 많은 설문에서 느려지면 배치 API를
 * 백엔드에 추가하는 것이 다음 수순이다.
 */
export async function persistDocs<T extends { id: string }>(coll: string, rows: T[]): Promise<void> {
  if (dbDriver === 'memory' || rows.length === 0) return;
  const backend = BACKENDS[coll];
  if (!backend) throw new Error(`[survey] 알 수 없는 컬렉션: ${coll}`);
  for (const row of rows) await backend.save(row);
}

/** 문서 여러 건 삭제. */
export async function removeDocs(coll: string, ids: string[]): Promise<void> {
  if (dbDriver === 'memory' || ids.length === 0) return;
  const backend = BACKENDS[coll];
  if (!backend) throw new Error(`[survey] 알 수 없는 컬렉션: ${coll}`);
  for (const id of ids) await backend.remove(id);
}

let mutationQueue: Promise<unknown> = Promise.resolve();

/**
 * 모든 쓰기를 직렬화한다. 한 브라우저 세션에서 중복 제출과 카운터 갱신이 겹치지 않게 하는
 * 로컬 대체 수단이며, 실제 다중 사용자 동시성은 Cloud Function transaction 이관 전까지
 * 보장하지 않는다.
 */
export function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(work, work);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** 기간이 지난 설문의 저장 상태를 도출값으로 맞춘다. */
export function refreshSurveyStatuses(now = new Date()): void {
  surveyStore.surveys = surveyStore.surveys.map((row) => deriveSurvey(row, now));
}

export const cloneSurvey = (row: Survey): Survey => ({
  ...row,
  audienceDeptIds: [...row.audienceDeptIds],
  audienceUserIds: [...row.audienceUserIds],
});

export const cloneQuestion = (row: SurveyQuestion): SurveyQuestion => ({
  ...row,
  options: row.options.map((option) => ({ ...option })),
});

const maxSuffix = (ids: string[]): number =>
  ids.reduce((value, id) => {
    const parsed = Number(id.match(/(\d+)$/)?.[1]);
    return Number.isFinite(parsed) ? Math.max(value, parsed) : value;
  }, 0);

/** `SUR-YYYYMMDD-XXXX`. 일련번호는 전체 설문 기준이라 날짜가 달라도 중복되지 않는다. */
export function nextSurveyId(now: Date): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `SUR-${date}-${String(maxSuffix(surveyStore.surveys.map((row) => row.id)) + 1).padStart(4, '0')}`;
}

/** 질문 ID는 `surveyQuestions` 컬렉션 전체에서 고유하다. */
export function nextQuestionId(offset = 0): string {
  return `Q-${String(maxSuffix(surveyStore.questions.map((row) => row.id)) + 1 + offset).padStart(4, '0')}`;
}

export function nextResponseId(offset = 0): string {
  return `RESP-${String(maxSuffix(surveyStore.responses.map((row) => row.id)) + 1 + offset).padStart(4, '0')}`;
}

export function nextAnswerId(offset = 0): string {
  return `ANS-${String(maxSuffix(surveyStore.answers.map((row) => row.id)) + 1 + offset).padStart(6, '0')}`;
}

/** 설문의 질문을 화면 순서대로 돌려준다. */
export function questionsOf(surveyId: string): SurveyQuestion[] {
  return surveyStore.questions
    .filter((row) => row.surveyId === surveyId)
    .sort((a, b) => a.order - b.order);
}
