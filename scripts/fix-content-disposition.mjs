// ─────────────────────────────────────────────────────────────────────────
// Garage(S3) Content-Disposition 이중 인코딩 일괄 보정 스크립트 (one-off)
//
// 배경:
//   과거 앱(src/shared/lib/storage.ts)이 업로드 시 파일명을 encodeURIComponent 로
//   한 번 인코딩해 서명 API에 넘겼고, 서명 API(server.mjs `cd()`)가 이를 다시
//   encodeURIComponent 하여 Content-Disposition 에 심었다. 결과적으로 `%` 가 `%25`로
//   이중 인코딩되어(`filename*=UTF-8''%25EA%25B2%25B0…`) 한글 파일명이
//   `%EA%B2%B0…` 리터럴로 다운로드되었다. (클라이언트는 이미 수정됨 → 신규 업로드는 정상)
//
//   이 스크립트는 **이미 저장된** 객체의 Content-Disposition 을 자기완결적으로 바로잡는다.
//   이중 인코딩 값은 한 번만 percent-decode 하면 정확히 올바른 단일 인코딩 값이 되므로,
//   원본 파일명을 어디서 조회할 필요가 없다.
//
// 안전장치:
//   - 기본 DRY_RUN=true (실제 변경 없음, 미리보기만). 적용하려면 DRY_RUN=false.
//   - 이중 인코딩으로 "확실히" 판별된 객체만 건드린다(정상/무-disposition 객체는 스킵 → 멱등).
//   - CopyObject(MetadataDirective=REPLACE) 로 본문은 그대로 두고 메타데이터만 교체.
//   - ContentType 은 HeadObject 값으로 보존.
//
// 실행(테스트서버2, 서명 서버의 자격증명·node_modules 재사용):
//   cd /opt/garage-sign-api
//   set -a; source .env; set +a          # S3_* 환경변수 로드
//   # 1) 미리보기(변경 없음)
//   node /path/to/fix-content-disposition.mjs
//   # 2) 실제 적용
//   DRY_RUN=false node /path/to/fix-content-disposition.mjs
//   # 특정 프리픽스만: PREFIX=chat/ node ...   /  다른 버킷: S3_BUCKET=workfit-skmt02 ...
// ─────────────────────────────────────────────────────────────────────────
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';

const {
  // server.mjs 와 동일한 변수명 → `source .env` 하면 그대로 잡힌다.
  S3_INTERNAL_ENDPOINT = 'http://10.10.1.53:3900',
  S3_REGION = 'workfit',
  S3_BUCKET = 'workfit-files',
  S3_ACCESS_KEY_ID = '',
  S3_SECRET_ACCESS_KEY = '',
  PREFIX = '',                 // 선택: 이 프리픽스로 시작하는 키만 처리
  DRY_RUN = 'true',            // 기본 안전: 미리보기. 적용은 DRY_RUN=false
} = process.env;

const dryRun = DRY_RUN !== 'false';

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  console.error('[fix-cd] S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY 필요. `set -a; source /opt/garage-sign-api/.env; set +a` 후 실행하세요.');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: S3_INTERNAL_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: true,                          // Garage path-style
  requestChecksumCalculation: 'WHEN_REQUIRED',   // Garage 호환(기본 CRC OFF)
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
});

/** RFC 5987 `filename*=UTF-8''<v>` 의 <v> 를 뽑아낸다(없으면 null). */
function extractExtValue(disposition) {
  // 예: attachment; filename*=UTF-8''%25EA%25B2%25B0....pdf
  const m = /filename\*\s*=\s*([^']*)'([^']*)'([^;]+)/i.exec(disposition);
  if (!m) return null;
  return { charset: m[1] || 'UTF-8', lang: m[2] || '', value: m[3].trim() };
}

/**
 * 값이 "이중 인코딩"인지 판별하고, 맞으면 올바른 단일 인코딩 값을 돌려준다.
 * 판별: 한 번 decode 한 결과(once)가 그 자체로 유효한 단일 인코딩이면(=한번 더 decode 가능하고
 *       재encode 시 왕복 일치) 원래 값은 이중 인코딩이었다는 뜻.
 * 정상적인 단일 인코딩 값(예: %EA%B2%B0…)은 once 가 원문 한글이 되어 왕복이 깨지므로 스킵된다.
 */
function fixIfDoubleEncoded(value) {
  let once;
  try {
    once = decodeURIComponent(value);
  } catch {
    return null; // 애초에 유효한 인코딩이 아님 → 건드리지 않음
  }
  if (once === value) return null;                 // 인코딩 계층이 없음
  if (!/%[0-9A-Fa-f]{2}/.test(once)) return null;  // 한 번 풀었더니 더는 %XX 없음 → 이미 단일(정상)
  try {
    const twice = decodeURIComponent(once);        // 최종 원문
    if (encodeURIComponent(twice) !== once) return null; // 왕복 불일치 → 이중 인코딩 아님(보수적 스킵)
    return { corrected: once, filename: twice };
  } catch {
    return null;
  }
}

/** CopyObject 의 CopySource 용 키 인코딩(경로 세그먼트 단위). */
function encodeCopySource(bucket, key) {
  const encKey = key.split('/').map(encodeURIComponent).join('/');
  return `/${bucket}/${encKey}`;
}

async function main() {
  console.log(`[fix-cd] bucket=${S3_BUCKET} endpoint=${S3_INTERNAL_ENDPOINT} prefix=${PREFIX || '(all)'} DRY_RUN=${dryRun}`);
  let ContinuationToken;
  let scanned = 0, skipped = 0, fixed = 0, noCd = 0, errors = 0;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: PREFIX || undefined,
      ContinuationToken,
      MaxKeys: 1000,
    }));
    for (const obj of list.Contents || []) {
      const Key = obj.Key;
      scanned++;
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key }));
        const cd = head.ContentDisposition;
        if (!cd) { noCd++; continue; }
        const ext = extractExtValue(cd);
        if (!ext) { skipped++; continue; }
        const fix = fixIfDoubleEncoded(ext.value);
        if (!fix) { skipped++; continue; }

        const newCd = `attachment; filename*=UTF-8''${fix.corrected}`;
        console.log(`FIX  ${Key}`);
        console.log(`     old: ${cd}`);
        console.log(`     new: ${newCd}   → "${fix.filename}"`);

        if (!dryRun) {
          await s3.send(new CopyObjectCommand({
            Bucket: S3_BUCKET,
            Key,
            CopySource: encodeCopySource(S3_BUCKET, Key),
            MetadataDirective: 'REPLACE',
            ContentDisposition: newCd,
            ContentType: head.ContentType || 'application/octet-stream',
          }));
        }
        fixed++;
      } catch (e) {
        errors++;
        console.error(`ERR  ${Key}: ${e?.message || e}`);
      }
    }
    ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (ContinuationToken);

  console.log('─'.repeat(60));
  console.log(`[fix-cd] scanned=${scanned} ${dryRun ? 'would-fix' : 'fixed'}=${fixed} skipped(normal)=${skipped} no-disposition=${noCd} errors=${errors}`);
  if (dryRun && fixed > 0) console.log('[fix-cd] 미리보기입니다. 실제 적용: DRY_RUN=false 로 다시 실행하세요.');
}

main().catch((e) => { console.error(e); process.exit(1); });
