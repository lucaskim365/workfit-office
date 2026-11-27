/**
 * 프로젝트 관리(PM) 옮기기 (설계 4장 · 5.7.8 · 5.7.6 7-5).
 *
 * 실행:
 *   npm run pm:import -- --dry-run --state=C:/dev/pm-migration/state-20261124.json   (미리보기 — DB 쓰기 없음)
 *   npm run pm:import -- --write   --state=…                                           (7-5 — 팀장 "실행해도 됨" 뒤에만)
 *     [--demo=<데모 HTML>]      계획서 PDF 지정(PLAN_LINK)을 읽음. 기본 = 바탕화면 프관 데모
 *     [--plans=<사업계획서 폴더>] 기본 = 데모 옆 `사업계획서/`
 *     [--users=<json>]          그룹웨어 사용자 목록 파일. 없으면 개발 DB `users` 를 **읽기만**
 *     [--out=<md 경로>]          보고서. 기본 = state 파일 옆 `dryrun-YYYYMMDD.md` (실제 이름이 있어 저장소 밖)
 *   npm run pm:import -- --verify --state=… [--day=YYYY-MM-DD]                         (대조 — 읽기만. 넣을 줄 vs DB 문서 내용, 다름 0 이면 통과)
 *     --day = 넣은 날 (넣는 날에 따라 달라지는 줄 pmSubtasks · pmBaselines 때문). 기본 = 오늘
 *
 * 넣는 것 = 메모리판 처음 값(내장 데이터 · deriveMaster · 처음 금액) + 사업 PM → 사용자 ID. state.json 에서 옮기는 사람 기록 0 (5.7.8).
 * 개발: 같은 문서 id 가 이미 있으면 건너뜀 → 다시 돌려도 안전.
 *
 * 운영 (8단계 · 사용자 허락 뒤, 설계 5.7.20): 끝에 `--prod-project=<운영 프로젝트 ID 를 손으로>`.
 *   사람 = 운영 `users` 를 읽기만 (`--users=` 거절). 쓰기 = `--write --confirm=<새로 넣을 수>`.
 *   쓰기 전에 DB 를 끝까지 읽어 '넣을 줄에 없는 문서'가 1건이라도 있거나, 이미 있는 문서가 넣을 줄과 내용이 다르면 거절
 *   (= 누가 쓰기 시작한 뒤 다시 돌리는 실수 방지). 쓰는 도중 409(누가 같이 씀) = 멈춤.
 *
 * 지키는 것 (`pm-env.ts`): 기본 = 개발 DB 접속 값만 · 운영 프로젝트 ID · `--prod` 거절 ·
 * 쓰는 컬렉션은 PM_COLLS 23개와 글자 그대로 같을 때만 (`assertPmColl`). 쓰기 호출은 createDocument 하나뿐 (고치기 · 덮어쓰기 · 지우기 없음 — 테스트가 확인).
 * 그룹웨어 데이터는 `users` 를 **읽기만** — 아래 `readUsers` 가 부르는 것은 `listDocuments` 하나.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Client, Databases, Query } from 'node-appwrite';
import { todayStr } from '../src/domain/pm/rules';
import { buildImportPreview, buildImportRows, type DemoState, type GwUserLite, type ImportPreview } from '../src/data/pm/importPlan';
import { docKeyOf, PM_COLLS, type PmRow } from '../src/data/pm/pmDb';
import { safeDocId } from '../src/shared/lib/appwrite';
import { assertPmColl, compareRows, fail, pmDb, requireConfirm, stampNow, type DevDb, type RowDiff } from './pm-env';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => process.argv.includes(`--${name}`);
const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;

/** 그룹웨어 users — 읽기만 (listDocuments 하나) */
async function readUsers(dbs: Databases, db: DevDb): Promise<GwUserLite[]> {
  const users: GwUserLite[] = [];
  let cursor: string | undefined;
  for (;;) {
    const q = [Query.limit(100), Query.select(['$id', 'name', 'dept', 'position', 'status', 'resignedAt'])];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await dbs.listDocuments(db.database, 'users', q);
    for (const d of res.documents) {
      const r = d as unknown as Record<string, unknown>;
      users.push({ id: d.$id, name: String(r.name ?? ''), dept: String(r.dept ?? ''), position: String(r.position ?? ''), status: String(r.status ?? ''), resignedAt: String(r.resignedAt ?? '') });
    }
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return users;
}

/** PM 컬렉션에 이미 있는 문서 전부 — $id → 문서 (읽기만, 내용 대조용). 컬렉션이 없으면 null */
async function existingDocs(dbs: Databases, db: DevDb, coll: string): Promise<Map<string, Record<string, unknown>> | null> {
  assertPmColl(coll);
  const out = new Map<string, Record<string, unknown>>();
  let cursor: string | undefined;
  try {
    for (;;) {
      const q = [Query.limit(100)];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const res = await dbs.listDocuments(db.database, coll, q);
      for (const d of res.documents) out.set(d.$id, d as unknown as Record<string, unknown>);
      if (res.documents.length < 100) break;
      cursor = res.documents[res.documents.length - 1].$id;
    }
  } catch (e) {
    if (isCode(e, 404)) return null;
    throw e;
  }
  return out;
}

/** 데모 HTML 의 `const PLAN_LINK = …({ P2:'…pdf', … })` */
function readPlanLinks(html: string): Record<string, string> {
  const start = html.indexOf('const PLAN_LINK');
  if (start < 0) return {};
  const block = html.slice(start, html.indexOf('}).map', start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(P\d+)\s*:\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

const esc = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: unknown[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');

/** 사람 짝짓기 한 줄 (검수 P7) — 내부 직원 결과별 수 */
function matchSummary(p: ImportPreview): string {
  const inside = p.people.filter((x) => x.kind === '내부');
  const by = (m: string) => inside.filter((x) => x.match === m).length;
  return `내부 ${inside.length}명 = 찾음 ${by('찾음')} · 동명이인 ${by('동명이인')} · 퇴사·미사용 ${by('퇴사·미사용')} · 없음 ${by('없음')}`;
}

function toMarkdown(p: ImportPreview, meta: Record<string, string>, skip: Map<string, number | null>, x: { prod: boolean; pms: string[][] }): string {
  const inside = p.people.filter((x) => x.kind === '내부');
  const outside = p.people.filter((x) => x.kind !== '내부');
  return [
    `# PM 옮기기 미리보기 (dry-run) — ${meta.today}`,
    '',
    ...(x.prod ? ['> **운영 users 로 다시 짝지음 — 개발 DB 때 숫자와 다를 수 있음.**', ''] : []),
    '> DB에 쓰지 않음. 실제 이름이 있어 저장소 밖에 둔다.',
    '',
    `사람 짝짓기: ${matchSummary(p)} · 사업 PM 안 이어짐 ${x.pms.filter((r) => r[2] === '안 이어짐').length} / ${x.pms.length}`,
    '',
    table(['원본·기준', '값'], Object.entries(meta)),
    '',
    `## 1. 들어갈 건수 (합 ${p.counts.reduce((a, c) => a + c.count, 0)})`,
    table(['컬렉션', '건수', '이미 있어 건너뜀', '원본', '비고'], p.counts.map((c) => { const s = skip.get(c.collection); return [c.collection, c.count, s == null ? '컬렉션 없음' : s, c.source, c.note]; })),
    '',
    `## 2. 안 옮기는 state.json 기록 중 옛 WBS 번호에 묶인 것 (${p.broken.length}건) — 기록만`,
    table(['종류', 'ID', '예전 번호', '제목', '상태', '참고 후보', '닮은 정도'], p.broken.map((b) => [b.kind, b.id, b.oldKey, b.title, b.status, b.candidate || '-', b.candidate ? b.candidateScore : '-'])),
    '',
    `## 3. 사람 — 내부 직원 ${inside.length}명 (그룹웨어 사용자와 짝짓기)`,
    table(['이름', '데모 직급', '데모 소속', '결과', '그룹웨어 소속', '기록에 쓰인 횟수'], inside.map((x) => [x.name, x.title, x.org, x.match, x.gwDept || '-', x.refs])),
    '',
    `### 외부 ${outside.length}명 — 사용자로 넣지 않고 이름 글자로 (§4.4)`,
    table(['이름', '직급', '구분', '소속', '기록에 쓰인 횟수'], outside.map((x) => [x.name, x.title, x.kind, x.org, x.refs])),
    '',
    p.unknownNames.length ? `기록에 나오지만 데모 사용자 목록에 없는 이름: ${p.unknownNames.join(', ')}` : '기록에 나오는 이름은 모두 데모 사용자 목록에 있음.',
    '',
    `### 사업 PM → 그룹웨어 사용자 (11/25 D2) — 안 이어짐 ${x.pms.filter((r) => r[2] === '안 이어짐').length}건`,
    table(['사업', 'PM 이름', '결과'], x.pms),
    '',
    '## 4. 사업 — 메모리판(넣을 값) vs state.json',
    table(['사업', '도입기업', 'state 에 있음', '다른 칸', 'state 에만 있는 칸'], p.projects.map((r) => [r.k, r.company, r.inState ? '예' : '아니오', r.diffs.join(' · ') || '-', r.stateOnly.join(' · ') || '-'])),
    '',
    `## 5. state.json 에만 있는 사람이 넣은 기준정보 (${p.hand.length}건 — 안 옮김)`,
    p.hand.length ? table(['종류', 'ID', '이름'], p.hand.map((h) => [h.kind, h.id, h.name])) : '- 없음 (모두 자동)',
    '',
    '## 6. 계획서 PDF 대조 (폴더 기준)',
    table(['사업', '도입기업', '파일', '폴더에 있음'], p.pdf.map((r) => [r.k, r.company, r.file || '(지정 없음)', r.found ? '예' : '아니오'])),
    '',
    '## 7. state.json 칸 — 전부 닫기 (5.7.8)',
    table(['칸', '건수', '이유', '결과'], p.left.map((r) => [r.key, r.count, r.reason, r.when])),
    '',
    '## 8. 칸 확인 (넣을 줄을 저장 계층으로 다시 읽어 봄)',
    p.schemaErrors.length ? p.schemaErrors.map((e) => `- ${e}`).join('\n') : '- 오류 없음',
    '',
    '## 9. 문제점',
    p.problems.length ? p.problems.map((e) => `- ${e}`).join('\n') : '- 없음',
    '',
  ].join('\n');
}

async function main() {
  const write = flag('write');
  const verify = flag('verify');
  if ([write, flag('dry-run'), verify].filter(Boolean).length !== 1) fail('--dry-run (미리보기) · --write (허락 뒤) · --verify (대조, 읽기만) 중 하나만 주세요');
  const mode = write ? '쓰기' : verify ? '대조' : '미리보기';
  const db = pmDb(`PM 옮기기 ${write ? '쓰기' : verify ? '대조 (읽기만)' : '미리보기 (읽기만)'}`, { prodOk: true, mode });
  console.log(`  시작 ${stampNow()}`);
  const statePath = arg('state');
  if (!statePath) fail('--state=<state.json 경로> 가 필요합니다');
  const demo = arg('demo') ?? join(process.env.USERPROFILE ?? '', 'Desktop', '프관', 'FactoryFlow_PM_데모.html');
  const plans = arg('plans') ?? join(dirname(demo), '사업계획서');
  const day = arg('day');
  if (day !== undefined && (!verify || !/^\d{4}-\d{2}-\d{2}$/.test(day))) fail('--day=YYYY-MM-DD 는 --verify 에서만 (넣은 날)');
  const today = day ?? todayStr();
  const out = arg('out') ?? join(dirname(statePath), `dryrun-${today.replace(/-/g, '')}.md`);
  if (resolve(out).startsWith(resolve(process.cwd()))) fail('보고서는 저장소 밖에 둡니다 (실제 이름 포함)');

  const dbs = new Databases(new Client().setEndpoint(db.endpoint).setProject(db.project).setKey(db.key));
  const raw = JSON.parse(readFileSync(statePath, 'utf8')) as { ver?: number; savedAt?: string; state: DemoState };
  const usersFile = arg('users');
  if (usersFile && db.prod) fail('운영에서는 --users=<파일> 을 받지 않습니다 — 운영 users 를 읽기만 해서 짝지음');
  const users = usersFile ? (JSON.parse(readFileSync(usersFile, 'utf8')) as GwUserLite[]) : await readUsers(dbs, db);
  const from = usersFile ?? `${db.prod ? '운영' : '개발'} DB ${db.project} users (읽기만)`;
  const links = existsSync(demo) ? readPlanLinks(readFileSync(demo, 'utf8')) : {};
  const files = existsSync(plans) ? readdirSync(plans) : [];

  const preview = buildImportPreview(raw.state, users, { links, files }, today);
  const { rows, snap } = buildImportRows(raw.state, users, today);
  if (preview.schemaErrors.some((e) => e.startsWith('pm'))) fail(`넣을 줄 중 저장 계층이 못 읽는 것이 있습니다: ${preview.schemaErrors.filter((e) => e.startsWith('pm')).join(' / ')}`);

  // 사람 짝짓기 (검수 P7) — 사람 이름은 보고서에만, 화면 출력은 수만
  const pms = snap.projects.filter((p) => p.pmName).map((p) => [p.id, p.pmName, p.pmUserId ? '이어짐' : '안 이어짐']);
  console.log(`  사람 짝짓기 (${from} — ${users.length}명): ${matchSummary(preview)} · 사업 PM 안 이어짐 ${pms.filter((r) => r[2] === '안 이어짐').length} / ${pms.length}`);
  if (db.prod) console.log('  ※ 운영 users 로 다시 짝지음 — 개발 DB 때 숫자와 다를 수 있음 (사람 이름 표는 보고서)');

  // 이미 있는 문서 (읽기만) — 넣을 줄과 내용 대조
  const have = new Map<string, Map<string, Record<string, unknown>> | null>();
  for (const def of PM_COLLS) have.set(def.name, await existingDocs(dbs, db, def.name));
  const wantOf = (name: string) => new Map((rows.get(name) ?? []).map((r) => [safeDocId(docKeyOf(r)), r as unknown as Record<string, unknown>]));
  const diff = new Map<string, RowDiff | null>(PM_COLLS.map((d) => { const h = have.get(d.name); return [d.name, h == null ? null : compareRows(wantOf(d.name), h)] as const; }));
  const toWrite = (name: string): PmRow[] => { const h = have.get(name); return (rows.get(name) ?? []).filter((r) => !h?.has(safeDocId(docKeyOf(r)))); };
  const skip = new Map(PM_COLLS.map((d) => { const h = have.get(d.name); return [d.name, h == null ? null : (rows.get(d.name)?.length ?? 0) - toWrite(d.name).length] as const; }));

  console.log('  컬렉션            넣을  건너뜀  (이미 있는 것 중 내용 다름 · 넣을 줄에 없는 문서)');
  for (const c of preview.counts) {
    const s = skip.get(c.collection);
    const d = diff.get(c.collection);
    console.log(`  ${c.collection.padEnd(17)} ${String(c.count).padStart(4)}  ${s == null ? '컬렉션 없음' : String(s).padStart(4)}  ${d ? `(다름 ${d.changed.length} · 줄에 없음 ${d.extra.length})` : ''}  ${c.note}`);
  }
  const sum = (f: (d: RowDiff) => number) => [...diff.values()].reduce((a, d) => a + (d ? f(d) : 0), 0);
  const newCount = PM_COLLS.reduce((a, d) => a + toWrite(d.name).length, 0);
  console.log(`  합 ${preview.counts.reduce((a, c) => a + c.count, 0)} · 새로 넣을 ${newCount} · 이미 같음 ${sum((d) => d.same)} · 내용 다름 ${sum((d) => d.changed.length)} · 넣을 줄에 없는 문서 ${sum((d) => d.extra.length)} · 칸 오류 ${preview.schemaErrors.length} · 문제점 ${preview.problems.length} · 사람이 넣은 기준정보(안 옮김) ${preview.hand.length}`);

  if (verify) {
    // 대조 (Q2 · R11) — 읽기만. 넣을 줄 전부가 DB 에 같은 내용으로 있고 DB 에 다른 문서가 없으면 통과
    let bad = 0;
    for (const def of PM_COLLS) {
      const d = diff.get(def.name);
      if (!d) { bad++; console.log(`  ✗ ${def.name} 컬렉션 없음`); continue; }
      const n = d.missing.length + d.changed.length + d.extra.length;
      bad += n;
      if (n) console.log(`  ✗ ${def.name} 없음 ${d.missing.length} · 다름 ${d.changed.length} · 줄에 없음 ${d.extra.length}  ${[...d.missing.slice(0, 3), ...d.changed.slice(0, 3), ...d.extra.slice(0, 3)].join(' ')}`);
    }
    console.log(bad ? `  ✗ 대조 다름 ${bad} (넣은 날 ${today})` : `  ✓ 대조 다름 0 — 넣을 줄 ${preview.counts.reduce((a, c) => a + c.count, 0)}건이 DB 와 같음 (넣은 날 ${today})`);
    if (bad) process.exitCode = 1;
    console.log(`  끝 ${stampNow()} — DB 쓰기 없음`);
    return;
  }

  if (db.prod) console.log(`  운영 쓰기 수 = 새로 넣을 ${newCount} — 실행하려면 --write --confirm=${newCount}`);
  if (!write) {
    const md = toMarkdown(preview, {
      today,
      'DB': `${db.prod ? '운영 ' : ''}${db.endpoint} / ${db.project} / ${db.database}`,
      'state.json': `${statePath} (ver ${raw.ver ?? '?'}, 저장 ${raw.savedAt ?? '?'})`,
      '그룹웨어 사용자': `${from} — ${users.length}명`,
      '계획서 폴더': `${plans} (${files.length}개 파일, PLAN_LINK ${Object.keys(links).length}개)`,
    }, skip, { prod: db.prod, pms });
    writeFileSync(out, md, 'utf8');
    console.log(`  보고서: ${out}`);
    console.log(`  끝 ${stampNow()} — DB 쓰기 없음`);
    return;
  }

  // ── 쓰기 (7-5 · 운영 8단계) ── PM 23개 안에서만, 없는 문서만 새로 만듦
  const missing = PM_COLLS.filter((d) => have.get(d.name) == null).map((d) => d.name);
  if (missing.length) fail(`컬렉션이 없습니다 (스키마 먼저): ${missing.join(', ')}`);
  if (db.prod) {
    // 검수 P4: 이미 누가 쓰기 시작한 DB 에 다시 돌리는 실수 방지 — 줄에 없는 문서 · 내용 다른 문서가 하나라도 있으면 거절
    if (sum((d) => d.extra.length)) fail(`운영 PM 컬렉션에 넣을 줄에 없는 문서 ${sum((d) => d.extra.length)}건 — 이미 누가 쓰기 시작한 것으로 보고 쓰지 않고 멈춤`);
    if (sum((d) => d.changed.length)) fail(`이미 있는 문서 중 넣을 줄과 내용이 다른 것 ${sum((d) => d.changed.length)}건 — 쓰지 않고 멈춤`);
    requireConfirm(newCount, '새로 넣을 수');
  }
  let made = 0;
  for (const def of PM_COLLS) {
    assertPmColl(def.name);
    const list = toWrite(def.name);
    for (let i = 0; i < list.length; i += 5) {
      await Promise.all(list.slice(i, i + 5).map(async (r) => {
        try { await dbs.createDocument(db.database, def.name, safeDocId(docKeyOf(r)), { ...r }); made++; } catch (e) {
          if (!isCode(e, 409)) throw e;
          if (db.prod) fail(`${def.name} ${safeDocId(docKeyOf(r))} 409 — 읽은 뒤 누가 같이 씀, 멈춤 (만든 문서 ${made})`);
        }
      }));
    }
    if (list.length) console.log(`  ✓ ${def.name} ${list.length}`);
  }
  // 넣은 뒤 다시 셈 (읽기만) = 미리보기 건수
  const bad: string[] = [];
  for (const def of PM_COLLS) {
    const n = (await existingDocs(dbs, db, def.name))?.size ?? 0;
    const want = rows.get(def.name)?.length ?? 0;
    if (n !== want) bad.push(`${def.name} DB ${n} ≠ 넣을 ${want}`);
  }
  console.log(`  새로 만든 문서 ${made} · DB 건수 대조 ${bad.length ? `다름: ${bad.join(' / ')}` : '모두 같음'} — 내용 대조는 --verify`);
  console.log(`  끝 ${stampNow()}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
