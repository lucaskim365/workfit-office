/**
 * 대체휴무 스크립트 공용 — Appwrite 접속, 결재 문서 읽기(읽기만), 근태 정책 휴게시간.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';

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

export function connect() {
  const isProd = process.argv.includes('--prod');
  const endpoint = readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT');
  const projectId = isProd ? '6a6bf85e002acb7f71d6' : (readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID'));
  const dbId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID') ?? 'workfit';
  const apiKey = isProd
    ? (readEnv('APPWRITE_API_KEY_PROD') ?? readEnv('APPWRITE_API_KEY'))
    : (readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV'));
  if (!endpoint || !projectId || !apiKey) {
    console.error('필수 env 누락: APPWRITE_ENDPOINT / PROJECT_ID / API_KEY');
    process.exit(1);
  }
  const dbs = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
  return { dbs, dbId, isProd, projectId };
}

/** 컬렉션 전체 읽기 */
export async function listAll(dbs: Databases, dbId: string, coll: string, queries: string[] = []): Promise<any[]> {
  const out: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await dbs.listDocuments(dbId, coll, [...queries, Query.limit(100), Query.offset(offset)]);
    out.push(...res.documents);
    if (res.documents.length < 100) break;
  }
  return out;
}

/** 결재 문서(payload 전체) — 읽기만 한다. 시행대기는 완료로 본다(앱과 같음). */
export async function loadApprovalDocs(dbs: Databases, dbId: string, docTypes?: readonly string[]): Promise<any[]> {
  const rows = await listAll(dbs, dbId, 'approvalDocs', docTypes ? [Query.equal('docType', [...docTypes])] : []);
  return rows
    .map((r) => {
      try {
        const d = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
        return d ? { ...d, status: d.status === '시행대기' ? '완료' : d.status } : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** 기본 근태 정책의 휴게시간 — 없으면 12:30~13:30 */
export async function loadBreakPolicy(dbs: Databases, dbId: string): Promise<{ breakStartTime: string; breakEndTime: string }> {
  try {
    const rows = await listAll(dbs, dbId, 'commutePolicies');
    const p = rows.find((r) => r.isDefault) ?? rows[0];
    if (p?.breakStartTime && p?.breakEndTime) return { breakStartTime: p.breakStartTime, breakEndTime: p.breakEndTime };
  } catch {
    /* 기본값 */
  }
  return { breakStartTime: '12:30', breakEndTime: '13:30' };
}
