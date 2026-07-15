/**
 * WebDAV 게이트웨이 — 브라우저(앱)와 Synology WebDAV 사이의 신뢰 경계.
 *
 *   브라우저 ──(Layer1: 앱 JWT)──▶ 게이트웨이 ──(Layer2: svc 계정)──▶ Synology WebDAV
 *
 * 업로드: tus(이어올리기)로 수신 → 완료 시 서버측에서 WebDAV PUT.
 * 다운로드: JWT 검증 후 WebDAV GET 스트리밍 프록시(원본 파일명 보존).
 * (계획서: 파일서버_테스트페이지_개발_계획서.md §2·§3·§6)
 */
import 'dotenv/config';

// ⚠ 테스트 전용: Synology 기본 자체서명 인증서일 때 TLS 검증을 끈다. 운영에선 Let's Encrypt 로 교체 후 제거.
if (process.env.WEBDAV_INSECURE_TLS === '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.warn('[fileserver] ⚠ WEBDAV_INSECURE_TLS=1 — TLS 인증서 검증 비활성(테스트 전용).');
}

import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { issueToken, verifyFromRequest, requireAuth } from './auth.mjs';
import { meta, putFile, readStream, resolveDavPath } from './store.mjs';

const {
  PORT = 3001,
  CORS_ORIGIN = 'http://localhost:3000',
  TUS_DIR = './data/tus',
  MAX_BYTES = String(200 * 1024 * 1024),
} = process.env;

fs.mkdirSync(TUS_DIR, { recursive: true });

const app = express();

// tus-js-client 가 Location·Upload-Offset 을 읽을 수 있도록 노출 헤더 지정.
app.use(
  cors({
    origin: CORS_ORIGIN.split(',').map((s) => s.trim()),
    exposedHeaders: [
      'Location',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Resumable',
      'Tus-Version',
      'Tus-Extension',
      'Tus-Max-Size',
      'Upload-Metadata',
    ],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Location',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Resumable',
      'Upload-Metadata',
      'Upload-Concat',
      'Upload-Defer-Length',
      'X-Requested-With',
    ],
  }),
);

app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Layer 1 데모 토큰 발급(앱 백엔드 부재 대체) ──
app.post('/api/auth/token', express.json(), (req, res) => {
  const { userId, name } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  res.json({ token: issueToken({ userId, name }) });
});

// ── tus 업로드 서버(/api/upload) ──
const tus = new TusServer({
  path: '/api/upload',
  datastore: new FileStore({ directory: TUS_DIR }),
  maxSize: Number(MAX_BYTES),
  // Layer 1 인증: 토큰 없으면 업로드 거부.
  onIncomingRequest: async (req) => {
    const user = verifyFromRequest(req);
    if (!user) throw { status_code: 401, body: 'unauthorized' };
    req.user = user;
  },
  // 업로드 완료 → 서버측에서 Synology WebDAV 로 PUT + 메타 기록.
  onUploadFinish: async (req, res, upload) => {
    const md = upload.metadata ?? {};
    // macOS NFD 파일명을 NFC 로 정규화(다운로드 Content-Disposition·표시 일관성).
    const name = (md.filename || upload.id).normalize('NFC');
    const mime = md.filetype || 'application/octet-stream';
    const localPath = path.join(TUS_DIR, upload.id);
    // 채팅방별 하위폴더에 저장(roomId 있으면 file-storage/<roomId>/, 없으면 루트).
    const davPath = await resolveDavPath(name, md.roomId);
    // 실제 저장된 파일명(중복 시 (1) 포함) — 앱 표시·다운로드가 NAS 와 일치하도록.
    const storedName = davPath.split('/').pop();

    const buf = await fs.promises.readFile(localPath);
    await putFile(davPath, buf, mime);

    meta.add({
      id: upload.id, // tus id 를 파일 id 로 재사용(클라이언트가 upload.url 에서 추출)
      name: storedName, // 표시·다운로드용(중복 시 (1))
      originalName: name, // 사용자가 올린 원본명(감사/참고)
      size: upload.size ?? buf.length,
      mime,
      davPath,
      uploaderId: req.user?.sub || md.uploaderId || 'unknown',
      roomId: md.roomId || null,
      at: new Date().toISOString(),
    });

    await fs.promises.rm(localPath, { force: true });
    await fs.promises.rm(`${localPath}.json`, { force: true });
    return res;
  },
});
const tusHandler = (req, res) => tus.handle(req, res);
app.all('/api/upload', tusHandler);
app.all('/api/upload/*', tusHandler);

// ── 파일 목록(내 업로드/방 기준) ──
app.get('/api/files', requireAuth, (req, res) => {
  const rows = meta.list({ roomId: req.query.roomId });
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      size: r.size,
      mime: r.mime,
      at: r.at,
      uploaderId: r.uploaderId,
      roomId: r.roomId,
    })),
  );
});

// ── 단건 조회(업로드 직후 저장명 확인용) ──
app.get('/api/files/:id', requireAuth, (req, res) => {
  const r = meta.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json({ id: r.id, name: r.name, size: r.size, mime: r.mime, at: r.at, uploaderId: r.uploaderId, roomId: r.roomId });
});

// ── 다운로드/미리보기 — JWT(헤더 또는 ?t=) 검증 후 WebDAV 스트리밍 프록시 ──
app.get('/api/download/:id', requireAuth, async (req, res) => {
  const rec = meta.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'not found' });
  // TODO(메신저 연결): rec.roomId 방 멤버십 검증(req.user.sub ∈ members)
  res.setHeader('Content-Type', rec.mime);
  res.setHeader(
    'Content-Disposition',
    `${req.query.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(rec.name)}`,
  );
  try {
    const stream = readStream(rec.davPath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'webdav read failed' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch {
    res.status(502).json({ error: 'webdav read failed' });
  }
});

app.listen(Number(PORT), () => {
  console.log(`[fileserver] WebDAV 게이트웨이 → http://localhost:${PORT}`);
  console.log(`[fileserver] CORS origin: ${CORS_ORIGIN}`);
});
