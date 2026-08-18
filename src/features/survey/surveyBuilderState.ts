import {
  SURVEY_MAX_QUESTIONS,
  SURVEY_ORDER_STEP,
  isChoiceQuestion,
  type SurveyOption,
  type SurveyQuestion,
  type SurveyQuestionDraft,
  type SurveyQuestionType,
} from '@/domain/surveyQuestion/schema';
import { nextOptionId, parseOptionLines, parseQuestionLines } from '@/domain/survey/engine';

/**
 * 설문 작성 화면의 질문 카드 상태 전이 — 전부 순수 함수다.
 *
 * React 훅 안에 두면 렌더러 없이 확인할 수 없어, 편집 규칙만 따로 분리한다.
 * ([[jwheo/feat/survey/DESIGN.md]] §8)
 */
export interface BuilderCard extends SurveyQuestionDraft {
  /** 저장 전 카드도 구분해야 React key가 흔들리지 않는다. 저장된 질문은 질문 ID를 그대로 쓴다. */
  key: string;
}

const defaultOptions = (): SurveyOption[] => [
  { id: 'OPT-01', label: '', order: 10 },
  { id: 'OPT-02', label: '', order: 20 },
];

export function emptyCard(type: SurveyQuestionType, key: string, title = ''): BuilderCard {
  return {
    key,
    id: null,
    type,
    title,
    description: '',
    required: false,
    order: 0,
    options: isChoiceQuestion(type) ? defaultOptions() : [],
    ratingMinLabel: type === 'RATING' ? '매우 불만족' : '',
    ratingMaxLabel: type === 'RATING' ? '매우 만족' : '',
    maxLength: null,
  };
}

export function toCard(question: SurveyQuestion): BuilderCard {
  return {
    key: question.id,
    id: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    order: question.order,
    options: question.options.map((option) => ({ ...option })),
    ratingMinLabel: question.ratingMinLabel,
    ratingMaxLabel: question.ratingMaxLabel,
    maxLength: question.maxLength,
  };
}

/** 화면 순서를 그대로 order로 굳힌다. */
export function reorder(cards: BuilderCard[]): BuilderCard[] {
  return cards.map((card, index) => ({ ...card, order: (index + 1) * SURVEY_ORDER_STEP }));
}

/**
 * 유형 변경. 새 유형에서 쓰지 않는 필드를 비운다 — 스키마가 잔여 값을 거부하기 때문이다.
 * 선택형끼리 바꿀 때는 이미 입력한 선택지를 유지한다.
 */
export function retype(card: BuilderCard, type: SurveyQuestionType): BuilderCard {
  return {
    ...card,
    type,
    options: isChoiceQuestion(type)
      ? (isChoiceQuestion(card.type) && card.options.length >= 2
        ? card.options.map((option) => ({ ...option }))
        : defaultOptions())
      : [],
    ratingMinLabel: type === 'RATING' ? (card.ratingMinLabel || '매우 불만족') : '',
    ratingMaxLabel: type === 'RATING' ? (card.ratingMaxLabel || '매우 만족') : '',
    maxLength: type === 'SHORT_TEXT' || type === 'LONG_TEXT' ? card.maxLength : null,
  };
}

export const hasRoom = (cards: BuilderCard[]) => cards.length < SURVEY_MAX_QUESTIONS;

export function addCard(cards: BuilderCard[], type: SurveyQuestionType, key: string): BuilderCard[] {
  return hasRoom(cards) ? reorder([...cards, emptyCard(type, key)]) : cards;
}

/** 줄바꿈 기준 질문 일괄 추가. 상한을 넘는 줄은 버리고 실제 추가된 수를 함께 돌려준다. */
export function addBulkCards(
  cards: BuilderCard[],
  type: SurveyQuestionType,
  text: string,
  keyAt: (index: number) => string,
): { cards: BuilderCard[]; added: number } {
  const titles = parseQuestionLines(text).slice(0, Math.max(0, SURVEY_MAX_QUESTIONS - cards.length));
  if (titles.length === 0) return { cards, added: 0 };
  const next = titles.map((title, index) => emptyCard(type, keyAt(index), title));
  return { cards: reorder([...cards, ...next]), added: titles.length };
}

