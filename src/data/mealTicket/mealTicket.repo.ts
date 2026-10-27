import { createCrudBackend, Query } from '@/data/_backend/crudBackend';
import { emptyMealTicketDay, mealTicketDaySchema, mealTicketId, type MealTicketDay } from '@/domain/mealTicket/engine';
import { nowLocalIso } from '@/shared/lib/datetime';

/**
 * 식권 대장 저장소 — mealTickets, 날짜당 문서 하나(`MT-YYYY-MM-DD`).
 * 한두 사람이 같은 날을 동시에 체크할 수 있으므로, 고칠 때마다 그날 문서를 다시 읽고 바꾼 칸만 반영해 저장한다.
 */
const backend = createCrudBackend<MealTicketDay>({
  coll: 'mealTickets',
  parse: (raw) => {
    const p = mealTicketDaySchema.safeParse(raw);
    return p.success ? p.data : null;
  },
  idOf: (d) => mealTicketId(d.date),
  seed: [],
});

async function fresh(date: string): Promise<MealTicketDay> {
  const rows = await backend.loadWithQueries([Query.equal('date', date)]);
  return rows.find((d) => d.date === date) ?? emptyMealTicketDay(date);
}

async function update(date: string, change: (d: MealTicketDay) => MealTicketDay, actor: string): Promise<MealTicketDay> {
  const next = { ...change(await fresh(date)), updatedBy: actor, updatedAt: nowLocalIso() };
  await backend.save(next);
  return next;
}

export const mealTicketRepo = {
  /** 전체 기록(날짜순). 남은 식권을 첫 기록부터 이어 세야 해서 전부 읽는다 — 하루 한 건이라 작다. */
  async list(): Promise<MealTicketDay[]> {
    return (await backend.loadAll()).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** 그날 받은 사람 체크/해제. */
  setReceived(date: string, userId: string, received: boolean, actor: string) {
    return update(date, (d) => {
      const others = d.recipients.filter((id) => id !== userId);
      return { ...d, recipients: received ? [...others, userId] : others };
    }, actor);
  },

  /** 그날 들어온 식권 수. */
  setStockIn(date: string, stockIn: number, actor: string) {
    return update(date, (d) => ({ ...d, stockIn }), actor);
  },

  setMemo(date: string, memo: string, actor: string) {
    return update(date, (d) => ({ ...d, memo: memo || null }), actor);
  },
};
