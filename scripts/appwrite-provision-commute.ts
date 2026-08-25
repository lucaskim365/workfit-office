import { loadAppwriteConfig } from './appwrite-dev-env';

/**
 * Appwrite dev 프로젝트 근태 스키마 멱등 프로비저닝.
 *
 * Appwrite는 Firestore와 달리 컬렉션 attribute를 선정의해야 한다. 콘솔 수동 편집 대신
 * 이 스크립트를 dev/prod 프로젝트에 각각 실행해 스키마를 동기화한다(이미 있으면 409 → 통과).
 *
 * 실행: npx tsx scripts/appwrite-provision-commute.ts [--prod]
 * (.env.local의 APPWRITE_ENDPOINT_DEV / APPWRITE_PROJECT_ID_DEV / APPWRITE_API_KEY_DEV 사용)
 *
 * 참고: 모든 attribute는 required:false로 둔다 — 페이로드의 null(inAt·retireDate 등)을
 * 그대로 저장하고, 이후 스키마 확장 시 기존 문서와 충돌하지 않기 위해서다.
 */
const IS_PROD = process.argv.includes('--prod');
const config = loadAppwriteConfig('workfit', IS_PROD);
if (!config) {
  console.error('.env.local에 Appwrite 접속 정보가 필요합니다(dev: APPWRITE_*_DEV / 운영: APPWRITE_API_KEY_PROD).');
  process.exit(1);
}

const HEADERS = {
  'content-type': 'application/json',
  'x-appwrite-project': config.projectId,
  'x-appwrite-key': config.apiKey,
};

type Attr =
  | { kind: 'string'; key: string; size: number }
  | { kind: 'integer'; key: string }
  | { kind: 'boolean'; key: string }
  | { kind: 'datetime'; key: string };

const str = (key: string, size: number): Attr => ({ kind: 'string', key, size });
const int = (key: string): Attr => ({ kind: 'integer', key });
const bool = (key: string): Attr => ({ kind: 'boolean', key });
const dt = (key: string): Attr => ({ kind: 'datetime', key });

/** 계약(ingest-api-and-schema.md §4·§5)과 upsert.ts가 쓰는 필드 그대로. raw·counts는 JSON 문자열. */
const COLLECTIONS: Record<string, Attr[]> = {
  employees: [int('empId'), str('name', 100), bool('active'), str('retireDate', 10), dt('updatedAt')],
  attendance: [
    int('empId'), str('date', 10), dt('inAt'), dt('outAt'),
    int('basicMin'), int('overMin'), int('nightMin'), int('lateMin'), int('totalMin'),
    str('status', 20), str('raw', 8000), dt('updatedAt'),
  ],
  holidays: [bool('recurring'), str('monthDay', 5), str('date', 10), str('name', 100)],
  syncMeta: [dt('lastRunAt'), str('windowStart', 10), str('counts', 1000), str('lastError', 2000)],
  userMap: [int('empId'), str('uid', 64)],
};

const INDEXES: Record<string, Array<{ key: string; attributes: string[] }>> = {
  attendance: [
    { key: 'idx_empId_date', attributes: ['empId', 'date'] },
    // 하루치 전 직원 조회용. 위 복합 인덱스는 empId가 앞이라 날짜만으로는 못 탄다.
    { key: 'idx_date', attributes: ['date'] },
  ],
};

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; text: string }> {
  const res = await fetch(`${config!.endpoint}${path}`, {
    method,
    headers: HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

/** 2xx=생성, 409=이미 있음 → 둘 다 성공으로 본다. */
async function ensure(label: string, method: string, path: string, body: unknown): Promise<void> {
  const { status, text } = await call(method, path, body);
  if (status === 409) { console.log(`  = ${label} (이미 있음)`); return; }
  /*
    인덱스는 같은 키가 아니라 **같은 속성 조합**이 이미 있으면 409가 아니라 400
    `index_invalid`를 준다. 재실행 안전(멱등)이 이 스크립트의 전제이므로 이것도 통과시킨다.
  */
  if (status === 400 && text.includes('already an index with the same attributes')) {
    console.log(`  = ${label} (같은 인덱스 존재)`);
    return;
  }
  if (status >= 200 && status < 300) { console.log(`  + ${label}`); return; }
  throw new Error(`${label} 실패: ${status} ${text}`);
}

async function waitAttributesAvailable(collectionId: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { status, text } = await call('GET', `/databases/${config!.databaseId}/collections/${collectionId}/attributes`);
    if (status !== 200) throw new Error(`attribute 상태 조회 실패(${collectionId}): ${status} ${text}`);
    const parsed = JSON.parse(text) as { attributes: Array<{ key: string; status: string }> };
    const notReady = parsed.attributes.filter((a) => a.status !== 'available');
    if (notReady.length === 0) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`attribute가 available 상태가 되지 않습니다: ${collectionId}`);
}

async function main(): Promise<void> {
  console.log(`[provision] ${config!.endpoint} / project=${config!.projectId} / db=${config!.databaseId}`);

  await ensure(`database ${config!.databaseId}`, 'POST', '/databases', {
    databaseId: config!.databaseId,
    name: 'WorkfitOffice',
  });

  for (const [collectionId, attrs] of Object.entries(COLLECTIONS)) {
    await ensure(`collection ${collectionId}`, 'POST', `/databases/${config!.databaseId}/collections`, {
      collectionId,
      name: collectionId,
      documentSecurity: false,
      permissions: [], // API Key(서버)만 접근 — 클라이언트 권한은 Auth 도입 때 결정
    });
    for (const attr of attrs) {
      const base = `/databases/${config!.databaseId}/collections/${collectionId}/attributes`;
      if (attr.kind === 'string') {
        await ensure(`${collectionId}.${attr.key}`, 'POST', `${base}/string`, { key: attr.key, size: attr.size, required: false });
      } else if (attr.kind === 'integer') {
        // min/max 생략 시 int64 극한값이 기본인데, 이 경우 워커가 processing에서 멈춘다(1.9.6에서 실측).
        await ensure(`${collectionId}.${attr.key}`, 'POST', `${base}/integer`, { key: attr.key, required: false, min: 0, max: 2147483647 });
      } else if (attr.kind === 'boolean') {
        await ensure(`${collectionId}.${attr.key}`, 'POST', `${base}/boolean`, { key: attr.key, required: false });
      } else {
        await ensure(`${collectionId}.${attr.key}`, 'POST', `${base}/datetime`, { key: attr.key, required: false });
      }
    }
    await waitAttributesAvailable(collectionId);
  }

  for (const [collectionId, indexes] of Object.entries(INDEXES)) {
    for (const index of indexes) {
      await ensure(`index ${collectionId}.${index.key}`, 'POST',
        `/databases/${config!.databaseId}/collections/${collectionId}/indexes`,
        { key: index.key, type: 'key', attributes: index.attributes });
    }
  }

  console.log('[provision] 완료');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
