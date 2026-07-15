# WebDAV/FS 게이트웨이 — Synology Container Manager 상주용.
# NAS 내부에서 fs 백엔드로 실행 시 마운트된 공유폴더에 직접 파일을 쓴다(WebDAV·TLS 불필요).
FROM node:20-alpine

WORKDIR /app

# 의존성만 먼저 설치(레이어 캐시)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# 소스
COPY src ./src

# 기본값(compose/Container Manager 환경변수로 덮어씀)
ENV PORT=3001 \
    STORAGE_BACKEND=fs \
    FS_ROOT=/files \
    META_FILE=/data/meta.json \
    TUS_DIR=/data/tus \
    CORS_ORIGIN=*

EXPOSE 3001

CMD ["node", "src/server.mjs"]
