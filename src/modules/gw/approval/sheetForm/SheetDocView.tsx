import { useEffect, useMemo, useRef } from 'react';
import { DEFAULT_COL_WIDTH, SheetView, downloadXlsx, exportXlsx, stretchedColWidths, type Sheet, type XlsxPicture } from '@/lib/sheet';
import { captureElementPng } from '@/shared/lib/pdf';
import { docExportOptions } from '@/domain/approvalForm/sheet/docExport';
import { useFormVersionSheet } from '@/features/gw/useApprovalFormVersions';
import { parseVersionKey } from '@/domain/approvalForm/sheetVersion';
import { SealImage } from '../components/CompanySeal';
import { approvalCellProps, completedDateRows, conditionHiddenRows, draftInfoValue, sheetSealMarkId, slotOf, type SheetSlots, type DraftInfo, DOC_SHEET_VIEW, DOC_SHEET_WIDTH, SHEET_VALUES_KEY, SHEET_VERSION_KEY, applyValues, isSealCell, isSecretCell, readSheetValues } from '@/domain/approvalForm/sheet/approvalSheet';
import { SHEET_ROWS_KEY, expandRepeats, readRowExtras } from '@/domain/approvalForm/sheet/repeatRows';
import { withoutExternalRows } from '@/domain/approvalForm/sheet/sheetHeader';
import { SHEET_OWN_KEY, readOwnSheet } from '@/domain/approvalForm/sheet/ownSheet';
import { SheetFormTitle, SlotCell } from './SheetDraftForm';
import { SealMarkProvider } from '../components/CompanySeal';

/** 인쇄 — 결재 문서 인쇄 상자(.approval-print) 기준, A4 폭 210mm 에서 여백(index.css @page 14mm×2)을 뺀 폭 */
const PRINT_FIT = { rootSelector: '.approval-print', pageWidthMm: 182 };

/**
 * 엑셀에 넣을 그림 — 화면에 그려진 문서 머리 부품(결재란·회사 로고·기안자 서명·회사 정보)과 찍힌 직인을 그대로 떠서
 * 그 칸 자리(시트 px)에 놓는다. 화면 배율·맞춤 축소와 상관없이 칸 폭 대비 비율로 잰다. 떠낸 부품 칸은 글자를 비운다
 */
async function capturePictures(box: HTMLElement | null, sheet: Sheet): Promise<{ pictures: XlsxPicture[]; slots: Set<string> }> {
  const pictures: XlsxPicture[] = [];
  const slots = new Set<string>();
  if (!box) return { pictures, slots };
  const els = Array.from(box.querySelectorAll<HTMLElement>('[data-slot], [data-seal]'));
  for (const el of els) {
    // 직인은 찍혔을 때만(그림이 있을 때) — 안 찍힌 '(직인)' 글자는 칸 글자 그대로
    if (el.dataset.seal !== undefined && !el.querySelector('img')) continue;
    const td = el.closest<HTMLElement>('td[data-sheet-cell]');
    if (!td) continue;
    const [r, c] = (td.dataset.sheetCell ?? '').split(':').map(Number);
    const m = sheet.merges.find((x) => x.startRow === r && x.startCol === c);
    let cellPx = 0;
    for (let k = c; k < c + (m?.colSpan ?? 1); k++) cellPx += sheet.colWidths[sheet.cols[k]] ?? DEFAULT_COL_WIDTH;
    const tdBox = td.getBoundingClientRect();
    const elBox = el.getBoundingClientRect();
    if (!tdBox.width || !elBox.width || !elBox.height) continue;
    const k = cellPx / tdBox.width;
    const data = await captureElementPng(el);
    if (!data) continue;
    pictures.push({ r, c, x: (elBox.left - tdBox.left) * k, y: (elBox.top - tdBox.top) * k, width: elBox.width * k, height: elBox.height * k, data, type: 'png' });
    if (el.dataset.slot) slots.add(el.dataset.slot);
  }
  return { pictures, slots };
}

/**
 * 화면 줄 높이(시트 px) — 칸보다 긴 글이 줄바꿈돼 늘어난 줄도 화면과 같게. 표 폭 대비 비율로 잰다
 */
function screenRowHeights(box: HTMLElement | null, sheet: Sheet): (r: number) => number | undefined {
  const table = box?.querySelector('table');
  const total = sheet.cols.reduce((sum, col) => sum + (sheet.colWidths[col] ?? DEFAULT_COL_WIDTH), 0);
  const tw = table?.getBoundingClientRect().width ?? 0;
  if (!table || !tw) return () => undefined;
  const k = total / tw;
  const heights = new Map<number, number>();
  table.querySelectorAll<HTMLElement>('tr[data-sheet-row]').forEach((tr) => heights.set(Number(tr.dataset.sheetRow), tr.getBoundingClientRect().height * k));
  return (r) => heights.get(r);
}

/**
 * 결재란 자리가 비어 있으면(결재 끝난 직인 서식 등) 큰 제목을 그 자리까지 넓힌다 — 화면은 제목을 결재란 뺀 폭 가운데에 놓지만
 * 엑셀은 병합 칸 가운데라, 결재란 없이 제목 칸만 두면 왼쪽으로 치우쳐 보인다
 */
