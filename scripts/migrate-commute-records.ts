import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function getEnvMap(): Map<string, string> {
  const path = resolve(process.cwd(), '.env.local');
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let val = match[2].trim();
    // remove inline comments if not inside quotes
    if (val.startsWith('"')) {
      const closing = val.indexOf('"', 1);
      if (closing !== -1) {
        val = val.substring(1, closing);
      }
    } else {
      val = val.split('#')[0].trim();
    }
    map.set(match[1], val);
  }
  return map;
}

/**
 * 개발 DB에서 출퇴근 관련 데이터(employees, attendance, holidays)만 읽어서
 * 운영 DB로 1회 안전하게 복사(마이그레이션)하는 스크립트.
 *
 * 절대 다른 컬렉션(approvalDocs, approvalForms, users 등)은 건드리지 않습니다.
 */
async function main() {
  const envMap = getEnvMap();
  const endpoint = (envMap.get('APPWRITE_ENDPOINT_DEV') ?? envMap.get('VITE_APPWRITE_ENDPOINT') ?? '').replace(/\/$/, '');
  const databaseId = envMap.get('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';

  const devConfig = {
    endpoint,
    databaseId,
    projectId: envMap.get('APPWRITE_PROJECT_ID_DEV') ?? envMap.get('VITE_APPWRITE_PROJECT_ID') ?? '6a8288390007f641306d',
    apiKey: envMap.get('APPWRITE_API_KEY_DEV') ?? envMap.get('APPWRITE_API_KEY') ?? '',
  };

  const prodConfig = {
    endpoint,
    databaseId,
    projectId: envMap.get('APPWRITE_PROJECT_ID_PROD') ?? '6a6bf85e002acb7f71d6',
    apiKey: envMap.get('APPWRITE_API_KEY_PROD') ?? '',
  };

  if (!devConfig.apiKey || !prodConfig.apiKey) {
    console.error('API Key가 누락되었습니다. (.env.local 확인)');
    process.exit(1);
  }

  console.log('=== 출퇴근 데이터 마이그레이션 시작 ===');
  console.log(`Source (Dev):  ${devConfig.endpoint} / project=${devConfig.projectId}`);
  console.log(`Target (Prod): ${prodConfig.endpoint} / project=${prodConfig.projectId}`);

  const devHeaders = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': devConfig.projectId,
    'X-Appwrite-Key': devConfig.apiKey,
  };

  const prodHeaders = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': prodConfig.projectId,
    'X-Appwrite-Key': prodConfig.apiKey,
  };

  const APPWRITE_SYSTEM_FIELDS = new Set([
    '$id',
    '$createdAt',
    '$updatedAt',
    '$permissions',
    '$databaseId',
    '$collectionId',
  ]);

  function cleanData(doc: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) {
      if (!APPWRITE_SYSTEM_FIELDS.has(key)) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async function fetchAllDevDocs(collectionId: string): Promise<any[]> {
    const allDocs: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const url = `${devConfig!.endpoint}/databases/${devConfig!.databaseId}/collections/${collectionId}/documents?limit=${limit}&offset=${offset}`;
      const res = await fetch(url, { headers: devHeaders });
      if (!res.ok) {
        throw new Error(`[Dev] ${collectionId} 조회 실패: ${res.status} ${await res.text()}`);
      }
      const data = await res.json();
      const docs = data.documents || [];
      allDocs.push(...docs);
      if (docs.length < limit) break;
      offset += limit;
    }
    return allDocs;
  }

  async function copyCollection(collectionId: string) {
    console.log(`\n▶ [${collectionId}] 데이터 마이그레이션...`);
    const devDocs = await fetchAllDevDocs(collectionId);
    console.log(`  - 개발 DB에서 ${devDocs.length}개 문서 발견.`);

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of devDocs) {
      const docId = doc.$id;
      const payload = {
        documentId: docId,
        data: cleanData(doc),
        permissions: ['read("any")', 'update("any")'],
      };

      const url = `${prodConfig!.endpoint}/databases/${prodConfig!.databaseId}/collections/${collectionId}/documents`;
      const res = await fetch(url, {
        method: 'POST',
        headers: prodHeaders,
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        inserted += 1;
      } else if (res.status === 409) {
        // 이미 존재하는 문서는 안전하게 유지(skip)
        skipped += 1;
      } else {
        console.error(`  ✕ 문서 생성 실패 (${docId}): ${res.status}`, await res.text());
        failed += 1;
      }
    }

    console.log(`  ✓ [${collectionId}] 완료: 신규 삽입 ${inserted}건, 기존 유지 ${skipped}건, 실패 ${failed}건`);
  }

  // 엄격히 격리된 3개 출퇴근 전용 컬렉션만 마이그레이션
  const TARGET_COLLECTIONS = ['employees', 'attendance', 'holidays'];

  for (const coll of TARGET_COLLECTIONS) {
    await copyCollection(coll);
  }

  console.log('\n=== 모든 출퇴근 데이터 마이그레이션이 안전하게 완료되었습니다! ===');
}

main().catch((err) => {
  console.error('마이그레이션 오류:', err);
  process.exit(1);
});
