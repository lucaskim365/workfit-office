/**
 * Appwrite 연결 검증 — 데모(memory)가 아니라 실제 Appwrite dev에서 읽는지 확인한다.
 * 로그인 게이트를 통과한 뒤 THEIRS 화면(사용자관리)과 우리 모듈 화면을 함께 확인해
 * "어디는 실데이터, 어디는 데모"인지 드러낸다.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOT_DIR = process.env.SHOT_DIR ?? './.screenshots';
const CHROME = process.env.CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGIN_ID = process.env.LOGIN_ID ?? 'seunggi.kim@workfit.co.kr';
const LOGIN_PW = process.env.LOGIN_PW ?? 'mes1234';

mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
const appwriteCalls = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
// Appwrite로 실제 네트워크 요청이 나가는지 관찰한다 — 이게 데모/실연결을 가르는 증거다.
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('appwrite')) appwriteCalls.push(u.replace(/^https?:\/\/[^/]+/, ''));
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOT_DIR}/aw-01-gate.png` });

const bodyText = await page.evaluate(() => document.body.innerText);
const hasLoginGate = /로그인|아이디|사번/.test(bodyText) && bodyText.length < 900;
console.log(`로그인 게이트 표시: ${hasLoginGate ? 'YES' : 'NO'}`);

if (hasLoginGate) {
  const inputs = await page.$$('input');
  console.log(`  입력란 ${inputs.length}개 발견`);
  if (inputs.length >= 2) {
    await inputs[0].fill(LOGIN_ID);
    await inputs[1].fill(LOGIN_PW);
    await page.screenshot({ path: `${SHOT_DIR}/aw-02-filled.png` });
    const btn = await page.$('button[type=submit]') ?? (await page.$$('button'))[0];
    if (btn) await btn.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOT_DIR}/aw-03-after-login.png` });
    const after = await page.evaluate(() => document.body.innerText);
    const stillGate = /로그인/.test(after) && after.length < 900;
    console.log(`  로그인 결과: ${stillGate ? '실패(게이트 유지)' : '성공(셸 진입)'}`);
    if (stillGate) console.log(`  화면 문구: ${after.trim().slice(0, 160).replace(/\s+/g, ' ')}`);
  }
}

// THEIRS 화면(사용자관리) — Appwrite users 16명이 보이면 실연결이다.
const before = appwriteCalls.length;
await page.goto(`${BASE}/gw/orgchart`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOT_DIR}/aw-04-orgchart.png` });
console.log(`\n조직도 진입 시 Appwrite 요청 ${appwriteCalls.length - before}건`);

// 우리 모듈 — 여기서 Appwrite 요청이 0이면 Firestore 직결(=데모)이라는 증거다.
for (const slug of ['calendar', 'resource', 'commute']) {
  const b = appwriteCalls.length;
  await page.goto(`${BASE}/gw/${slug}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOT_DIR}/aw-05-${slug}.png` });
  console.log(`/gw/${slug} 진입 시 Appwrite 요청 ${appwriteCalls.length - b}건`);
}

console.log(`\n=== Appwrite 요청 총 ${appwriteCalls.length}건 (경로 상위 12) ===`);
for (const u of [...new Set(appwriteCalls)].slice(0, 12)) console.log(`  ${u.slice(0, 130)}`);

if (errors.length) {
  console.log(`\n=== 콘솔 에러 ${errors.length}건 ===`);
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(`  - ${e.slice(0, 220)}`);
} else {
  console.log('\n콘솔 에러 없음');
}

await browser.close();
