import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CapsCollection, CapsStore } from './store';

/**
 * 파일 저장소 — Firebase 없는 현재 개발 환경용.
 *
 * 컬렉션당 JSON 파일 하나(`.caps-local/attendance.json` 등)에 Firestore의
 * `set(merge:true)`를 흉내 낸다(문서 단위 얕은 병합 — 에이전트가 매번 전체 필드를
 * 보내므로 충분하다). 사람이 눈으로 확인하는 것이 목적이라 정렬·들여쓰기해 저장한다.
 * 산출물 폴더는 실근태 데이터가 담기므로 gitignore 대상이다.
 */
export class CapsFileStore implements CapsStore {
  private pending = new Map<CapsCollection, Map<string, Record<string, unknown>>>();

  constructor(private readonly dir: string = '.caps-local') {}

  mergeSet(collection: CapsCollection, id: string, data: Record<string, unknown>): void {
    const bucket = this.pending.get(collection) ?? new Map();
    bucket.set(id, { ...(bucket.get(id) ?? {}), ...serialize(data) });
    this.pending.set(collection, bucket);
  }

  async flush(): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    for (const [collection, bucket] of this.pending) {
      const path = join(this.dir, `${collection}.json`);
      const existing = readCollection(path);
      for (const [id, data] of bucket) {
        existing[id] = { ...(existing[id] ?? {}), ...data };
      }
      const sorted = Object.fromEntries(
        Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)),
      );
      writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    }
    this.pending.clear();
  }

  /** 테스트·확인용 조회. */
  read(collection: CapsCollection): Record<string, Record<string, unknown>> {
    return readCollection(join(this.dir, `${collection}.json`));
  }
}

function readCollection(path: string): Record<string, Record<string, unknown>> {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, unknown>>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Date는 ISO 문자열로 저장한다. Firestore 구현이라면 이 자리에서 Timestamp가 된다. */
function serialize(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}
