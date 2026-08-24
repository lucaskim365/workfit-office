import assert from 'node:assert/strict';
import test from 'node:test';
import { mailRefKey, parseMailRefKey } from './engine';
import type { MailRef } from './schema';

const ref = (folder: MailRef['folder']): MailRef => ({
  accountId: 'acc1',
  folder,
  uidValidity: 'v1',
  uid: 'u1',
});

test('parseMailRefKey round-trips every mail folder', () => {
  for (const folder of ['INBOX', 'SENT', 'DRAFTS', 'TRASH'] as const) {
    const row = ref(folder);
    assert.deepEqual(parseMailRefKey(mailRefKey(row)), row);
  }
});

test('parseMailRefKey rejects an unknown folder', () => {
  assert.equal(parseMailRefKey('acc1:BOGUS:v1:u1'), null);
});

test('parseMailRefKey rejects a malformed key', () => {
  assert.equal(parseMailRefKey('acc1:SENT:v1'), null);
});
