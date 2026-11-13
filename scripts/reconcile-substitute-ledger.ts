/**
 * 대체휴무 원장 대조 — 결재 완료·취소완료 휴일근로 문서와 원장(substituteHolidayLedger)을 비교해 빠진 줄만 넣는다.
 * 결재 문서는 읽기만 한다. 같은 문서로 두 번 들어가지 않는다(줄 id = 근거 문서).
 *
 *   npx tsx scripts/reconcile-substitute-ledger.ts --dry-run          (개발, 출력만)
 *   npx tsx scripts/reconcile-substitute-ledger.ts                    (개발 적용)
 *   npx tsx scripts/reconcile-substitute-ledger.ts --prod --dry-run   (운영, 출력만)
 *   npx tsx scripts/reconcile-substitute-ledger.ts --prod             (운영 적용 — 사용자 지시 후)
 */
import { HOLIDAY_WORK_DOC_TYPES } from '../src/domain/approvalDoc/holidayWorkDuplicate';
import { formatMinutes, missingLedgerEntries, type SubstituteLedgerEntry } from '../src/domain/leave/substituteLedger';
import { connect, listAll, loadApprovalDocs, loadBreakPolicy } from './lib-substitute';

const COLL = 'substituteHolidayLedger';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { dbs, dbId, isProd, projectId } = connect();
  console.log(`대상: ${isProd ? '운영' : '개발'} (${projectId})${dryRun ? ' — 출력만' : ''}`);
  const [docs, ledgerRows, policy] = await Promise.all([
    loadApprovalDocs(dbs, dbId, HOLIDAY_WORK_DOC_TYPES),
    listAll(dbs, dbId, COLL),
    loadBreakPolicy(dbs, dbId),
  ]);
  const ledger = ledgerRows.map((r) => ({ ...r, id: r.id ?? r.$id })) as SubstituteLedgerEntry[];
  console.log(`휴일근로 문서 ${docs.length}건, 원장 ${ledger.length}줄, 휴게 ${policy.breakStartTime}~${policy.breakEndTime}`);
  const missing = missingLedgerEntries(docs, ledger, policy, new Date().toISOString());
  for (const e of missing) {
    console.log(`  + ${e.kind === 'GRANT' ? '지급' : '차감'} ${e.sourceDocNo || e.sourceDocId} ${e.userId} 근무 ${e.workDate} ${formatMinutes(e.workMinutes)} → ${formatMinutes(e.minutes)}`);
    if (dryRun) continue;
    try {
      await dbs.createDocument(dbId, COLL, e.id, e);
    } catch (err: any) {
      if (err?.code === 409) console.log('    = 이미 있음, 건너뜀');
      else throw err;
    }
  }
  console.log(missing.length === 0 ? '빠진 줄 없음' : dryRun ? `빠진 줄 ${missing.length}건 — 출력만, 바꾼 것 없음` : `${missing.length}건 넣음`);
}

main().catch((e) => { console.error(e); process.exit(1); });
