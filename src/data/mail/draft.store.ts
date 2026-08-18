import { mailDraftSchema, type MailDraft } from '@/domain/mail/schema';

/**
 * 임시보관 저장소.
 *
 * 공급자에 올리지 않고 브라우저에만 둔다. IMAP `APPEND`로 올리면 작성 중 저장이 매번
 * 서버 왕복을 일으키고, 계정이 끊겨 있으면 쓰던 메일을 저장조차 못 하게 된다.
 * ([[jwheo/feat/mail/DESIGN.md]] §3.1)
 *
 * `sessionStorage`가 아니라 `localStorage`를 쓴다. 쓰다 만 메일은 탭을 닫아도 남아야
 * 한다 — 그러라고 있는 기능이다.
 */
const STORAGE_KEY = 'gw-mail-drafts';

/** 사용자별로 나눠 담는다. 데모 사용자를 바꿔도 남의 임시보관이 보이면 안 된다. */
type DraftBucket = Record<string, MailDraft[]>;

function readAll(): DraftBucket {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftBucket;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    // 저장 형식이 깨졌으면 조용히 비운다. 임시보관 때문에 화면 전체가 죽으면 안 된다.
    return {};
  }
}

function writeAll(bucket: DraftBucket): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    // 용량 초과 등으로 저장하지 못해도 작성 중인 화면을 막지 않는다.
  }
}

export const draftStore = {
  list(userId: string): MailDraft[] {
    const rows = readAll()[userId] ?? [];
    return rows
      .flatMap((row) => {
        const parsed = mailDraftSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get(userId: string, id: string): MailDraft | null {
    return this.list(userId).find((row) => row.id === id) ?? null;
  },

  save(userId: string, draft: MailDraft): MailDraft {
    const parsed = mailDraftSchema.parse(draft);
    const bucket = readAll();
    const rows = (bucket[userId] ?? []).filter((row) => row.id !== parsed.id);
    bucket[userId] = [...rows, parsed];
    writeAll(bucket);
    return parsed;
  },

  remove(userId: string, id: string): void {
    const bucket = readAll();
    bucket[userId] = (bucket[userId] ?? []).filter((row) => row.id !== id);
    writeAll(bucket);
  },
};

/** 임시보관 ID. 저장 시각과 무작위 조각을 붙여 같은 밀리초에 두 번 저장해도 겹치지 않는다. */
export function nextDraftId(): string {
  return `DRAFT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
