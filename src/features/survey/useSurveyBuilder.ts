import { useCallback, useMemo, useRef, useState } from 'react';
import type { SurveyQuestion, SurveyQuestionType } from '@/domain/surveyQuestion/schema';
import {
  addBulkCards,
  addCard,
  addOption,
  applyOptionLines,
  duplicateCard,
  hasRoom,
  isDirty,
  moveCard,
  removeCard,
  removeOption,
  retype,
  setOptionLabel,
  toCard,
  toDrafts,
  type BuilderCard,
} from './surveyBuilderState';

export type { BuilderCard } from './surveyBuilderState';

/**
 * 설문 질문 카드의 화면 로컬 편집 상태.
 *
 * 초안은 저장 버튼을 누를 때 질문 전체를 한 번에 저장하므로 편집 중에는 저장소를 건드리지
 * 않는다. 상태 전이 규칙은 `surveyBuilderState`의 순수 함수에 있다.
 * ([[jwheo/feat/survey/DESIGN.md]] §8.1)
 */
export function useSurveyBuilder(loaded: SurveyQuestion[] | undefined) {
  const initial = useMemo(() => (loaded ?? []).map(toCard), [loaded]);
  const [edited, setEdited] = useState<BuilderCard[] | null>(null);
  const seq = useRef(0);

  const cards = edited ?? initial;
  const newKey = useCallback(() => {
    seq.current += 1;
    return `new-${seq.current}`;
  }, []);

  const apply = useCallback((updater: (rows: BuilderCard[]) => BuilderCard[]) => {
    setEdited((previous) => updater(previous ?? initial));
  }, [initial]);

  return {
    cards,
    dirty: edited !== null && isDirty(edited, initial),
    full: !hasRoom(cards),

    /** 서버 값으로 되돌린다. 저장 성공 후와 편집 취소에 쓴다. */
    reset: useCallback(() => setEdited(null), []),

    add: useCallback((type: SurveyQuestionType) => {
      const key = newKey();
      apply((rows) => addCard(rows, type, key));
    }, [apply, newKey]),

    /** 추가된 질문 수를 돌려준다. 상한을 넘은 줄은 버려진다. */
    addBulk: useCallback((type: SurveyQuestionType, text: string): number => {
      let added = 0;
      apply((rows) => {
        const result = addBulkCards(rows, type, text, () => newKey());
        added = result.added;
        return result.cards;
      });
      return added;
    }, [apply, newKey]),

    patch: useCallback((key: string, changes: Partial<Omit<BuilderCard, 'key' | 'type'>>) => {
      apply((rows) => rows.map((card) => (card.key === key ? { ...card, ...changes } : card)));
    }, [apply]),

    changeType: useCallback((key: string, type: SurveyQuestionType) => {
      apply((rows) => rows.map((card) => (card.key === key ? retype(card, type) : card)));
    }, [apply]),

    duplicate: useCallback((key: string) => {
      const cloneKey = newKey();
      apply((rows) => duplicateCard(rows, key, cloneKey));
    }, [apply, newKey]),

    remove: useCallback((key: string) => apply((rows) => removeCard(rows, key)), [apply]),
    move: useCallback((key: string, direction: -1 | 1) => apply((rows) => moveCard(rows, key, direction)), [apply]),
    addOption: useCallback((key: string) => apply((rows) => addOption(rows, key)), [apply]),
    setOption: useCallback((key: string, optionId: string, label: string) =>
      apply((rows) => setOptionLabel(rows, key, optionId, label)), [apply]),
    removeOption: useCallback((key: string, optionId: string) =>
      apply((rows) => removeOption(rows, key, optionId)), [apply]),

    /** 중복 문구 목록을 돌려준다. 화면에서 저장 전에 알려준다. ([[DESIGN.md]] §8.2) */
    setOptionsFromLines: useCallback((key: string, text: string): string[] => {
      let duplicates: string[] = [];
      apply((rows) => {
        const result = applyOptionLines(rows, key, text);
        duplicates = result.duplicates;
        return result.cards;
      });
      return duplicates;
    }, [apply]),

    toDrafts: useCallback(() => toDrafts(cards), [cards]),
  };
}
