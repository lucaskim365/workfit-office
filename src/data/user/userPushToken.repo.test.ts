import assert from 'node:assert/strict';
import test from 'node:test';
import { userRepo } from './user.repo';

const tokensOf = async (id: string) => {
  const u = (await userRepo.listIncludingTestAccounts()).find((x) => x.id === id)!;
  return { list: u.fcmTokens, legacy: u.fcmToken };
};

test('PC와 휴대폰 토큰을 모두 보관하고 단일 칸에는 최근 기기를 둔다', async () => {
  await userRepo.updateFcmToken('U001', 'pc-token');
  await userRepo.updateFcmToken('U001', 'phone-token');
  assert.deepEqual(await tokensOf('U001'), { list: ['phone-token', 'pc-token'], legacy: 'phone-token' });
});

test('같은 기기로 다른 계정에 로그인하면 이전 계정에서는 그 토큰이 빠진다', async () => {
  await userRepo.updateFcmToken('U003', 'shared-phone');
  await userRepo.updateFcmToken('U006', 'shared-phone');
  assert.deepEqual(await tokensOf('U003'), { list: [], legacy: '' });
  assert.deepEqual((await tokensOf('U006')).list, ['shared-phone']);
});

test('로그아웃한 기기 토큰만 목록에서 빠진다', async () => {
  await userRepo.removeFcmToken('U001', 'phone-token');
  assert.deepEqual(await tokensOf('U001'), { list: ['pc-token'], legacy: '' });
});
