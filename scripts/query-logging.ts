import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';

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

async function queryCloudLogging() {
  const projectId = readEnv('VITE_FB_PROJECT_ID');
  if (!projectId) throw new Error('VITE_FB_PROJECT_ID 를 찾을 수 없습니다.');

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? resolve(process.cwd(), 'serviceAccount.json');
  if (!existsSync(keyPath)) throw new Error('서비스 계정 키를 찾을 수 없습니다.');
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const auth = new google.auth.JWT(
    serviceAccount.client_email,
    undefined,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/logging.read']
  );

  const logging = google.logging({ version: 'v2', auth });

  console.log('GCP Cloud Logging에서 7월 14일 이후의 모든 approvalDocs 관련 로그 조회 중...');
  
  // 7월 14일 이후의 모든 approvalDocs 관련 로그 검색 필터
  const filter = `resource.type="audited_resource" AND resource.labels.service="firestore.googleapis.com" AND protoPayload.resourceName:"databases/(default)/documents/approvalDocs" AND timestamp >= "2026-07-14T00:00:00Z"`;
  
  try {
    const res = await logging.entries.list({
      requestBody: {
        resourceNames: [`projects/${projectId}`],
        filter: filter,
        orderBy: 'timestamp desc',
        pageSize: 100
      }
    });

    const entries = res.data.entries || [];
    console.log(`총 ${entries.length}개의 감사 로그를 발견했습니다.`);
    
    for (const entry of entries) {
      console.log(`\n=============================================`);
      console.log(`[시간: ${entry.timestamp}] - 작업: ${entry.protoPayload?.methodName}`);
      console.log(`자원: ${entry.protoPayload?.resourceName}`);
      if (entry.protoPayload?.request) {
        console.log('요청 페이로드 데이터:', JSON.stringify(entry.protoPayload.request, null, 2));
      }
    }
  } catch (e: any) {
    console.error('Cloud Logging 조회 중 오류 발생:', e.message);
  }
}

queryCloudLogging().catch(console.error);
