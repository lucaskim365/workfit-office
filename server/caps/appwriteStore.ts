import type { CapsCollection, CapsStore } from './store';

/**
 * Appwrite Databases 저장소 — dev 프로젝트(workfit-intra-dev) 검증용이자 운영 이관 후보.
 *
 * SDK(node-appwrite) 대신 REST를 직접 호출한다(의존성 없음, Node 내장 fetch).
 * Appwrite는 문서 upsert를 PUT으로 지원하므로 결정적 ID + PUT으로 멱등을 유지한다.
 * PUT 미지원(구버전) 응답이면 POST 생성 → 409 시 PATCH 갱신으로 대체한다.
 *
 * 직렬화 규칙: Date → ISO 문자열(datetime attribute), 중첩 객체(raw·counts) →
 * JSON 문자열(Appwrite에 map 타입이 없다). 화면/재해석 시 JSON.parse로 복원한다.
 */
export interface AppwriteConfig {
  endpoint: string;   // 예: https://appwrite.widdyax.com/v1
  projectId: string;
  apiKey: string;
  databaseId: string; // 예: workfit
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function serializeData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, serializeValue(value)]));
}

export class CapsAppwriteStore implements CapsStore {
  private pending: Array<{ collection: CapsCollection; id: string; data: Record<string, unknown> }> = [];
  private putUnsupported = false;

  constructor(private readonly config: AppwriteConfig) {}

  mergeSet(collection: CapsCollection, id: string, data: Record<string, unknown>): void {
    this.pending.push({ collection, id, data: serializeData(data) });
  }

  async flush(): Promise<void> {
    const writes = this.pending;
    this.pending = [];
    for (const write of writes) {
      await this.upsert(write.collection, write.id, write.data);
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-appwrite-project': this.config.projectId,
      'x-appwrite-key': this.config.apiKey,
    };
  }

  private docUrl(collection: CapsCollection, id: string): string {
    return `${this.config.endpoint}/databases/${this.config.databaseId}/collections/${collection}/documents/${id}`;
  }

  private async upsert(collection: CapsCollection, id: string, data: Record<string, unknown>): Promise<void> {
    if (!this.putUnsupported) {
      const res = await fetch(this.docUrl(collection, id), {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ data }),
      });
      if (res.ok) return;
      if (res.status !== 404 && res.status !== 405) {
        throw new Error(`appwrite upsert 실패 ${collection}/${id}: ${res.status} ${await res.text()}`);
      }
      // 404/405는 PUT 라우트 미지원으로 보고 생성→갱신 경로로 내려간다.
      this.putUnsupported = true;
    }

    const created = await fetch(
      `${this.config.endpoint}/databases/${this.config.databaseId}/collections/${collection}/documents`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ documentId: id, data }),
      },
    );
    if (created.ok) return;
    if (created.status !== 409) {
      throw new Error(`appwrite create 실패 ${collection}/${id}: ${created.status} ${await created.text()}`);
    }
    const updated = await fetch(this.docUrl(collection, id), {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ data }),
    });
    if (!updated.ok) {
      throw new Error(`appwrite update 실패 ${collection}/${id}: ${updated.status} ${await updated.text()}`);
    }
  }
}
