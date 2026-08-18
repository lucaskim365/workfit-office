import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { CapsAppwriteStore } from '../server/caps/appwriteStore';
import { CapsFileStore } from '../server/caps/fileStore';
import { handleCapsIngest } from '../server/caps/handler';
import type { CapsCollection, CapsStore } from '../server/caps/store';
import { loadAppwriteDevConfig } from './appwrite-dev-env';

/**
 * CAPS 인제스트 로컬 수신 서버 — Firebase 없는 개발 환경용.
 *
 * Vercel 함수와 같은 handler를 파일 저장소로 돌린다. C# 에이전트의 `IngestUrl`을
 * `http://localhost:3020/api/ingest`로 바꾸면(테스트 주기 1분) 실제 에이전트로
 * 전 구간을 검증할 수 있고, 결과는 `.caps-local/*.json`에서 눈으로 확인한다.
 *
 * 실행:
 *   $env:CAPS_INGEST_SECRET = '<에이전트 secret.txt와 같은 값>'
 *   npx tsx scripts/caps-ingest-dev.ts
 * (또는 CAPS_INGEST_SECRET_FILE 로 시크릿 파일 경로 지정 — 값이 로그에 남지 않는다)
 */
const PORT = Number(process.env.CAPS_INGEST_PORT ?? 3020);

function loadSecret(): string {
  const file = process.env.CAPS_INGEST_SECRET_FILE;
  if (file) return readFileSync(file, 'utf8').trim();
  const value = process.env.CAPS_INGEST_SECRET?.trim();
  if (!value) {
    console.error('CAPS_INGEST_SECRET(또는 CAPS_INGEST_SECRET_FILE)이 필요합니다. 에이전트 secret.txt와 같은 값이어야 합니다.');
    process.exit(1);
  }
  return value;
}

/** 파일 + Appwrite 이중 기록. GET 조회는 계속 파일에서, Appwrite는 적재 검증·이관 준비용. */
class CapsTeeStore implements CapsStore {
  constructor(private readonly stores: CapsStore[]) {}
  mergeSet(collection: CapsCollection, id: string, data: Record<string, unknown>): void {
    for (const s of this.stores) s.mergeSet(collection, id, data);
  }
  async flush(): Promise<void> {
    for (const s of this.stores) await s.flush();
  }
}

const secret = loadSecret();
const fileStore = new CapsFileStore();
const appwriteConfig = loadAppwriteDevConfig();
const store: CapsStore = appwriteConfig
  ? new CapsTeeStore([fileStore, new CapsAppwriteStore(appwriteConfig)])
  : fileStore;
if (appwriteConfig) {
  console.log(`[caps-ingest] Appwrite 이중 기록 활성: ${appwriteConfig.endpoint} (db=${appwriteConfig.databaseId})`);
}

/** 화면(:3000)이 파일 데이터를 읽어가는 개발용 조회 GET. 브라우저 호출이라 CORS를 연다. */
const CORS = {
  'content-type': 'application/json',
  'access-control-allow-origin': 'http://localhost:3000',
};

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

      if (req.method === 'GET' && url.pathname === '/api/local/employees') {
        res.writeHead(200, CORS);
        res.end(JSON.stringify(Object.values(fileStore.read('employees'))));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/local/attendance') {
        const empId = Number(url.searchParams.get('empId'));
        const month = url.searchParams.get('month') ?? '';
        const rows = Object.values(fileStore.read('attendance'))
          .filter((row) => row.empId === empId && String(row.date ?? '').startsWith(month));
        res.writeHead(200, CORS);
        res.end(JSON.stringify(rows));
        return;
      }

      if (req.method !== 'POST' || !url.pathname.startsWith('/api/ingest')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'not_found' }));
        return;
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
      const result = await handleCapsIngest({
        rawBody,
        timestamp: first(req.headers['x-caps-timestamp']),
        signature: first(req.headers['x-caps-signature']),
        secret,
        store,
      });

      res.writeHead(result.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result.body));
      console.log(`[caps-ingest] ${new Date().toLocaleTimeString()} ${result.status} ${JSON.stringify(result.body).slice(0, 160)}`);
    })();
  });
});

server.listen(PORT, () => {
  console.log(`[caps-ingest] http://localhost:${PORT}/api/ingest 에서 수신 대기 중 (저장: .caps-local/)`);
});
