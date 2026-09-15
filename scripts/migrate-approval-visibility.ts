import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';

function getEnvMap(): Map<string, string> {
  const map = new Map<string, string>();
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      } else {
        val = val.split('#')[0].trim();
      }
      if (!map.has(match[1])) {
        map.set(match[1], val);
      }
    }
  }
  return map;
}

interface TargetDocInfo {
  id: string;
  docNo: string;
  title: string;
  drafterName: string;
  drafterDept: string;
  currentVisibility: string;
}

async function main() {
  const isProd = process.argv.includes('--prod');
  const isExecute = process.argv.includes('--execute');
  const isDryRun = !isExecute || process.argv.includes('--dry-run');

  console.log('=====================================================');
  console.log('  WorkFit Approval Documents Visibility Migration');
  console.log('  전사문서 폐지 -> 부서문서 일괄 전환 마이그레이션 도구');
  console.log('=====================================================');
  console.log(`대상 환경: ${isProd ? '🔴 [운영 DB (PRODUCTION)]' : '🟢 [개발 DB (DEVELOPMENT)]'}`);
  console.log(`실행 모드: ${isExecute ? '🚀 [EXECUTE] 실제 DB 데이터 변경' : '🔍 [DRY-RUN] 시뮬레이션 (실제 변경 없음)'}`);

  const envMap = getEnvMap();
  const clean = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

  const endpoint = clean(
    (isProd ? envMap.get('APPWRITE_ENDPOINT_PROD') : null) ||
    process.env.VITE_APPWRITE_ENDPOINT ||
    envMap.get('VITE_APPWRITE_ENDPOINT') ||
    'https://appwrite.kimlucas.com/v1'
  ).replace(/\/$/, '');

  const projectId = clean(
    isProd
      ? (envMap.get('APPWRITE_PROJECT_ID_PROD') || '6a6bf85e002acb7f71d6')
      : (process.env.VITE_APPWRITE_PROJECT_ID || envMap.get('VITE_APPWRITE_PROJECT_ID') || '6a8288390007f641306d')
  );

  const apiKey = clean(
    isProd
      ? (envMap.get('APPWRITE_API_KEY_PROD') || process.env.APPWRITE_API_KEY_PROD || '')
      : (process.env.APPWRITE_API_KEY || envMap.get('APPWRITE_API_KEY') || envMap.get('APPWRITE_API_KEY_DEV') || '')
  );

  const databaseId = clean(process.env.VITE_APPWRITE_DATABASE_ID || envMap.get('VITE_APPWRITE_DATABASE_ID') || 'workfit');
  const collectionId = 'approvalDocs';

  if (!apiKey) {
    console.error(`\n⚠️ [주의] ${isProd ? '운영' : '개발'} DB 접근을 위한 API Key가 누락되었습니다.`);
    console.error(`(.env.local 파일에 ${isProd ? 'APPWRITE_API_KEY_PROD' : 'APPWRITE_API_KEY'} 확인 필요)\n`);
    if (isExecute) {
      process.exit(1);
    }
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  if (apiKey) {
    client.setKey(apiKey);
  }
  const databases = new Databases(client);

  console.log(`\n연결 정보:`);
  console.log(`- Endpoint:   ${endpoint}`);
  console.log(`- Project ID: ${projectId}`);
  console.log(`- Database:   ${databaseId}`);
  console.log(`- Collection: ${collectionId}`);
  console.log('-----------------------------------------------------');

  let totalScanned = 0;
  const targets: TargetDocInfo[] = [];
  const PAGE_SIZE = 100;
  let offset = 0;

  try {
    while (true) {
      const res = await databases.listDocuments(databaseId, collectionId, [
        Query.limit(PAGE_SIZE),
        Query.offset(offset),
      ]);

      for (const doc of res.documents) {
        totalScanned++;
        let payload: any = null;
        if (doc.payload) {
          try {
            payload = typeof doc.payload === 'string' ? JSON.parse(doc.payload) : doc.payload;
          } catch (e) {
            console.warn(`[문서 파싱 경고] ID ${doc.$id} payload JSON 파싱 실패`);
          }
        }

        const currentVis = payload?.visibility || doc.visibility;
        if (currentVis === '전사') {
          targets.push({
            id: doc.$id,
            docNo: doc.docNo || payload?.docNo || '(번호없음)',
            title: doc.title || payload?.title || '(제목없음)',
            drafterName: doc.drafterName || payload?.drafterName || '(기안자미상)',
            drafterDept: payload?.drafterDept || '(부서미상)',
            currentVisibility: currentVis,
          });

          if (isExecute && apiKey) {
            if (payload) {
              payload.visibility = '부서';
              await databases.updateDocument(databaseId, collectionId, doc.$id, {
                payload: JSON.stringify(payload),
              });
              console.log(`[업데이트 완료] ${doc.$id} (${doc.docNo || 'NO-DOC'}) - payload 내 '전사' -> '부서' 변경됨`);
            }
          }
        }
      }

      if (res.documents.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (err: any) {
    console.error('\n❌ DB 조회 중 오류 발생:', err.message || err);
    return;
  }

  console.log('\n=====================================================');
  console.log('                마이그레이션 결과 보고               ');
  console.log('=====================================================');
  console.log(`- 전체 스캔 문서 수: ${totalScanned} 건`);
  console.log(`- '전사' 문서 발견:   ${targets.length} 건`);
  console.log(`- 기부서/비공개 유지: ${totalScanned - targets.length} 건`);

  if (targets.length > 0) {
    console.log('\n[전환 대상 목록]');
    targets.forEach((t, i) => {
      console.log(` ${i + 1}. [${t.docNo}] "${t.title}" | 기안: ${t.drafterName}(${t.drafterDept}) | ID: ${t.id}`);
    });
  } else {
    console.log('\n🎉 전사 공개로 설정된 문서가 없습니다. (모든 문서가 이미 부서/비공개 상태입니다)');
  }

  if (isDryRun && targets.length > 0) {
    console.log('\n💡 안내: 현재는 시뮬레이션(Dry-Run) 모드였습니다.');
    console.log('실제 DB에 반영하시려면 다음 명령어를 실행하세요:');
    console.log('👉 npx tsx scripts/migrate-approval-visibility.ts --execute\n');
  } else if (isExecute && targets.length > 0) {
    console.log(`\n✅ 총 ${targets.length}건의 문서가 성공적으로 '부서' 문서로 전환되었습니다!\n`);
  }
}

main().catch(console.error);
