/** /dev/file-lab E2E — 로그인 → 파일랩 → 업로드 → 검증. */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = './.screenshots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[filelab]', ...a);

// 업로드용 임시 파일 — 한글 파일명(macOS NFD 경로 검증)
const txtPath = '/tmp/2026년 사업계획서(한글명).txt';
writeFileSync(txtPath, 'WorkFit NAS 게이트웨이 E2E 검증 파일 ✅\n' + 'x'.repeat(2000));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }).then((c) => c.newPage());
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  // 인증 게이트 비활성(VITE_AUTH_ENABLED=false) 전제 — 바로 파일랩 진입.
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.goto(`${BASE}/dev/file-lab`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=파일 저장소 테스트', { timeout: 20000 });
  await page.waitForTimeout(800);
  log('driver badge:', await page.locator('text=/driver:/').first().innerText().catch(() => 'n/a'));

  // 같은 파일을 2번 업로드 → 중복 (1) 구분 확인
  await page.setInputFiles('input[type=file]', txtPath);
  await page.waitForFunction(() => document.querySelectorAll('li a[download]').length >= 1, null, { timeout: 20000 });
  await page.setInputFiles('input[type=file]', txtPath);
  await page.waitForFunction(() => document.querySelectorAll('li a[download]').length >= 2, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/filelab-01.png`, fullPage: true });

  const names = await page.locator('li .truncate, li .font-semibold').allInnerTexts();
  log('list items:', names.filter((t) => t.includes('.txt')).join(' | '));
  log('errors:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'none');
} catch (e) {
  log('ERROR', e.message);
  await page.screenshot({ path: `${OUT}/filelab-error.png`, fullPage: true }).catch(() => {});
  log('errors:', JSON.stringify(errors.slice(0, 6)));
  process.exitCode = 1;
} finally {
  await browser.close();
}
