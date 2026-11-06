import assert from 'node:assert/strict';
import test from 'node:test';

/** 브라우저 Cache Storage 흉내 — 이름별 Map */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    open: async (name: string) => {
      const m = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, m);
      return {
        match: async (key: string | Request) => m.get(typeof key === 'string' ? key : key.url)?.clone(),
        put: async (key: string, res: Response) => void m.set(key, res),
        delete: async (key: string | Request) => m.delete(typeof key === 'string' ? key : key.url),
        keys: async () => [...m.keys()].map((url) => ({ url }) as Request),
      };
    },
  };
}

test('채팅 첨부 보관함 — 처음엔 받아서 보관, 다음엔 보관함에서(다시 안 받음), 실패는 상태로', async () => {
  (globalThis as any).caches = fakeCaches();
  let fetched = 0;
  (globalThis as any).fetch = async (url: string) => {
    fetched++;
    if (url.endsWith('/bad')) return new Response('', { status: 500 });
    return new Response(new Blob(['%PDF-1.4 hello']), { headers: { 'content-type': 'application/pdf' } });
  };
  const store = await import('./chatFileStore');
  assert.equal(await store.getChatFile('https://files/a.pdf'), null);
  const blob = await store.loadChatFile('https://files/a.pdf', 'application/pdf');
  assert.equal(await blob.text(), '%PDF-1.4 hello');
  const again = await store.getChatFile('https://files/a.pdf');
  assert.equal(await again!.text(), '%PDF-1.4 hello');
  assert.equal(fetched, 1, '두 번째는 보관함에서');
  await assert.rejects(store.loadChatFile('https://files/bad', 'application/pdf'));
  assert.equal(await store.getChatFile('https://files/bad'), null);
});

test('공유 창으로 넘길 수 있는 파일 — PDF·사진·글자는 되고, 한글·엑셀·워드는 다운로드로', async () => {
  const { canShareFileType } = await import('./chatFileStore');
  for (const n of ['보고서.pdf', '사진.JPG', '메모.txt', '목록.csv']) assert.equal(canShareFileType(n), true, n);
  for (const n of ['계획서.hwp', '정산.xlsx', '견적.docx', '자료.zip', '이름없음']) assert.equal(canShareFileType(n), false, n);
});
