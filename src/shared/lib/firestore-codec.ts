/**
 * Firestore 중첩 배열 코덱.
 *
 * ★ Firestore 제약: 문서 필드에 "배열의 배열"(중첩 배열)을 직접 저장할 수 없다.
 *   (단, 배열 안의 맵, 맵 안의 배열은 허용)
 * 본 앱 일부 스키마는 z.tuple 배열(= 배열의 배열, 예: steps[][], permissions[][])을 쓰므로,
 * 저장 직전 내부 배열을 `{ [TAG]: [...] }` 맵으로 감싸고, 로드 직후 복원한다.
 * → 도메인 스키마·시드·화면은 튜플 그대로 유지(앱 메모리/시드 불변), repo 경계에서만 변환.
 *
 * 적용: 시드 러너(write) + 중첩배열 보유 컬렉션의 repo(read/write).
 * 중첩배열 없는 데이터에는 무영향(no-op).
 */
const TAG = '__nestedArray';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 저장용 인코딩 — 내부 배열을 맵으로 감싼다(재귀). */
export function encodeForFirestore<T>(value: T): unknown {
  if (Array.isArray(value)) {
    return value.map((el) =>
      Array.isArray(el) ? { [TAG]: encodeForFirestore(el) } : encodeForFirestore(el),
    );
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) out[k] = encodeForFirestore(value[k]);
    return out;
  }
  return value;
}

/** 로드용 디코딩 — 감싼 맵을 배열로 복원(재귀). */
export function decodeFromFirestore<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((el) =>
      isPlainObject(el) && TAG in el && Object.keys(el).length === 1
        ? decodeFromFirestore((el as Record<string, unknown>)[TAG])
        : decodeFromFirestore(el),
    ) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) out[k] = decodeFromFirestore(value[k]);
    return out as T;
  }
  return value as T;
}
