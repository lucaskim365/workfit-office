/**
 * 업무계획 외근·출장 창 확인 — 로그인 → 업무계획 → 첫 '일정 추가' → 출장 → 캡처(PC), 모바일 폭도 캡처.
 * 저장은 누르지 않는다(데이터 생성 없음).
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { LOGIN_ID, LOGIN_PW } from './login.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = process.env.SHOT_DIR ?? './.screenshots';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const errors = [];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
  await page.fill('input[autocomplete="username"]', LOGIN_ID);
  await page.fill('input[autocomplete="current-password"]', LOGIN_PW);
  await page.click('button:has-text("로그인")');
  await page.waitForSelector('input[autocomplete="current-password"]', { state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (name === 'pc') {
    await page.goto(`${BASE}/gw/work-plan`, { waitUntil: 'domcontentloaded' });
    const adds = page.locator('button[aria-label$="일정 추가"]');
    await adds.first().waitFor({ state: 'attached', timeout: 30000 });
    // 본인 칸(출장 고르기 가능)을 찾을 때까지 사람별로 연다
    const labels = await adds.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    const firstPerName = new Map();
    labels.forEach((label, i) => {
      const name = label.split(' ')[0];
      if (!firstPerName.has(name)) firstPerName.set(name, i);
    });
    for (const i of firstPerName.values()) {
      await adds.nth(i).evaluate((el) => el.click());
      await page.waitForSelector('[role="radio"]:has-text("출장")', { timeout: 20000 });
      if (await page.locator('[role="radio"]:has-text("출장")').isEnabled()) break;
      await page.screenshot({ path: `${OUT}/trip-try-${i}.png` });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  } else {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/trip-mobile-home.png` });
    return ctx.close();
  }
  await page.waitForSelector('[role="radio"]:has-text("출장")', { timeout: 20000 });
  await page.click('[role="radio"]:has-text("출장")');
  await page.fill('input[aria-label="제목"]', 'OO사 납품 협의');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/trip-pc-1.png` });
  await page.click('[role="radio"]:has-text("KTX·기차")');
  await page.fill('input[aria-label="출장지"]', '부산 본사');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/trip-pc-2.png` });
  await ctx.close();
}

try {
  await run('pc', { width: 1440, height: 900 });
} catch (e) {
  errors.push(String(e).slice(0, 200));
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
