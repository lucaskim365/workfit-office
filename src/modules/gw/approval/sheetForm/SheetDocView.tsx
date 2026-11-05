import { useMemo } from 'react';
import { SheetView, type Sheet } from '@/lib/sheet';
import { useFormVersionSheet } from '@/features/gw/useApprovalFormVersions';
import { parseVersionKey } from '@/domain/approvalForm/sheetVersion';
import { SealImage } from '../components/CompanySeal';
import { approvalCellProps, completedDateRows, conditionHiddenRows, draftInfoValue, sheetSealMarkId, slotOf, type SheetSlots, type DraftInfo, DOC_SHEET_VIEW, DOC_SHEET_WIDTH, SHEET_VALUES_KEY, SHEET_VERSION_KEY, applyValues, isSealCell, isSecretCell, readSheetValues } from '@/domain/approvalForm/sheet/approvalSheet';
import { SHEET_ROWS_KEY, expandRepeats, readRowExtras } from '@/domain/approvalForm/sheet/repeatRows';
import { withoutExternalRows } from '@/domain/approvalForm/sheet/sheetHeader';
import { SlotCell } from './SheetDraftForm';
import { SealMarkProvider } from '../components/CompanySeal';

/** 인쇄 — 결재 문서 인쇄 상자(.approval-print) 기준, A4 폭 210mm 에서 여백(index.css @page 14mm×2)을 뺀 폭 */
const PRINT_FIT = { rootSelector: '.approval-print', pageWidthMm: 182 };

/** 시트 서식으로 쓴 문서인가 — 서식 버전이 남아 있으면 */
export function isSheetDoc(fieldValues: Record<string, unknown> | undefined): boolean {
  return !!parseVersionKey(String(fieldValues?.[SHEET_VERSION_KEY] ?? ''));
}

/**
 * 시트 서식 문서 보기·인쇄 — 문서가 쓴 서식 버전의 틀에 저장된 값을 얹는다.
 * 다시 계산하지 않는다(§11.2): 서식이나 계산 규칙이 나중에 바뀌어도 결재 당시 모습·숫자 그대로.
 * A4 폭보다 넓은 서식은 비율로 줄인다(엑셀 '한 페이지에 맞춤'과 같음).
 */
export function SheetDocView({
  fieldValues,
  masked,
  stamped,
  fitWidth = DOC_SHEET_WIDTH,
  docInfo,
  template,
  external = false,
  slots,
}: {
  /** 문서 머리 부품 칸(결재란·회사 로고·기안자 서명)에 그릴 것 */
  slots?: SheetSlots;
  /** 대외 문서 모양(서식 '대외 문서' + 결재 완료, 발주서 PDF) — '대외 문서에서 숨김' 행을 뺀다 */
  external?: boolean;
  /** 저장된 서식 버전 대신 이 틀로 — 서식 편집기 미리보기(편집 중인 틀) */
  template?: Sheet;
  /** 자동 채우기 '기안 정보' 칸 값 — 상신된 문서의 기안자·부서·기안일·문서번호 */
  docInfo?: DraftInfo;
  fieldValues: Record<string, unknown>;
  /** 비공개 칸을 가릴지 */
  masked: boolean;
  /** 결재 완료 — 직인 자리에 회사 직인 */
  stamped: boolean;
  fitWidth?: number;
}) {
  const ver = parseVersionKey(String(fieldValues[SHEET_VERSION_KEY] ?? ''));
  const fetched = useFormVersionSheet(template ? null : (ver?.formId ?? null), template ? null : (ver?.version ?? null));
  const loaded = useMemo(() => (template ? { sheet: template } : fetched.data), [template, fetched.data]);
  const isLoading = !template && fetched.isLoading;
  const error = template ? null : fetched.error;
  const rawValues = fieldValues[SHEET_VALUES_KEY];
  const rawRows = fieldValues[SHEET_ROWS_KEY];
  // 반복 구간은 문서가 붙인 줄 수만큼 펼친 뒤 값을 얹는다
  // 행 보이기 조건으로 숨은 행 — 대외 숨김 행을 빼기 전에 정한다(조건 칸이 대외 숨김 행에 있어도 맞게). 대외 문서는 행째 뺀다
  const { sheet, condHidden } = useMemo(() => {
    if (!loaded?.sheet) return { sheet: null, condHidden: new Set<number>() };
    const filled = applyValues(expandRepeats(loaded.sheet, readRowExtras(rawRows)), readSheetValues(rawValues), { recalc: false });
    const hiddenRows = conditionHiddenRows(filled);
    return external ? { sheet: withoutExternalRows(filled, hiddenRows), condHidden: new Set<number>() } : { sheet: filled, condHidden: hiddenRows };
  }, [loaded, rawValues, rawRows, external]);

  if (!ver && !template) return null;
  if (isLoading) return <div className="py-8 text-center text-[12px] text-[#888]">문서를 불러오는 중…</div>;
  if (error || !sheet) return <div className="py-8 text-center text-[12px] text-rose-600">서식 틀({ver?.formId} v{ver?.version})을 읽지 못했습니다.</div>;

  const completedRows = new Set(completedDateRows(sheet));
  // 직인 칸이 고른 직인 — 없으면 바깥(문서 틀)이 정한 것·대표 직인
  const sealMark = sheetSealMarkId(sheet);
  const view = (
    <SheetView
      sheet={sheet}
      {...DOC_SHEET_VIEW}
      fitWidth={fitWidth}
      printFit={PRINT_FIT}
      hidden={masked ? (r, c) => isSecretCell(sheet, r, c) : undefined}
      // 결재 완료일 줄 — 결재가 끝난 문서만(기존 문서 머리와 같음)
      hiddenRows={(r) => condHidden.has(r) || (!docInfo?.completedDate && completedRows.has(r))}
      renderCell={(r, c) => {
        const props = approvalCellProps(sheet, r, c);
        // 안내문 칸 — 작성 화면에만(결재·인쇄·대외 문서엔 안 나옴)
        if (props.guide) return '';
        const bind = props.bind;
        const slot = slotOf(bind);
        if (slot) return <SlotCell node={slots?.[slot]} />;
        return draftInfoValue(bind, docInfo);
      }}
      renderOverlay={(r, c) =>
        isSealCell(sheet, r, c) ? (
          <span className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2">
            <SealImage stamped={stamped} size={56} />
          </span>
        ) : null
      }
    />
  );
  return sealMark ? <SealMarkProvider markId={sealMark}>{view}</SealMarkProvider> : view;
}
