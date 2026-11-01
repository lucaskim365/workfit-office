import assert from 'node:assert/strict';
import test from 'node:test';
import { smallPhotoOf, userSchema } from './schema';

const base = { id: 'U001', empNo: '1', name: '홍길동', email: 'a@example.com', dept: '개발', position: '사원', status: '사용' };

test('작은 사진 칸이 null 인 예전 사용자도 읽힌다 — 실패하면 그 계정은 로그인도 안 된다', () => {
  const r = userSchema.safeParse({ ...base, photoThumbUrl: null });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.photoThumbUrl, '');
});

test('작은 사진이 없으면 원본을 쓴다', () => {
  assert.equal(smallPhotoOf({ photoUrl: 'big.jpg', photoThumbUrl: 'small.jpg' }), 'small.jpg');
  assert.equal(smallPhotoOf({ photoUrl: 'big.jpg', photoThumbUrl: null }), 'big.jpg');
  assert.equal(smallPhotoOf({ photoUrl: '', photoThumbUrl: '' }), '');
  assert.equal(smallPhotoOf(null), '');
});