/** 복제 카드는 새 질문이므로 id를 비운다. 저장 시 새 질문 ID를 받는다. ([[DESIGN.md]] §8.1) */
export function duplicateCard(cards: BuilderCard[], key: string, cloneKey: string): BuilderCard[] {
  const index = cards.findIndex((card) => card.key === key);
  if (index < 0 || !hasRoom(cards)) return cards;
  const source = cards[index];
  const copy: BuilderCard = {
    ...source,
    key: cloneKey,
    id: null,
    options: source.options.map((option) => ({ ...option })),
  };
  return reorder([...cards.slice(0, index + 1), copy, ...cards.slice(index + 1)]);
}

export function moveCard(cards: BuilderCard[], key: string, direction: -1 | 1): BuilderCard[] {
  const index = cards.findIndex((card) => card.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= cards.length) return cards;
  const next = [...cards];
  [next[index], next[target]] = [next[target], next[index]];
  return reorder(next);
}

export function removeCard(cards: BuilderCard[], key: string): BuilderCard[] {
  return reorder(cards.filter((card) => card.key !== key));
}

export function addOption(cards: BuilderCard[], key: string): BuilderCard[] {
  return cards.map((card) => (card.key === key
    ? { ...card, options: [...card.options, { id: nextOptionId(card.options), label: '', order: (card.options.length + 1) * 10 }] }
    : card));
}

export function setOptionLabel(cards: BuilderCard[], key: string, optionId: string, label: string): BuilderCard[] {
  return cards.map((card) => (card.key === key
    ? { ...card, options: card.options.map((option) => (option.id === optionId ? { ...option, label } : option)) }
    : card));
}

export function removeOption(cards: BuilderCard[], key: string, optionId: string): BuilderCard[] {
  return cards.map((card) => (card.key === key
    ? { ...card, options: card.options.filter((option) => option.id !== optionId).map((option, index) => ({ ...option, order: (index + 1) * 10 })) }
    : card));
}

/**
 * 줄바꿈 기준 선택지 일괄 입력.
 *
 * 같은 자리의 기존 선택지는 ID를 유지하고 문구만 바꾼다. 이미 저장된 응답이 선택지 ID를
 * 참조하므로, 문구를 다듬는 흔한 편집에서 응답 참조가 끊기지 않게 하기 위해서다.
 * 줄이 늘어난 만큼만 새 ID를 발급한다. ([[DESIGN.md]] §7.2 · §8.2)
 */
export function applyOptionLines(
  cards: BuilderCard[],
  key: string,
  text: string,
): { cards: BuilderCard[]; duplicates: string[] } {
  const { labels, duplicates } = parseOptionLines(text);
  const next = cards.map((card) => {
    if (card.key !== key) return card;
    const kept = [...card.options];
    return {
      ...card,
      options: labels.map((label, index) => {
        const previous = kept[index];
        return previous
          ? { ...previous, label, order: (index + 1) * 10 }
          : { id: nextOptionId(kept.slice(0, index)), label, order: (index + 1) * 10 };
      }),
    };
  });
  return { cards: next, duplicates };
}

export function toDrafts(cards: BuilderCard[]): SurveyQuestionDraft[] {
  return cards.map(({ key: _key, ...rest }) => ({
    ...rest,
    options: rest.options.map((option) => ({ ...option })),
  }));
}

/** 서버 값과 달라졌는지 — key는 화면 전용이라 비교에서 뺀다. */
export function isDirty(cards: BuilderCard[], initial: BuilderCard[]): boolean {
  return JSON.stringify(toDrafts(cards)) !== JSON.stringify(toDrafts(initial));
}
