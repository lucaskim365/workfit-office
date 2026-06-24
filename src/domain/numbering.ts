/**
 * 채번(numbering) 유틸 — 문서번호 포맷. 시퀀스는 counters 채널에서 원자 발급.
 * ([[데이터_모델_설계서.md]] §3 채번 / Date.now를 ID로 쓰지 않는다)
 */
export function yymmdd(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** WO-YYMMDD-NNN. */
export function formatWoNo(dateKey: string, seq: number): string {
  return `WO-${dateKey}-${String(seq).padStart(3, '0')}`;
}
