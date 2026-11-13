/**
 * 수동 부여 대체휴무(substituteHolidayGrants) 사용 이력 보고 — 읽기만 한다(아무것도 바꾸지 않음).
 * 대체휴무 휴가 문서를 상태별로 모아 수동 부여 목록과 나란히 보여 준다.
 *
 *   npx tsx scripts/report-manual-substitute.ts          (개발)
 *   npx tsx scripts/report-manual-substitute.ts --prod   (운영)
 */
import { connect, listAll, loadApprovalDocs } from './lib-substitute';

async function main() {
  const { dbs, dbId, isProd, projectId } = connect();
  console.log(`대상: ${isProd ? '운영' : '개발'} (${projectId}) — 읽기만`);
  const grants = await listAll(dbs, dbId, 'substituteHolidayGrants');
  console.log(`\n수동 부여 ${grants.length}건`);
  for (const g of grants) {
    console.log(`  - ${g.occurrenceDate} ${g.days}일 대상 ${g.targetScopeLabel || g.targetScope} 사유 ${g.reason || '-'} (등록 ${g.grantedBy || '-'} ${String(g.createdAt || '').slice(0, 10)})`);
  }
  const leaveDocs = await loadApprovalDocs(dbs, dbId, ['휴가']);
  const used = leaveDocs.filter((d) => (d.form?.leaveType ?? d.fieldValues?.leaveType) === '대체휴무');
  console.log(`\n대체휴무 휴가 문서 ${used.length}건`);
  for (const d of used) {
    console.log(`  - ${d.docNo || d.id} ${d.drafterName || d.drafterId} ${d.form?.startDate ?? d.fieldValues?.period ?? ''} ${d.form?.days ?? ''}일 ${d.status}`);
  }
  const active = used.filter((d) => ['완료', '진행중'].includes(d.status));
  console.log(
    `\n결론: ${active.length === 0 ? '대체휴무를 쓴 결재 완료·진행 중 문서 없음 — 수동 부여는 사용된 적 없음' : `대체휴무를 쓴 문서 ${active.length}건 있음 — 폐기 전 확인 필요`}`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
