import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_GENERAL_TAGS } from '../src/domain/workPlan/tag';

/**
 * 업무계획 일반 태그 기본값 시드 — workPlanTags가 비어 있을 때만 기본 태그(DEFAULT_GENERAL_TAGS)를 만든다.
 * 하나라도 있으면 아무것도 하지 않고 끝낸다(기존 태그를 건드리지 않는다).
 * 사용: npx tsx scripts/provision-work-plan-tags.ts [--prod]
 */
/** appwrite-schema.ts와 같은 방식 — 프로세스 환경변수 우선, 없으면 .env.local. */
function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`));
    if (m) return m[1].trim();
  }
  return undefined;
}

async function main() {
  const isProd = process.argv.includes('--prod');
  const endpoint = (readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT'))?.replace(/\/$/, '');
  const projectId = isProd
    ? '6a6bf85e002acb7f71d6'
    : (readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID'));
  const DB = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
  const apiKey = isProd
    ? (readEnv('APPWRITE_API_KEY_PROD') ?? readEnv('APPWRITE_API_KEY'))
    : (readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV'));
  if (!endpoint || !projectId || !apiKey) {
    console.error('Appwrite 접속 정보(endpoint/project/API key)를 찾을 수 없습니다.');
    process.exit(1);
  }
  console.log(`[work-plan-tags-provision] ${endpoint} / project=${projectId} / db=${DB}`);

  const HEADERS = {
    'Content-Type': 'application/json',
    'X-Appwrite-Project': projectId,
    'X-Appwrite-Key': apiKey,
  };

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${endpoint}${path}`, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, data: json };
  }

  const list = await call('GET', `/databases/${DB}/collections/workPlanTags/documents`);
  if (list.status !== 200) {
    console.error('  ✕ workPlanTags 조회 실패(컬렉션이 있는지 확인하세요):', list.status, list.data);
    process.exit(1);
  }
  if ((list.data.total ?? 0) > 0) {
    console.log(`  • 이미 태그가 ${list.data.total}개 있어 아무것도 하지 않습니다.`);
    return;
  }

  for (const [index, tag] of DEFAULT_GENERAL_TAGS.entries()) {
    const id = `WT-${String(index + 1).padStart(4, '0')}`;
    const res = await call('POST', `/databases/${DB}/collections/workPlanTags/documents`, {
      documentId: id,
      data: { id, name: tag.name, colorId: tag.colorId, order: index + 1, hidden: false },
      permissions: ['read("any")', 'update("any")', 'delete("any")'],
    });
    if (res.status === 201) console.log(`  ✓ ${id} ${tag.name} 생성`);
    else console.warn(`  ! ${id} 생성 응답:`, res.status, res.data);
  }
}

main().catch(console.error);
