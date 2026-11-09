import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 이 모듈은 다른 프로젝트로 폴더째 옮겨 쓸 수 있어야 한다 — 폴더 안 상대 경로와 react만 불러온다
const DIR = dirname(fileURLToPath(import.meta.url));
const ALLOWED = (spec: string) => spec.startsWith('./') || spec === 'react' || spec.startsWith('react/');

test('모듈 밖 코드를 불러오지 않는다', () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      if (!ALLOWED(m[1])) bad.push(`${f} → ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});
