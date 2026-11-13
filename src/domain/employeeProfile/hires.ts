/** 이달의 입사자 — 입사일(YYYY-MM-DD)이 그 달(YYYY-MM)인 사람, 날짜순 */
export function hiresInMonth<P extends { hireDate?: string | null }>(people: P[], month: string): Array<{ person: P; date: string }> {
  return people
    .map((person) => ({ person, date: (person.hireDate ?? '').trim() }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date.startsWith(`${month}-`))
    .sort((a, b) => a.date.localeCompare(b.date));
}