function withTitleOverEmptyStamp(s: Sheet): Sheet {
  const keyOf = (bind: string) => Object.entries(s.cellMeta.bind ?? {}).find(([, v]) => v === bind)?.[0];
  const title = keyOf('doc.formTitle');
  const stamp = keyOf('doc.approvalLine');
  if (!title || !stamp) return s;
  const pos = (key: string) => ({ r: Number(key.slice(0, key.indexOf(':'))), c: s.cols.indexOf(key.slice(key.indexOf(':') + 1)) });
  const t = pos(title);
  const a = pos(stamp);
  const tm = s.merges.find((m) => m.startRow === t.r && m.startCol === t.c) ?? { startRow: t.r, startCol: t.c, rowSpan: 1, colSpan: 1 };
  const am = s.merges.find((m) => m.startRow === a.r && m.startCol === a.c) ?? { startRow: a.r, startCol: a.c, rowSpan: 1, colSpan: 1 };
  // 같은 줄들에 나란히(결재란이 제목 바로 오른쪽) 있을 때만
  if (tm.startRow !== am.startRow || tm.rowSpan !== am.rowSpan || am.startCol !== tm.startCol + tm.colSpan) return s;
  const merged = { ...tm, colSpan: tm.colSpan + am.colSpan };
  return { ...s, merges: [...s.merges.filter((m) => m !== tm && m !== am), merged] };
}

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
  slotText,
  onExportReady,
}: {
  /** 문서 머리 부품 칸(결재란·회사 로고·기안자 서명)에 그릴 것 */
  slots?: SheetSlots;
  /** 엑셀로 받을 때 문서 머리 부품 칸에 넣을 글자(결재란 → '팀장 홍길동 승인 …') */
  slotText?: Partial<Record<keyof SheetSlots, string>>;
  /**
   * 엑셀로 받기 — 문서를 다 읽으면 받는 함수(파일 이름을 넣어 부름)를, 못 받는 동안엔 null 을 넘긴다.
   * 받는 쪽(결재 문서 화면)이 [엑셀] 단추를 보이고 누르면 부른다. 화면과 같은 내용(숨은 행·비공개 가림·자동 채우기 값)
   */
  onExportReady?: (fn: ((fileName: string) => Promise<void>) | null) => void;
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
  // 기안자가 표 모양을 고친 문서는 문서가 가진 시트를 틀로(ownSheet.ts) — 서식 버전은 읽지 않아도 된다
  const rawOwn = fieldValues[SHEET_OWN_KEY];
  const own = useMemo(() => (template ? null : readOwnSheet(rawOwn)), [template, rawOwn]);
  const loaded = useMemo(() => (template ? { sheet: template } : own ? { sheet: own } : fetched.data), [template, own, fetched.data]);
  const isLoading = !template && !own && fetched.isLoading;
  const error = template || own ? null : fetched.error;
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

  // 엑셀로 받기 — 최신 값으로 부르게(문서·가림 상태가 바뀌어도 함수는 한 번만 넘긴다)
  const boxRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef({ sheet, condHidden, masked, docInfo, slotText });
  exportRef.current = { sheet, condHidden, masked, docInfo, slotText };
  const ready = !!sheet;
  useEffect(() => {
    if (!onExportReady) return;
    if (!ready) {
      onExportReady(null);
      return;
    }
    onExportReady(async (fileName) => {
      const cur = exportRef.current;
      if (!cur.sheet) return;
      // 화면과 같은 열 너비(종이 폭에 맞춰 늘린 것) — 그림 자리·글 맞춤도 이 너비 기준
      const sized: Sheet = { ...cur.sheet, colWidths: stretchedColWidths(cur.sheet, DOC_SHEET_VIEW.stretchTo) };
      const { pictures, slots } = await capturePictures(boxRef.current, sized);
      const slotText = { ...cur.slotText };
      slots.forEach((s) => (slotText[s as keyof SheetSlots] = ''));
      // 결재란이 정말 비었을 때만(화면에 결재란이 없고 글자도 없음) 제목을 넓힌다 — 그림 뜨기에 실패한 것과 헷갈리지 않게
      const stampOnScreen = !!boxRef.current?.querySelector('[data-slot="approvalLine"]');
      const out = stampOnScreen || cur.slotText?.approvalLine ? sized : withTitleOverEmptyStamp(sized);
      const opts = docExportOptions({ ...cur, slotText, sheet: out, sheetName: fileName });
      downloadXlsx(await exportXlsx(out, { ...opts, pictures, rowHeight: screenRowHeights(boxRef.current, sized) }), fileName);
    });
    return () => onExportReady(null);
  }, [onExportReady, ready]);

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
        if (slot) return <SlotCell node={slots?.[slot]} slot={slot} />;
        if (bind === 'doc.formTitle') return <SheetFormTitle text={draftInfoValue(bind, docInfo) ?? ''} />;
        return draftInfoValue(bind, docInfo);
      }}
      renderOverlay={(r, c) =>
        isSealCell(sheet, r, c) ? (
          <span data-seal="" className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2">
            <SealImage stamped={stamped} size={56} />
          </span>
        ) : null
      }
    />
  );
  const inner = sealMark ? <SealMarkProvider markId={sealMark}>{view}</SealMarkProvider> : view;
  // 엑셀 받기 때 그림 자리를 재는 상자
  const body = <div ref={boxRef}>{inner}</div>;
  // 결재자가 알아보게 — 기안자가 서식의 표 모양(열·행·수식)을 고친 문서. 인쇄·대외 문서에는 안 나옴
  if (!own || external) return body;
  return (
    <>
      <div className="mb-1 text-right text-[10.5px] font-semibold text-amber-700 print:hidden">기안자가 표 모양을 고친 문서입니다</div>
      {body}
    </>
  );
}
