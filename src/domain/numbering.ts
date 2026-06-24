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

/** NCR-YYMMDD-NNN (부적합 보고서). */
export function formatNcrNo(dateKey: string, seq: number): string {
  return `NCR-${dateKey}-${String(seq).padStart(3, '0')}`;
}

/** 접두사 기반 일반 채번 포맷({PREFIX}-YYMMDD-NNN). */
export function formatDocNo(prefix: string, dateKey: string, seq: number): string {
  return `${prefix}-${dateKey}-${String(seq).padStart(3, '0')}`;
}

/** MRB-YYMMDD-NNN (부적합 심의). */
export function formatMrbNo(dateKey: string, seq: number): string {
  return formatDocNo('MRB', dateKey, seq);
}

/** RW-/SC-YYMMDD-NNN (재작업/폐기 지시). prefix로 구분. */
export function formatReworkNo(prefix: 'RW' | 'SC', dateKey: string, seq: number): string {
  return formatDocNo(prefix, dateKey, seq);
}

/** CAPA-YYMMDD-NNN (시정·예방조치). */
export function formatCapaNo(dateKey: string, seq: number): string {
  return formatDocNo('CAPA', dateKey, seq);
}
