import { recentRecipientSchema, type RecentRecipient } from '@/domain/mail/schema';

/**
 * 최근 받는 사람 저장소.
 *
 * 발송이 성공할 때 받는 사람·참조·숨은참조를 기록해 두었다가 작성 시 추천한다.
 * 서버·계정과 무관한 순수 편의 데이터라 브라우저 `localStorage`에만 산다 — 지워져도
 * 추천이 비는 것뿐, 잃는 것이 없다.
 */
const STORAGE_KEY = 'gw-mail-recipients';

/** 한 사용자에게 남기는 최대 인원. 넘으면 오래 안 쓴 주소부터 버린다. */
const MAX_RECIPIENTS = 50;

/** 사용자별로 나눠 담는다. 데모 사용자를 바꿔도 남의 수신인 목록이 보이면 안 된다. */
type RecipientBucket = Record<string, RecentRecipient[]>;

function readAll(): RecipientBucket {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecipientBucket;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    // 저장 형식이 깨졌으면 조용히 비운다. 추천 때문에 작성 화면이 죽으면 안 된다.
    return {};
  }
}

function writeAll(bucket: RecipientBucket): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    // 용량 초과 등으로 저장하지 못해도 발송 흐름을 막지 않는다.
  }
}

export const recipientStore = {
  list(userId: string): RecentRecipient[] {
    return (readAll()[userId] ?? [])
      .flatMap((row) => {
        const parsed = recentRecipientSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  },

  /** 발송 성공 시 호출한다. 같은 주소는 사용 시각만 갱신하고, 이름은 아는 값이 우선이다. */
  record(userId: string, rows: { name: string; email: string }[]): void {
    if (rows.length === 0) return;
    const now = new Date().toISOString();

    const merged = new Map(this.list(userId).map((row) => [row.email, row]));
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      if (email === '') continue;
      const known = merged.get(email);
      const candidate = recentRecipientSchema.safeParse({
        email,
        name: row.name.trim() || known?.name || '',
        lastUsedAt: now,
      });
      if (candidate.success) merged.set(email, candidate.data);
    }

    const bucket = readAll();
    bucket[userId] = [...merged.values()]
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .slice(0, MAX_RECIPIENTS);
    writeAll(bucket);
  },
};
