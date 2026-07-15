/** 로컬 WebDAV 서버(실 Synology 대체) — E2E 검증 전용. Basic 인증 svc-fileapp/secret. */
import { v2 as webdav } from 'webdav-server';
import fs from 'node:fs';

const ROOT = process.env.DAV_ROOT ?? '/tmp/davroot';
fs.mkdirSync(ROOT, { recursive: true });

const users = new webdav.SimpleUserManager();
const user = users.addUser('svc-fileapp', 'secret', false);
const priv = new webdav.SimplePathPrivilegeManager();
priv.setRights(user, '/', ['all']);

const server = new webdav.WebDAVServer({
  port: Number(process.env.DAV_PORT ?? 1900),
  httpAuthentication: new webdav.HTTPBasicAuthentication(users, 'workfit'),
  privilegeManager: priv,
});
server.setFileSystem('/', new webdav.PhysicalFileSystem(ROOT), () =>
  server.start(() => console.log(`[local-dav] on :${process.env.DAV_PORT ?? 1900} root=${ROOT}`)),
);
