import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/shared/lib/firebase';
import { surveySchema, type Survey } from '@/domain/survey/schema';
import { surveyQuestionSchema, type SurveyQuestion } from '@/domain/surveyQuestion/schema';
import { surveyAnswerSchema, type SurveyAnswer } from '@/domain/surveyAnswer/schema';
import { surveyParticipationSchema, type SurveyParticipation } from '@/domain/surveyParticipation/schema';
import { surveyResponseSchema, type SurveyResponse } from '@/domain/surveyResponse/schema';
import { deriveSurvey } from '@/domain/survey/engine';
import { SURVEY_SEED } from '@/data/seeds/survey.seed';
import { SURVEY_QUESTION_SEED } from '@/data/seeds/surveyQuestion.seed';

/**
 * 전자설문 저장소 — 다섯 컬렉션을 한곳에서 다룬다.
 * ([[data-layer-pattern]] 정본 패턴 / Firebase 미설정 시 in-memory seed)
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

/** 문서별 안전 파싱 — 불량 문서 하나 때문에 목록 전체가 죽지 않도록 건너뛴다. */
function parseDocs<T>(docs: Array<{ data: () => unknown }>, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T[] {
  const out: T[] = [];
  for (const d of docs) {
    const parsed = schema.safeParse(d.data());
    if (parsed.success && parsed.data !== undefined) out.push(parsed.data);
  }
  return out;
}

/**
 * Firestore → `surveyStore` 적재. repo 의 공개 메서드마다 처음에 부른다.
 * Firebase 미설정(로컬)이면 아무것도 하지 않고 seed 를 그대로 쓴다.
 *
 * ⚠ 응답·답변은 설문이 쌓일수록 커진다. 지금은 전건을 읽지만 결과 집계가 느려지면
 * `where('surveyId', '==', …)` 쿼리로 좁혀야 하고 그때 복합 인덱스가 필요하다.
 */
export async function loadSurveyStore(): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const fdb = db;
  const [surveys, questions, responses, answers, participations] = await Promise.all([
    getDocs(collection(fdb, SURVEY_COLL)),
    getDocs(collection(fdb, SURVEY_QUESTION_COLL)),
    getDocs(collection(fdb, SURVEY_RESPONSE_COLL)),
    getDocs(collection(fdb, SURVEY_ANSWER_COLL)),
    getDocs(collection(fdb, SURVEY_PARTICIPATION_COLL)),
  ]);
  surveyStore.surveys = parseDocs(surveys.docs, surveySchema);
  surveyStore.questions = parseDocs(questions.docs, surveyQuestionSchema);
  surveyStore.responses = parseDocs(responses.docs, surveyResponseSchema);
  surveyStore.answers = parseDocs(answers.docs, surveyAnswerSchema);
  surveyStore.participations = parseDocs(participations.docs, surveyParticipationSchema);
}

/**
 * 문서 여러 건 저장. 호출부는 `surveyStore` 배열도 함께 갱신한다(캐시).
 * Firebase 미설정이면 아무것도 하지 않는다 — 캐시가 곧 저장소다.
 */
export async function persistDocs<T extends { id: string }>(coll: string, rows: T[]): Promise<void> {
  if (!isFirebaseConfigured || !db || rows.length === 0) return;
  const fdb = db;
  if (rows.length === 1) {
    await setDoc(doc(fdb, coll, rows[0].id), rows[0]);
    return;
  }
  // Firestore batch 최대 500건 → 청크로 분할.
  for (let i = 0; i < rows.length; i += 450) {
    const batch = writeBatch(fdb);
    for (const row of rows.slice(i, i + 450)) batch.set(doc(fdb, coll, row.id), row);
    await batch.commit();
  }
}

/** 문서 여러 건 삭제. */
export async function removeDocs(coll: string, ids: string[]): Promise<void> {
  if (!isFirebaseConfigured || !db || ids.length === 0) return;
  const fdb = db;
  if (ids.length === 1) {
    await deleteDoc(doc(fdb, coll, ids[0]));
    return;
  }
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(fdb);
    for (const id of ids.slice(i, i + 450)) batch.delete(doc(fdb, coll, id));
    await batch.commit();
  }
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
