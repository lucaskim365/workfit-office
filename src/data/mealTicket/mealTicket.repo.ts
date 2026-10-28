import { createCrudBackend, Query } from '@/data/_backend/crudBackend';
import { applyRecipients, emptyMealTicketDay, mealTicketDaySchema, mealTicketId, recipientsOf, withRecipients, type Meal, type MealTicketDay } from '@/domain/mealTicket/engine';
import { nowLocalIso } from '@/shared/lib/datetime';

/**
 * 식권 대장 저장소 — mealTickets, 날짜당 문서 하나(`MT-YYYY-MM-DD`).
 * 한두 사람이 같은 날을 동시에 체크할 수 있으므로, 고칠 때마다 그날 문서를 다시 읽고 바꾼 칸만 반영해 저장한다.
 * 한 브라우저 안에서 같은 날을 연달아 고치면(빠른 클릭·드래그) 읽기-저장이 겹쳐 앞의 변경이 사라지므로 날짜별로 차례로 처리한다.
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

const queues = new Map<string, Promise<unknown>>();

function update(date: string, change: (d: MealTicketDay) => MealTicketDay, actor: string): Promise<MealTicketDay> {
  const run = async () => {
    const next = { ...change(await fresh(date)), updatedBy: actor, updatedAt: nowLocalIso() };
    await backend.save(next);
    return next;
  };
  const prev = queues.get(date) ?? Promise.resolve();
  const job = prev.then(run, run);
  const tail = job.catch(() => undefined);
  queues.set(date, tail);
  void tail.then(() => {
    if (queues.get(date) === tail) queues.delete(date);
  });
  return job;
}

export const mealTicketRepo = {
  /** 전체 기록(날짜순). 남은 식권을 첫 기록부터 이어 세야 해서 전부 읽는다 — 하루 한 건이라 작다. */
  async list(): Promise<MealTicketDay[]> {
    return (await backend.loadAll()).sort((a, b) => a.date.localeCompare(b.date));
  },

  /** 그날 그 끼니(중식·석식)에 받은 사람 체크/해제 — 여러 명을 한 번에(드래그·Shift 범위). */
  setReceived(date: string, meal: Meal, userIds: string[], received: boolean, actor: string) {
    return update(date, (d) => withRecipients(d, meal, applyRecipients(recipientsOf(d, meal), userIds, received)), actor);
  },

  /** 그날 들어온 식권 수. */
  setStockIn(date: string, stockIn: number, actor: string) {
    return update(date, (d) => ({ ...d, stockIn }), actor);
  },

  setMemo(date: string, memo: string, actor: string) {
    return update(date, (d) => ({ ...d, memo: memo || null }), actor);
  },
};
