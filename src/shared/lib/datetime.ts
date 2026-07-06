/**
 * 앱 공용 로컬 시각 유틸.
 *
 * 저장 포맷은 시드·auth.repo 와 동일한 로컬 나이브 'YYYY-MM-DDTHH:mm:ss'.
 * ⚠ new Date().toISOString() 은 UTC(KST-9h)로 찍혀, 로컬 시각으로 저장된
 *    기존 데이터와 문자열 정렬이 어긋난다(대화 순서 뒤섞임). 반드시 이 함수를 쓸 것.
 */
export function nowLocalIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
