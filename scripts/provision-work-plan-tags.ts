import { loadAppwriteConfig } from './appwrite-dev-env';
import { DEFAULT_GENERAL_TAGS } from '../src/domain/workPlan/tag';

/**
 * 업무계획 일반 태그 기본값 시드 — workPlanTags가 비어 있을 때만 5개를 만든다.
 * 하나라도 있으면 아무것도 하지 않고 끝낸다(기존 태그를 건드리지 않는다).
 * 사용: npx tsx scripts/provision-work-plan-tags.ts [--prod]
 */
async function main() {
  const isProd = process.argv.includes('--prod');
  const config = loadAppwriteConfig('workfit', isProd);
  if (!config?.apiKey) {
    console.error('No API key found in env');
    process.exit(1);
  }
  const { endpoint, projectId, apiKey, databaseId: DB } = config;
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
