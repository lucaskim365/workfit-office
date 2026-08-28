/**
 * 업무관리 트리 이관 — 옛 `workPhases` + 평면 `workTasks` → 대·중 과업 트리.
 * ([[프로젝트관리_고도화_계획서.md]] §12)
 *
 * 옛 구조는 2단이었다. 단계(workPhases)를 **대과업으로 승격**하고, 그 단계에 걸려 있던
 * 작업을 **그 아래 중과업으로** 옮긴다. 단계에 안 걸린 작업은 대과업으로 눕힌다.
 *
 * ## 순서를 지켜야 하는 이유
 * `workTasks.phaseId`가 "무엇이 무엇의 하위였는지"를 아는 **유일한 근거**다. 이 이관보다
 * 먼저 지우면 복원할 방법이 없다. 그래서 이관은 `phaseId`가 살아 있는 동안 돌려야 하고,
 * 승격으로 만드는 새 과업에도 출신 단계 id를 그대로 넣는다(속성이 아직 required다).
 *
 * ## 실행
 *   npx tsx scripts/migrate-work-tree.ts              # dry-run — 계획만 출력
 *   npx tsx scripts/migrate-work-tree.ts --apply      # 실제 적용
 *   npx tsx scripts/migrate-work-tree.ts --project=PRJ-0001 --apply
 *
 * 대상은 `.env.local`의 dev 프로젝트다. 운영에 돌리려면 `APPWRITE_PROJECT_ID`를 명시한다.
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

/** 형제 순번 → 경로 한 마디. 도메인의 `path.ts`와 같은 규칙(4자리 제로패딩). */
const seg = (order: number) => String(order).padStart(4, '0');

interface PhaseRow { $id: string; id: string; projectId: string; name: string; sortOrder: number }
interface TaskRow {
  $id: string; id: string; projectId: string; phaseId: string | null;
  title: string; sortOrder: number; assigneeUserId: string;
  trackId: string | null; parentId: string | null; level: number | null; path: string | null;
}

async function listAll<T>(dbs: Databases, dbId: string, coll: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await dbs.listDocuments(dbId, coll, [Query.limit(100), Query.offset(offset)]);
    out.push(...(res.documents as unknown as T[]));
    if (res.documents.length < 100) break;
  }
  return out;
}

/**
 * 레거시 `phaseId` 속성 제거 — **이관을 마치고 화면으로 확인한 뒤에만** 돌린다.
 *
 * 이 속성이 "무엇이 무엇의 하위였는지"를 아는 유일한 근거라 먼저 지우면 복원할 수 없다.
 * 지운 뒤에는 앱도 이 필드를 보내면 안 된다(`Unknown attribute` 오류) — 코드에서 함께 뺀다.
 */
