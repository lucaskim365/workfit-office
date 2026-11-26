import { PM_COLLS } from './pmDb';

/**
 * PM 컬렉션 23개 — 개발 · 운영 DB 에 있어야 할 모양과, 읽은 모양을 대조해 '빠진 것만 채우기'(7-4 --resume) 목록을 만든다.
 * 순수 함수만 (DB 읽기 · 쓰기는 scripts/pm-schema.ts).
 *
 * 있어야 할 모양은 공용 `scripts/appwrite-schema.ts` 의 `pmCollections()` 와 같은 값 — 그 파일은 불러오면 바로 실행되므로
 * 여기서 같은 규칙으로 다시 만들고, `pmSchemaPlan.test.ts` 가 공용 파일 글자와 맞는지 본다.
 *   S('id', 128, true) · S('kind', 32) · INT('at', true) · INT('seq', true) · S('body', 1_000_000, true) · 찾는 칸 S(f, 128)
 *   인덱스 IX(f, [f]) = key `idx_<칸>` · 종류 key · 칸 [f] / 권한 POC_PERMISSIONS (any 4개) / documentSecurity false
 */
export interface PmAttrWant { key: string; type: 'string' | 'integer'; size?: number; required: boolean }
export interface PmIndexWant { key: string; type: 'key'; attributes: string[] }
export interface PmCollWant { id: string; name: string; attributes: PmAttrWant[]; indexes: PmIndexWant[]; permissions: string[] }

export const PM_PERMISSIONS = ['read("any")', 'create("any")', 'update("any")', 'delete("any")'];

export function pmSchemaWant(): PmCollWant[] {
  return PM_COLLS.map((c) => ({
    id: c.name,
    name: `프로젝트 관리 ${c.name}`,
    attributes: [
      { key: 'id', type: 'string', size: 128, required: true },
      { key: 'kind', type: 'string', size: 32, required: false },
      { key: 'at', type: 'integer', required: true },
      { key: 'seq', type: 'integer', required: true },
      { key: 'body', type: 'string', size: 1_000_000, required: true },
      ...c.idx.map((f): PmAttrWant => ({ key: f, type: 'string', size: 128, required: false })),
    ],
    indexes: c.idx.map((f): PmIndexWant => ({ key: `idx_${f}`, type: 'key', attributes: [f] })),
    permissions: PM_PERMISSIONS,
  }));
}

/** DB 에서 읽은 컬렉션 (Appwrite listCollections 의 칸 중 대조에 쓰는 것) */
export interface PmCollGot {
  $id: string;
  name: string;
  documentSecurity: boolean;
  $permissions: string[];
  attributes: Array<{ key: string; type: string; status: string; required: boolean; size?: number; array?: boolean }>;
  indexes: Array<{ key: string; type: string; status: string; attributes: string[] }>;
}

export interface PmResumePlan {
  /** 이미 있는 PM 컬렉션 */
  existing: string[];
  /** '인덱스 빠짐' 말고 다른 차이 — 하나라도 있으면 아무것도 안 씀 */
  diffs: string[];
  /** 아직 처리 중(processing)인 속성 · 인덱스 — 차이가 아니라 기다릴 것 (F4). failed · stuck 등은 diffs */
  waiting: string[];
  /** 새로 만들 컬렉션 (공용 스크립트 --only=… --new-only) */
  createColls: string[];
  /** 있는 컬렉션에 빠진 인덱스 (감싸개가 createIndex) */
  createIndexes: Array<{ coll: string } & PmIndexWant>;
  /** 쓰기 수 — 속성 (새 컬렉션 것) · 인덱스 (새 컬렉션 것 + 빠진 것) */
  attrs: number;
  indexCount: number;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

export function resumePlan(want: readonly PmCollWant[], got: readonly PmCollGot[]): PmResumePlan {
  const diffs: string[] = [];
  const waiting: string[] = [];
  const createIndexes: PmResumePlan['createIndexes'] = [];
  const byId = new Map(got.map((g) => [g.$id, g]));
  const existing = want.filter((w) => byId.has(w.id)).map((w) => w.id);
  const createColls = want.filter((w) => !byId.has(w.id)).map((w) => w.id);
  for (const id of existing) {
    const w = want.find((x) => x.id === id)!;
    const g = byId.get(id)!;
    const d = (m: string) => diffs.push(`${id}: ${m}`);
    if (g.name !== w.name) d(`이름 "${g.name}" ≠ "${w.name}"`);
    if (g.documentSecurity) d('documentSecurity 가 켜져 있음');
    if (!same(g.$permissions, w.permissions)) d(`권한 [${g.$permissions.join(', ')}] ≠ [${w.permissions.join(', ')}]`);
    for (const a of w.attributes) {
      const x = g.attributes.find((y) => y.key === a.key);
      if (!x) { d(`속성 ${a.key} 빠짐`); continue; }
      if (x.type !== a.type) d(`속성 ${a.key} 종류 ${x.type} ≠ ${a.type}`);
      if (a.size != null && x.size !== a.size) d(`속성 ${a.key} 크기 ${x.size} ≠ ${a.size}`);
      if (!!x.required !== a.required) d(`속성 ${a.key} 필수 ${x.required} ≠ ${a.required}`);
      if (x.array) d(`속성 ${a.key} 가 배열`);
      if (x.status === 'processing') waiting.push(`${id}: 속성 ${a.key}`);
      else if (x.status !== 'available') d(`속성 ${a.key} 상태 ${x.status}`);
    }
    for (const x of g.attributes) if (!w.attributes.some((a) => a.key === x.key)) d(`정의에 없는 속성 ${x.key}`);
    for (const i of w.indexes) {
      const x = g.indexes.find((y) => y.key === i.key);
      if (!x) { createIndexes.push({ coll: id, ...i }); continue; }
      if (x.type !== i.type) d(`인덱스 ${i.key} 종류 ${x.type} ≠ ${i.type}`);
      if (!same(x.attributes, i.attributes) || x.attributes.join() !== i.attributes.join()) d(`인덱스 ${i.key} 칸 [${x.attributes.join(', ')}] ≠ [${i.attributes.join(', ')}]`);
      if (x.status === 'processing') waiting.push(`${id}: 인덱스 ${i.key}`);
      else if (x.status !== 'available') d(`인덱스 ${i.key} 상태 ${x.status}`);
    }
    for (const x of g.indexes) if (!w.indexes.some((i) => i.key === x.key)) d(`정의에 없는 인덱스 ${x.key}`);
  }
  const fresh = want.filter((w) => createColls.includes(w.id));
  return {
    existing, diffs, waiting, createColls, createIndexes,
    attrs: fresh.reduce((a, w) => a + w.attributes.length, 0),
    indexCount: fresh.reduce((a, w) => a + w.indexes.length, 0) + createIndexes.length,
  };
}

/** 다 된 뒤 맞아야 할 숫자 (23 · 140 · 25) */
export function pmSchemaTotals(want: readonly PmCollWant[] = pmSchemaWant()) {
  return { colls: want.length, attrs: want.reduce((a, w) => a + w.attributes.length, 0), indexes: want.reduce((a, w) => a + w.indexes.length, 0) };
}
