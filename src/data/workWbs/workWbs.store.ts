import { WORK_PHASE_FIXTURE, WORK_TASK_FIXTURE } from './workWbs.fixture';
import { workPhaseSchema, type WorkPhase } from '@/domain/workPhase/schema';
import { workTaskSchema, type WorkTask } from '@/domain/workTask/schema';
import { createCrudBackend } from '@/data/_backend/crudBackend';
import { dbDriver } from '@/shared/lib/dbDriver';

/**
 * WBS 공유 저장소 — 단계(workPhases)와 작업(workTasks)을 함께 다룬다.
 * 저장은 공유 CrudBackend(VITE_DB_DRIVER)로 위임한다.
 * ([[data-layer-pattern]] 정본 패턴 / [[Firestore_Appwrite_이관_단계별_계획서]] Phase 3)
 *
 * 두 repo(`workPhase`, `workTask`)가 서로의 데이터를 교차 참조한다. 단계를 지우려면
 * 그 단계에 걸린 작업이 없어야 하고, 작업을 정렬하려면 단계의 `sortOrder` 가 필요하다.
 * 그래서 repo 를 나누지 않고 이 파일에서 함께 들고 있다.
 *
 * 읽기 헬퍼(`readWorkPhases`/`readWorkTasks`)는 **동기로 유지한다.** 두 repo 안에서
 * 채번·정렬·검증에 20곳 넘게 쓰이는데 전부 async 로 바꾸면 변경 범위만 커지고 얻는 게
 * 없다. 대신 공개 메서드 진입점에서 `loadWorkWbs()` 로 캐시를 채운 뒤 동기로 읽는다.
 *
 * ⚠ memory 드라이버에서는 **이 캐시가 곧 저장소다.** 그래서 백엔드에 위임하지 않고
 * 아래 로컬 배열만 갱신한다(백엔드의 별도 in-memory 사본과 이중 관리되지 않도록).
 */

let phases: WorkPhase[] = WORK_PHASE_FIXTURE.map((phase) => ({ ...phase }));
let tasks: WorkTask[] = WORK_TASK_FIXTURE.map((task) => ({ ...task }));

/** 문서별 안전 파싱 — 불량 문서 하나 때문에 WBS 전체가 안 열리지 않도록 건너뛴다. */
const phaseBackend = createCrudBackend<WorkPhase>({
  coll: 'workPhases',
  parse: (raw) => {
    const parsed = workPhaseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: WORK_PHASE_FIXTURE.map((phase) => ({ ...phase })),
});

const taskBackend = createCrudBackend<WorkTask>({
  coll: 'workTasks',
  parse: (raw) => {
    const parsed = workTaskSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
  idOf: (row) => row.id,
  seed: WORK_TASK_FIXTURE.map((task) => ({ ...task })),
});

/**
 * 저장소 → 캐시 적재. repo 의 공개 메서드마다 처음에 부른다.
 *
 * 매번 다시 읽는다. 한 번만 읽고 캐시하면 다른 사용자가 만든 작업이 보이지 않는다.
 * 다른 repo 의 `loadAll()` 과 같은 비용 구조다.
 * memory 드라이버(로컬)면 아무것도 하지 않고 fixture 를 그대로 쓴다.
 */
export async function loadWorkWbs(): Promise<void> {
  if (dbDriver === 'memory') return;
  const [nextPhases, nextTasks] = await Promise.all([phaseBackend.loadAll(), taskBackend.loadAll()]);
  phases = nextPhases;
  tasks = nextTasks;
}

export function readWorkPhases(): WorkPhase[] {
  return phases.map((phase) => ({ ...phase }));
}

export function replaceWorkPhases(next: WorkPhase[]): void {
  phases = next.map((phase) => ({ ...phase }));
}

export function readWorkTasks(): WorkTask[] {
  return tasks.map((task) => ({ ...task }));
}

export function replaceWorkTasks(next: WorkTask[]): void {
  tasks = next.map((task) => ({ ...task }));
}

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((item) => item.id === row.id);
  return index >= 0 ? rows.map((item, itemIndex) => (itemIndex === index ? row : item)) : [...rows, row];
}

/** 단계 한 건 저장(신규·수정 공통). 저장소와 캐시를 함께 갱신한다. */
export async function saveWorkPhase(phase: WorkPhase): Promise<void> {
  if (dbDriver !== 'memory') await phaseBackend.save(phase);
  phases = upsert(phases, phase);
}

/** 단계 한 건 삭제. 걸린 작업이 없는지는 호출부가 먼저 확인한다. */
export async function deleteWorkPhase(id: string): Promise<void> {
  if (dbDriver !== 'memory') await phaseBackend.remove(id);
  phases = phases.filter((phase) => phase.id !== id);
}

/** 작업 한 건 저장(신규·수정 공통). */
export async function saveWorkTask(task: WorkTask): Promise<void> {
  if (dbDriver !== 'memory') await taskBackend.save(task);
  tasks = upsert(tasks, task);
}

/** 작업 한 건 삭제. */
export async function deleteWorkTask(id: string): Promise<void> {
  if (dbDriver !== 'memory') await taskBackend.remove(id);
  tasks = tasks.filter((task) => task.id !== id);
}
