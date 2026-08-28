/**
 * Appwrite Storage 버킷 프로비저닝 — 업무관리 첨부 저장소.
 * ([[프로젝트관리_고도화_계획서.md]] §6)
 *
 * DB가 Appwrite면 파일도 같은 곳에 둔다. 별도 인프라가 없고 URL 수명이 프로젝트와 함께 간다.
 *
 * ⚠ 브라우저는 프로젝트 ID만 가진 익명 클라이언트라 **버킷 권한이 열려 있어야** 올릴 수
 *   있다. 컬렉션의 `Any` 권한과 같은 부채이고 Appwrite Auth 도입 때 함께 좁힌다.
 *
 * 실행: npx tsx scripts/appwrite-storage.ts
 *       npx tsx scripts/appwrite-storage.ts --bucket=workfiles
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Permission, Role, Storage } from 'node-appwrite';

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

/** 첨부 상한 — Appwrite 기본 30MB 안쪽으로 둔다. */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function main() {
  const bucketId = process.argv.find((a) => a.startsWith('--bucket='))?.slice('--bucket='.length)
    ?? readEnv('VITE_APPWRITE_BUCKET_ID')
    ?? 'workfiles';

  const endpoint = (readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT') ?? '').replace(/^http:/, 'https:');
  const projectId = readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID');
  const apiKey = readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV');
  if (!endpoint || !projectId || !apiKey) {
    console.error('필수 env 누락: APPWRITE_ENDPOINT / APPWRITE_PROJECT_ID / APPWRITE_API_KEY');
    process.exit(1);
  }

  const storage = new Storage(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
  console.log(`▶ Storage 버킷 프로비저닝 — ${endpoint} / project ${projectId} / bucket ${bucketId}`);

  try {
    const found = await storage.getBucket(bucketId);
    console.log(`• 버킷 "${found.$id}" 이미 있음 — 건너뜀`);
    return;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 404) throw error;
  }

  await storage.createBucket(
    bucketId,
    '업무관리 첨부',
    [
      Permission.create(Role.any()),
      Permission.read(Role.any()),
      Permission.update(Role.any()),
      Permission.delete(Role.any()),
    ],
    /* fileSecurity */ false,
    /* enabled */ true,
    MAX_FILE_SIZE,
  );
  console.log(`✓ 버킷 "${bucketId}" 생성 (최대 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB, 권한 Any)`);
  console.log('  ⚠ 운영 전에는 권한을 좁혀야 한다 — 지금은 누구나 올리고 지울 수 있다.');
}

main().catch((error) => {
  console.error('✗ 버킷 프로비저닝 실패:', error);
  process.exit(1);
});
