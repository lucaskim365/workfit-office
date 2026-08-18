/**
 * 통합 브랜치 검증 — 이식한 6개 그룹웨어 모듈이 실제로 렌더되는지 확인한다.
 * 각 라우트로 이동해 GwComingSoon('준비 중') 랜딩이 아닌 실화면이 떴는지 판정하고,
 * 콘솔 에러를 모아 보고한다.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR ?? './.screenshots';
const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TARGETS = [
  { slug: 'calendar', label: '일정관리' },
  { slug: 'resource', label: '자원예약' },
  { slug: 'task', label: '업무관리' },
  { slug: 'survey', label: '전자설문' },
  { slug: 'mail', label: '메일' },
  { slug: 'commute', label: '근태' },
];

mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const results = [];

for (const t of TARGETS) {
  const before = errors.length;
  await page.goto(`${BASE}/gw/${t.slug}`, { waitUntil: 'networkidle', timeout: 30000 });
  // 라우트가 온디맨드 컴파일이라 첫 진입이 느릴 수 있다.
  await page.waitForTimeout(1200);

  const body = await page.evaluate(() => document.body.innerText);
  // GwComingSoon 랜딩 문구가 보이면 라우트가 캐치올로 떨어진 것이다.
  const comingSoon = /준비\s*중/.test(body) && body.length < 600;
  const empty = body.trim().length < 40;
  const ok = !comingSoon && !empty;

  await page.screenshot({ path: `${SHOT_DIR}/gw-${t.slug}.png`, fullPage: false });
  results.push({
    ...t,
    ok,
    comingSoon,
    empty,
    chars: body.trim().length,
    newErrors: errors.length - before,
    head: body.trim().slice(0, 90).replace(/\s+/g, ' '),
  });
}

console.log('\n=== 모듈 렌더 검증 ===');
for (const r of results) {
  const mark = r.ok ? 'OK  ' : 'FAIL';
  const why = r.comingSoon ? ' (준비중 랜딩으로 떨어짐)' : r.empty ? ' (빈 화면)' : '';
  console.log(`${mark} ${r.label.padEnd(6)} /gw/${r.slug.padEnd(9)} 본문 ${String(r.chars).padStart(5)}자  에러 ${r.newErrors}${why}`);
  console.log(`       └ ${r.head}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n렌더 성공 ${results.length - failed.length}/${results.length}`);

if (errors.length) {
  console.log(`\n=== 콘솔 에러 ${errors.length}건 (중복 제거) ===`);
  for (const e of [...new Set(errors)].slice(0, 15)) console.log(`  - ${e.slice(0, 200)}`);
} else {
  console.log('\n콘솔 에러 없음');
}

await browser.close();
process.exit(failed.length === 0 ? 0 : 1);
