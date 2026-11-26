import { createCrudBackend, DocumentExistsError, Query } from '@/data/_backend/crudBackend';
import { safeDocId } from '@/shared/lib/appwrite';
import { docKeyOf, PM_COLLS, PmDbMissingError, PmExistsError, PmRateLimitError, type PmCollApi, type PmDb, type PmRow } from './pmDb';

/**
 * PM DB — 그룹웨어 공용 저장(`createCrudBackend`)을 **가져다 쓰기만** 한다 (공용 파일 안 고침, 설계 5.7.7).
 * 공용 저장은 컬렉션이 없으면(404) 경고만 하고 처음 값을 돌려주므로, 처음 값 자리에 표시 1건을 넣어 두고
 * 그것이 돌아오면 '컬렉션 없음'으로 멈춘다 (5.7.4 — 저장된 것처럼 보이다 사라지는 일 막기).
 */
const MISSING = Object.freeze({ id: '__pm_missing__', kind: '', at: 0, seq: 0, body: '' }) as PmRow;

const parseRow = (raw: unknown): PmRow | null => {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r.body !== 'string' || typeof r.id !== 'string') return null;
  const row: PmRow = { id: r.id, kind: typeof r.kind === 'string' ? r.kind : '', at: Number(r.at) || 0, seq: Number(r.seq) || 0, body: r.body };
  for (const f of ['projectId', 'taskId', 'who', 'date', 'assigneeId', 'meetingId'] as const) if (typeof r[f] === 'string') row[f] = r[f] as string;
  return row;
};

function wrap(e: unknown, name: string, key: string): never {
  if (e instanceof DocumentExistsError) throw new PmExistsError(name, key);
  const code = (e as { code?: number })?.code;
  if (code === 429) throw new PmRateLimitError();
  throw e;
}

export function createAppwritePmDb(): PmDb {
  const colls = new Map<string, PmCollApi>();
  for (const def of PM_COLLS) {
    const be = createCrudBackend<PmRow>({ coll: def.name, parse: parseRow, idOf: docKeyOf, seed: [MISSING] });
    const has = (rows: PmRow[]) => rows.includes(MISSING) || rows.some((r) => r.id === MISSING.id);
    colls.set(def.name, {
      async list() {
        const rows = await be.loadWithQueries([]);
        if (has(rows)) throw new PmDbMissingError([def.name]);
        return rows;
      },
      async get(keys) {
        const out: PmRow[] = [];
        for (let i = 0; i < keys.length; i += 100) {
          const rows = await be.loadWithQueries([Query.equal('$id', keys.slice(i, i + 100).map(safeDocId))]);
          if (has(rows)) throw new PmDbMissingError([def.name]);
          out.push(...rows);
        }
        return out;
      },
      async insert(row) { try { await be.insert(row); } catch (e) { wrap(e, def.name, docKeyOf(row)); } },
      async save(row) { try { await be.save(row); } catch (e) { wrap(e, def.name, docKeyOf(row)); } },
      async remove(key) { try { await be.remove(key); } catch (e) { wrap(e, def.name, key); } },
    });
  }
  return {
    coll: (name) => colls.get(name)!,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}
