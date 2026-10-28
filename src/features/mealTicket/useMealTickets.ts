import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mealTicketRepo } from '@/data/mealTicket/mealTicket.repo';
import { applyRecipients, emptyMealTicketDay, recipientsOf, withRecipients, type Meal, type MealTicketDay } from '@/domain/mealTicket/engine';

export const MEAL_TICKETS_KEY = ['mealTickets'];

export function useMealTickets() {
  return useQuery({ queryKey: MEAL_TICKETS_KEY, queryFn: () => mealTicketRepo.list() });
}

type Change =
  | { kind: 'received'; date: string; meal: Meal; userIds: string[]; received: boolean }
  | { kind: 'stockIn'; date: string; stockIn: number }
  | { kind: 'memo'; date: string; memo: string };

const apply = (d: MealTicketDay, c: Change): MealTicketDay => {
  if (c.kind === 'stockIn') return { ...d, stockIn: c.stockIn };
  if (c.kind === 'memo') return { ...d, memo: c.memo || null };
  return withRecipients(d, c.meal, applyRecipients(recipientsOf(d, c.meal), c.userIds, c.received));
};

const UPDATE_KEY = ['mealTickets', 'update'];

/** 식권 대장 한 칸 저장 — 체크가 바로 보이게 화면을 먼저 바꾸고, 실패하면 되돌린다. */
export function useUpdateMealTicket(actor: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: UPDATE_KEY,
    mutationFn: (c: Change) => {
      if (c.kind === 'received') return mealTicketRepo.setReceived(c.date, c.meal, c.userIds, c.received, actor);
      if (c.kind === 'stockIn') return mealTicketRepo.setStockIn(c.date, c.stockIn, actor);
      return mealTicketRepo.setMemo(c.date, c.memo, actor);
    },
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: MEAL_TICKETS_KEY });
      const prev = qc.getQueryData<MealTicketDay[]>(MEAL_TICKETS_KEY);
      qc.setQueryData<MealTicketDay[]>(MEAL_TICKETS_KEY, (list = []) => {
        const found = list.some((d) => d.date === c.date);
        const next = found ? list.map((d) => (d.date === c.date ? apply(d, c) : d)) : [...list, apply(emptyMealTicketDay(c.date), c)];
        return next.sort((a, b) => a.date.localeCompare(b.date));
      });
      return { prev };
    },
    onError: (e, _c, ctx) => {
      if (ctx?.prev) qc.setQueryData(MEAL_TICKETS_KEY, ctx.prev);
      alert(`저장하지 못했습니다: ${(e as Error)?.message || e}`);
    },
    // 저장이 여러 개 이어질 때(드래그) 중간에 다시 읽으면 아직 저장 안 된 칸이 잠깐 풀려 보인다 — 마지막 저장 뒤에만 다시 읽는다
    onSettled: () => {
      if (qc.isMutating({ mutationKey: UPDATE_KEY }) <= 1) void qc.invalidateQueries({ queryKey: MEAL_TICKETS_KEY });
    },
  });
}