async function dropPhaseId(dbs: Databases, dbId: string) {
  const tasks = await listAll<TaskRow>(dbs, dbId, 'workTasks');
  const orphan = tasks.filter((t) => !t.parentId && !t.path);
  if (orphan.length > 0) {
    console.error(`✗ 아직 트리로 안 옮겨진 작업이 ${orphan.length}건 있습니다. 먼저 --apply 로 이관하세요.`);
    process.exit(1);
  }
  await dbs.deleteAttribute(dbId, 'workTasks', 'phaseId');
  console.log('✅ workTasks.phaseId 속성을 제거했습니다.');
  console.log('   workPhases 컬렉션은 남겨 둡니다 — 원본 단계 이름을 되짚을 마지막 근거입니다.');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const only = process.argv.find((a) => a.startsWith('--project='))?.slice('--project='.length);

  const endpoint = (readEnv('APPWRITE_ENDPOINT') ?? readEnv('VITE_APPWRITE_ENDPOINT') ?? '').replace(/^http:/, 'https:');
  const projectId = readEnv('APPWRITE_PROJECT_ID') ?? readEnv('VITE_APPWRITE_PROJECT_ID');
  const dbId = readEnv('APPWRITE_DATABASE_ID') ?? readEnv('VITE_APPWRITE_DATABASE_ID');
  const apiKey = readEnv('APPWRITE_API_KEY') ?? readEnv('APPWRITE_API_KEY_DEV');
  if (!endpoint || !projectId || !dbId || !apiKey) {
    console.error('필수 env 누락: APPWRITE_ENDPOINT / PROJECT_ID / DATABASE_ID / API_KEY');
    process.exit(1);
  }

  const dbs = new Databases(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));

  if (process.argv.includes('--drop-phase-id')) {
    await dropPhaseId(dbs, dbId);
    return;
  }

  console.log(`▶ 업무관리 트리 이관 ${apply ? '[적용]' : '[DRY-RUN — 아무것도 바꾸지 않습니다]'}`);
  console.log(`  ${endpoint} / project ${projectId} / db ${dbId}\n`);

  const phases = await listAll<PhaseRow>(dbs, dbId, 'workPhases');
  const tasks = await listAll<TaskRow>(dbs, dbId, 'workTasks');
  console.log(`  단계 ${phases.length}건 · 작업 ${tasks.length}건 조회\n`);

  const projectIds = [...new Set([...phases, ...tasks].map((r) => r.projectId))]
    .filter((id) => !only || id === only)
    .sort();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const pid of projectIds) {
    const myPhases = phases.filter((p) => p.projectId === pid).sort((a, b) => a.sortOrder - b.sortOrder);
    const myTasks = tasks.filter((t) => t.projectId === pid);

    // 이미 트리로 옮겨진 프로젝트는 건드리지 않는다 — 두 번 돌려도 안전해야 한다.
    const alreadyTree = myTasks.some((t) => t.parentId) || myPhases.length === 0;
    if (alreadyTree) {
      console.log(`[${pid}] 이관 불필요 — 단계 ${myPhases.length}건, 작업 ${myTasks.length}건`);
      skipped += myTasks.length;
      continue;
    }

    console.log(`[${pid}] 단계 ${myPhases.length}건 → 대과업 승격, 작업 ${myTasks.length}건 재배치`);

    // 승격된 단계가 대과업 0..n-1, 단계에 안 걸린 작업이 그 뒤를 잇는다.
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const promoted = new Map<string, { id: string; path: string }>();
    let rootOrder = 0;

    for (const phase of myPhases) {
      const newId = `TASK-${stamp}-${String(9000 + created + 1).padStart(4, '0')}`;
      const path = seg(rootOrder);
      promoted.set(phase.id, { id: newId, path });
      const owner = myTasks.find((t) => t.phaseId === phase.id)?.assigneeUserId ?? 'U001';
      console.log(`   + 대과업 "${phase.name}" (${newId}, path ${path})`);
      if (apply) {
        await dbs.createDocument(dbId, 'workTasks', newId, {
          id: newId,
          projectId: pid,
          trackId: null,
          parentId: null,
          level: 1,
          path,
          // 속성이 아직 required 다. 출신 단계를 그대로 넣어 두면 되돌릴 근거도 남는다.
          phaseId: phase.id,
          title: phase.name,
          description: '',
          assigneeUserId: owner,
          startAt: null,
          dueAt: null,
          status: 'TODO',
          progress: 0,
          sortOrder: rootOrder,
          completedAt: null,
          version: 1,
          createdBy: owner,
          createdAt: new Date().toISOString(),
          updatedBy: owner,
          updatedAt: new Date().toISOString(),
        });
      }
      created += 1;
      rootOrder += 1;
    }

    const childOrder = new Map<string, number>();
    for (const task of myTasks.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))) {
      const parent = task.phaseId ? promoted.get(task.phaseId) : undefined;
      let patch: Record<string, unknown>;
      if (parent) {
        const order = childOrder.get(parent.id) ?? 0;
        childOrder.set(parent.id, order + 1);
        patch = { trackId: null, parentId: parent.id, level: 2, path: `${parent.path}.${seg(order)}`, sortOrder: order };
        console.log(`   · "${task.title}" → 중과업 (${patch.path})`);
      } else {
        // 단계가 없거나 사라진 작업은 대과업으로 눕힌다. 조용히 버리지 않는다.
        patch = { trackId: null, parentId: null, level: 1, path: seg(rootOrder), sortOrder: rootOrder };
        console.log(`   · "${task.title}" → 대과업 (단계 없음, ${patch.path})`);
        rootOrder += 1;
      }
      if (apply) await dbs.updateDocument(dbId, 'workTasks', task.$id, patch);
      updated += 1;
    }
    console.log('');
  }

  console.log(`\n${apply ? '✅ 적용 완료' : '📋 계획'} — 대과업 생성 ${created} · 작업 갱신 ${updated} · 건너뜀 ${skipped}`);
  if (!apply) console.log('\n실제로 적용하려면 --apply 를 붙여 다시 실행하세요.');
  else console.log('\n다음: 화면에서 트리를 확인한 뒤 workTasks.phaseId 속성을 제거하세요(계획서 §12).');
}

main().catch((error) => {
  console.error('✗ 이관 실패:', error);
  process.exit(1);
});
