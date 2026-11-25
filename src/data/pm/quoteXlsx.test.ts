import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedPlans, seedProjects } from './seed';
import { buildQuoteXlsx, quoteFileName, quoteSheetName } from './quoteXlsx';
import { xlsxDigest, type XlsxDigest } from './xlsxDigest';
import { shortName } from '@/domain/pm/rules';
import { defaultMoneyCfg, seedFundRules } from '@/domain/pm/money';
import { fundOf, qFundRows, qOv, quoteDraft, seedMoney, type FundCtx } from '@/domain/pm/quote';
import { fillMyungsung } from '@/domain/pm/quoteDemo';
import refs from './seed/quote-demo-ref.json';

/**
 * 견적서 엑셀 = 데모가 내보낸 엑셀 (11/25 데모 복사본에서 [엑셀로 내보내기] 로 받은 파일을 요약해 `seed/quote-demo-ref.json` 에 둠).
 * 칸마다 값 · 수식 · 줄 높이 · 칸 합치기 · 시트 이름 · 인쇄 범위가 같아야 함. 명성ENG 값은 원본 견적서와 같은 합계(368,981,000) · ①~⑧.
 */
const TODAY = '2026-11-25';
const tpl = new Uint8Array(readFileSync(fileURLToPath(new URL('./seed/quote-template.xlsx', import.meta.url))));
const projects = seedProjects();
const seed = seedMoney(projects);
const ctx: FundCtx = { projects, plans: seedPlans(), rules: seedFundRules(), cfg: defaultMoneyCfg(), contracts: seed.contracts, funds: seed.funds, today: TODAY };

async function build(projectId: string, cid: string, myung = false) {
  let E = quoteDraft(cid ? seed.contracts.find((c) => c.id === cid)! : null, projectId, seed.funds.find((f) => f.id === projectId), ctx.cfg, TODAY);
  if (myung) E = fillMyungsung(E, 'F2');
  const p = projects.find((x) => x.id === projectId)!;
  const fund = fundOf(ctx, projectId, qOv(ctx, E));
  const x = { q: E.q, kind: E.kind, short: shortName(p, projects), company: p.company, fund, fundRows: qFundRows(fund, ctx.cfg), today: TODAY };
  return { x, bytes: await buildQuoteXlsx(tpl, x) };
}
/** 다른 칸 목록 (숫자는 1e-9 까지 같으면 같음, 인쇄 범위는 $ 빼고) */
function diff(a: XlsxDigest, b: XlsxDigest): string[] {
  const out: string[] = [];
  if (JSON.stringify(a.sheets) !== JSON.stringify(b.sheets)) out.push(`sheets ${a.sheets} ≠ ${b.sheets}`);
  if (a.printArea.replace(/\$/g, '') !== b.printArea.replace(/\$/g, '')) out.push(`printArea ${a.printArea} ≠ ${b.printArea}`);
  for (const s of b.sheets) {
    const A = a.cells[s] ?? {};
    const B = b.cells[s] ?? {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[k];
      const y = B[k];
      // 데모(ExcelJS)가 표지 몇 칸에 계산값 NaN 을 남긴 곳(JSON null)은 수식만 비교 — 엑셀은 열 때 다시 계산
      const same = x && y && x[0] === y[0] && (y[1] === null && y[0] !== '' ? typeof x[1] === 'number' : typeof x[1] === 'number' && typeof y[1] === 'number' ? Math.abs(x[1] - y[1]) <= 1e-9 * Math.max(1, Math.abs(y[1])) : x[1] === y[1]);
      if (!same) out.push(`${s}!${k}: ${JSON.stringify(x)} ≠ 데모 ${JSON.stringify(y)}`);
    }
    if (JSON.stringify(a.merges[s]) !== JSON.stringify(b.merges[s])) out.push(`${s} merges`);
    for (const r of new Set([...Object.keys(a.heights[s] ?? {}), ...Object.keys(b.heights[s] ?? {})])) {
      if (Math.abs((a.heights[s]?.[r] ?? -1) - (b.heights[s]?.[r] ?? -1)) > 0.01) out.push(`${s} 줄 ${r} 높이 ${a.heights[s]?.[r]} ≠ 데모 ${b.heights[s]?.[r]}`);
    }
  }
  return out;
}
const REF = refs as unknown as Record<string, XlsxDigest>;

test('명성ENG 테스트 값(한일) — 데모 엑셀과 칸마다 같음 · 원본 합계 · 사업비 현황', async () => {
  const { x, bytes } = await build('P4', '', true);
  const d = await xlsxDigest(bytes);
  assert.deepEqual(diff(d, REF['P4-myungsung']), []);
  const S = d.cells['한일(견적)'];
  assert.deepEqual(S.M10, ['K40', 368981000]);
  assert.deepEqual(S.F54, ['F55+F57+F58', 399581000]);
  assert.deepEqual(S.F56, ['MIN(F54*0.5,200000000)', 199790500]);
  assert.deepEqual(S.F60, ['F54-F56-F57-F58-F59', 169190500]);
  assert.deepEqual(d.cells['표지'].C9, ['SUM(D9:K9)', 368981000]);
  assert.deepEqual(d.cells['표지'].C10, ['SUM(D10:K10)', 205661000]);
  assert.equal(quoteFileName(x), '한일시멘트_견적서_2026-11-06.xlsx');
  assert.equal(quoteSheetName('효광(AI)'), '효광(AI)(견적)');
});

test('처음 값 계약 — 신광 C1(품목 없음) · C2(자체, 사업비 현황 없음) · 효광(AI) C3 도 데모 엑셀과 같음', async () => {
  for (const [k, p, c] of [['P2-C1', 'P2', 'C1'], ['P2-C2', 'P2', 'C2'], ['P7-hyogwangAI', 'P7', 'C3']] as const) {
    const d = await xlsxDigest((await build(p, c)).bytes);
    assert.deepEqual(diff(d, REF[k]), [], k);
  }
});

test('틀 정리: 계산 순서 기록(calcChain) 없음 · 열 때 다시 계산 · 줄 나눔 없음', async () => {
  const { unzip } = await import('@/lib/sheet/zip');
  const f = await unzip((await build('P4', '', true)).bytes);
  const t = (p: string) => new TextDecoder().decode(f.get(p)!);
  assert.equal(f.has('xl/calcChain.xml'), false);
  assert.doesNotMatch(t('[Content_Types].xml'), /calcChain/);
  assert.doesNotMatch(t('xl/_rels/workbook.xml.rels'), /calcChain/);
  assert.match(t('xl/workbook.xml'), /fullCalcOnLoad="1"/);
  assert.doesNotMatch(t('xl/worksheets/sheet2.xml'), /rowBreaks/);
  assert.match(t('docProps/app.xml'), /한일\(견적\)/);
});
