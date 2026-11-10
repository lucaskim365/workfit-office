import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { suggestFormCode } from '@/domain/approvalForm/formCode';
import { ArrowLeft, Asterisk, EyeOff, Eye, FileSpreadsheet, Filter, GitBranch, History, Info, Lock, Save, Stamp, Tag, X } from 'lucide-react';
import { SheetDraftForm } from '@/modules/gw/approval/sheetForm/SheetDraftForm';
import { SheetDocView } from '@/modules/gw/approval/sheetForm/SheetDocView';
import { legacyFormToSheet } from '@/modules/gw/approval/sheetForm/fromLegacyForm';
import type { DocFields } from '@/modules/gw/approval/sheetForm/SheetDraftForm';
import { ApprovalDraftDocumentSheet } from '@/modules/gw/approval/components/ApprovalDraftDocumentSheet';
import type { User } from '@/domain/user/schema';
import { useHolidays } from '@/features/holiday/useHolidays';
import { HEADER_ITEMS, HEADER_ITEM_LABEL, withBodyHeader } from '@/domain/approvalForm/headerItems';
import { insertDocHeader, insertDocInfoBlock, isExternalHiddenRow, isFullHeaderSheet, sheetHeaderItems } from '@/domain/approvalForm/sheet/sheetHeader';
import type { ApprovalStep } from '@/domain/approvalDoc/schema';
import { autoNumberPreview } from '@/domain/approvalForm/autoNumber';
import { useAuth } from '@/app/auth/AuthProvider';
import type { ApprovalFolder, ApprovalForm } from '@/domain/approvalForm/schema';
import { useFormVersionList, useFormVersionSheet, useSaveSheetForm, useSetSheetSwitch, useSheetFormVersions, useSheetSwitches } from '@/features/gw/useApprovalFormVersions';
import { hasLegacyFields, sheetApplied } from '@/domain/approvalForm/sheetSwitch';
import { SheetFormSettings } from './SheetFormSettings';
import { DEFAULT_COL_WIDTH, SheetEditor, createSheet, importXlsx, type CellRange, type Sheet, type SheetSelection } from '@/lib/sheet';
import {
  SHEET_PAGE_WIDTH,
  approvalCellProps,
  bindLabel,
  mergeApprovalRange,
  mergeCoversLinks,
  mergeDropsContent,
  LINK_TYPES,
  linkIssues,
  linkSystemValues,
  korDateText,
  type SheetSlots,
  VISIBILITY_LABEL,
  nameLabel,
  CHECK_MARK,
  conditionSources,
  rowConditionOf,
  isStructureLocked,
  isDocFieldBind,
  setApprovalCellValue,
  validateApprovalSheet,
} from '@/domain/approvalForm/sheet/approvalSheet';
import { SheetCellPanel } from './SheetCellPanel';
import { requestSidebarCollapse } from '@/app/shell/collapseSidebar';
import { PART_MIME, SheetPalette, applyPart } from './SheetPalette';
import { INPUT_SHORT_LABELS, InputLook } from './InputLook';
import { healRepeatSections, repeatIssues, repeatSections } from '@/domain/approvalForm/sheet/repeatRows';

/** 편집기 칸 표시 방식 */
type MarksMode = 'simple' | 'detail' | 'off';

/**
 * 시트 서식 편집기(관리자) — 엑셀 불러오기, 틀 편집, 칸 속성, 버전 저장.
 * 서식 머리(이름·코드·폴더)는 approvalForms 에, 틀은 저장할 때마다 approvalFormVersions 에 새 버전으로 쌓는다.
 * 기안·결재 화면 연결은 다음 단계라 지금은 '사용 안 함'으로만 저장한다(기안 목록에 나오지 않음).
 */
const inp = 'w-full rounded-lg border border-border-hi bg-panel px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-teal disabled:bg-panel-alt disabled:text-ink3';

interface Props {
  /** 새 서식이면 id 가 빈 문자열 */
  form: ApprovalForm;
  /** 열 때의 최신 버전(새 서식이면 null) */
  version: number | null;
  /** 코드 중복 검사용 — 전체 서식 */
  forms: ApprovalForm[];
  folders: ApprovalFolder[];
  onClose: () => void;
  /** 새 서식을 이 틀로 시작 — 기존 서식에서 변환한 초안 */
  initialSheet?: Sheet;
  initialLink?: string | null;
  /** 처음 띄울 안내(변환에서 옮기지 못한 것 등) */
  initialNotice?: { text: string; list?: string[] };
  /** 기존 양식(항목 목록) 편집기로 — 기존 서식에 시트를 붙인 경우 */
  onOpenLegacy?: () => void;
  /** 편집기만 있는 새 탭(/sheet-editor) — 앱 상단바·메뉴가 없어 화면 맨 위에 붙고, 왼쪽 메뉴 접기도 안 함 */
  standalone?: boolean;
  /** 저장한 뒤(서식 코드·버전) — 새 탭이면 결재서식 관리 창에 알린다 */
  onSaved?: (formId: string, version: number) => void;
}

export function SheetFormDesigner(props: Props) {
  const { data: loaded, isLoading, error } = useFormVersionSheet(props.form.id || null, props.version);
  if (props.version !== null && isLoading) {
    return <div className="rounded-xl border border-border bg-panel p-10 text-center text-[12.5px] text-ink3">서식을 불러오는 중…</div>;
  }
  if (props.version !== null && (error || !loaded)) {
    return (
      <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-[12.5px] text-red-600">
        <div>서식 틀(v{props.version})을 읽지 못했습니다. {error instanceof Error ? error.message : ''}</div>
        <button type="button" onClick={props.onClose} className="rounded-lg border border-border bg-panel px-3 py-1.5 font-semibold text-ink2">
          서식 목록
        </button>
      </div>
    );
  }
  return <Designer {...props} initial={loaded?.sheet ?? props.initialSheet ?? insertDocHeader(fitToPage(createSheet(12, 8)), { formTitle: true })} initialLink={loaded?.link ?? props.initialLink ?? null} />;
}

/** 새 서식 틀 — 열 너비를 A4 인쇄 폭에 맞춰 나눈다(기안 화면에서 옆으로 밀리지 않게) */
const fitToPage = (s: Sheet): Sheet => ({ ...s, colWidths: Object.fromEntries(s.cols.map((c) => [c, Math.floor(SHEET_PAGE_WIDTH / s.cols.length)])) });

/** 문서 종이의 좌우 여백 + 테두리(ApprovalDraftDocumentSheet px-8) */
const PAPER_PAD = 66;
/** 앱에서 화면 위에 붙어 있는 높이 — 상단바(58px) + 탭 막대(36px). 편집기 도구 막대·옆 패널이 그 아래에 붙는다 */
const APP_STICKY_TOP = 94;
/** 편집기 옆 막대 폭 — 부품(2열)·부품(아이콘만)·설정 패널 */
const PALETTE_W = 196;
const PALETTE_ICONS_W = 56;
const SIDE_W = 320;
const SIDE_MIN_W = 280;

function Designer({
  form: initialForm,
  version: initialVersion,
  forms,
  folders,
  onClose,
  initial,
  initialLink,
  initialNotice,
  onOpenLegacy,
  standalone = false,
  onSaved,
}: Omit<Props, 'initialLink'> & { initial: Sheet; initialLink: string | null }) {
  const { user } = useAuth();
  const save = useSaveSheetForm();
  const [form, setForm] = useState<ApprovalForm>(initialForm);
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [baseVersion, setBaseVersion] = useState<number | null>(initialVersion);
  const [savedSheet, setSavedSheet] = useState<Sheet>(initial);
  const [savedForm, setSavedForm] = useState<ApprovalForm>(initialForm);
  const [selection, setSelection] = useState<SheetSelection>({ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, focus: { r: 0, c: 0 } });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string; list?: string[] } | null>(initialNotice ? { kind: 'info', ...initialNotice } : null);
  const [note, setNote] = useState('');
  // 연동 기능(연동 유형) — 휴가·외근·출장·휴일근무 기능과 잇기. 버전과 함께 저장된다
  const [link, setLink] = useState<string | null>(initialLink);
  const [savedLink, setSavedLink] = useState<string | null>(initialLink);
  const [side, setSide] = useState<'cell' | 'settings' | 'history'>('cell');
  // 기존 서식(항목 목록이 있는 서식)에 시트를 붙인 경우 — 서식 기록·항목 목록은 그대로, 시트 틀만 버전으로 쌓는다
  const legacy = !!initialForm.id && hasLegacyFields(initialForm);
  const { switches } = useSheetSwitches();
  const setSwitch = useSetSheetSwitch();
  const applied = sheetApplied(initialForm, switches);
  // 서식별 최신 버전 — 지운 서식의 버전 기록도 남아 있다(버전은 지우지 않음)
  const { latest: versionHeads } = useSheetFormVersions();
  const [preview, setPreview] = useState<{ sheet: Sheet; title: string } | null>(null);
  // 편집 화면 — 문서(종이 위에서 실제 문서 모양 그대로) / 격자(엑셀처럼 A·B·C 머리)
  const [view, setView] = useState<'paper' | 'grid'>(() => {
    try {
      return localStorage.getItem('sheetDesigner.view') === 'grid' ? 'grid' : 'paper';
    } catch {
      return 'paper';
    }
  });
  // 칸 표시 — 간단(못 고치는 칸만 옅은 빗금, 특별한 칸은 작은 아이콘) / 자세히(글자 꼬리표 전부) / 끔(엑셀처럼 깨끗하게)
  const [markMode, setMarkMode] = useState<MarksMode>(() => {
    try {
      const v = localStorage.getItem('sheetDesigner.marks');
      return v === 'detail' || v === 'off' ? v : 'simple';
    } catch {
      return 'simple';
    }
  });
  const changeMarks = (v: MarksMode) => {
    setMarkMode(v);
    try {
      localStorage.setItem('sheetDesigner.marks', v);
    } catch {
      /* 저장 못 해도 이번 화면은 바뀐다 */
    }
  };
  const changeView = (v: 'paper' | 'grid') => {
    setView(v);
    try {
      localStorage.setItem('sheetDesigner.view', v);
    } catch {
      /* 저장 못 해도 이번 화면은 바뀐다 */
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);

  const isNew = !form.id;
  const sheetWidth = sheet.cols.reduce((sum, col) => sum + (sheet.colWidths[col] ?? DEFAULT_COL_WIDTH), 0);
  // 편집기 폭 — 문서 종이(A4 세로 800px, 넓은 시트면 그 폭) + 회색 바탕 여백·행 번호 칸
  const editorWidth = Math.max(800, sheetWidth + PAPER_PAD) + 76;
  const pageScale = sheetWidth > SHEET_PAGE_WIDTH ? SHEET_PAGE_WIDTH / sheetWidth : 1;
  const dirty = sheet !== savedSheet || link !== savedLink || JSON.stringify(form) !== JSON.stringify(savedForm);
  const set = (patch: Partial<ApprovalForm>) => setForm((f) => ({ ...f, ...patch }));
  // 새 서식 코드 — 서식명에서 저절로(이미 쓰는 코드·지운 시트 서식 코드와 안 겹치게). [직접 정하기]를 누르면 직접 쓴다
  const [codeManual, setCodeManual] = useState(false);
  const autoCode = useMemo(
    () => suggestFormCode(form.name, [...forms.map((f) => f.code), ...versionHeads.keys()]),
    [form.name, forms, versionHeads]
  );
  const effectiveCode = isNew && !codeManual ? autoCode : form.code;

  const close = () => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return;
    onClose();
  };
  // 저장 안 한 채 탭을 닫거나 새로고침하면 브라우저가 한 번 묻는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ── 엑셀 불러오기 ──
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const hasContent = sheet.rows.some((row) => Object.values(row).some((v) => v !== ''));
    // 문서 정보 표(기안자·제목 등 칸)가 있던 시트면 불러온 엑셀 위에 다시 넣는다 — 새 서식은 이 표로 시작하므로 엑셀만 넣어도 유지
    const keepFull = isFullHeaderSheet(sheet);
    const keepInfo = sheetHeaderItems(sheet).length > 0;
    if (hasContent && !confirm(`지금 시트를 '${file.name}' 내용으로 바꿉니다. 칸 속성도 모두 지워집니다${keepInfo ? (keepFull ? '(문서 머리·맺음말은 엑셀 위·아래에 기본 모양으로 다시 넣음)' : '(문서 정보 표는 엑셀 위에 기본 모양으로 다시 넣음)') : ''}. Ctrl+Z 로 되돌릴 수 있습니다. 계속할까요?`)) return;
    try {
      const { sheet: fromXlsx, warnings } = await importXlsx(new Uint8Array(await file.arrayBuffer()));
      // 엑셀엔 보통 제목이 들어 있어 큰 제목 칸은 비운다
      const imported = keepFull ? insertDocHeader(fromXlsx, { title: '', closing: form.closing || undefined }) : keepInfo ? insertDocInfoBlock(fromXlsx) : fromXlsx;
      setSheet(imported);
      // 엑셀 양식엔 보통 제목이 들어 있다 — 문서 머리의 큰 제목과 겹치지 않게 끈다(서식 정보에서 다시 켤 수 있음).
      // 기존 서식에 붙인 시트는 끄지 않는다 — 그 설정은 기존 서식 기록이라 옛 문서 제목까지 사라진다
      if (!legacy) setForm((f) => ({ ...f, hiddenHeaderItems: [...new Set([...(f.hiddenHeaderItems ?? []), 'docTitle'])] }));
      const base = file.name.replace(/\.xlsx$/i, '');
      if (!form.name.trim()) set({ name: base });
      setNote(`엑셀에서 불러옴: ${file.name}`);
      setMsg({
        kind: warnings.length ? 'info' : 'ok',
        text: `'${file.name}'을 불러왔습니다 — ${fromXlsx.rows.length}행 × ${fromXlsx.cols.length}열. 이제 기안자가 쓸 칸을 골라 '입력 칸'으로 정해 주세요. ${keepFull ? '문서 머리(로고·결재란·문서 정보)와 맺음말은 엑셀 위·아래에 그대로 두었습니다 — 큰 제목 칸은 비웠으니 엑셀 제목을 쓰거나 칸을 정리하세요. ' : keepInfo ? '맨 위 문서 정보 표는 그대로 두었습니다(엑셀에 같은 칸이 있으면 한쪽을 지우세요). ' : '문서 머리(로고·결재란·문서 정보·맺음말)도 시트 안에 두려면 편집 도구의 [문서 머리 넣기]를 누르세요. '}${legacy ? '' : "(문서 머리의 큰 제목은 엑셀 제목과 겹치지 않게 껐습니다 — 아래 '문서 머리에 보일 항목'에서 바꿀 수 있음)"}`,
        list: warnings,
      });
    } catch (err) {
      setMsg({ kind: 'err', text: `엑셀을 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // ── 저장 ──
  const onSave = async () => {
    const code = effectiveCode.trim();
    const name = form.name.trim();
    if (!name) return setMsg({ kind: 'err', text: '서식명을 입력하세요.' });
    if (!code) return setMsg({ kind: 'err', text: '서식 코드를 입력하세요.' });
    if (isNew && forms.some((f) => f.code.toLowerCase() === code.toLowerCase())) {
      return setMsg({ kind: 'err', text: `서식 코드 '${code}'는 이미 쓰고 있습니다. 다른 코드를 정해 주세요.` });
    }
    // 지운 시트 서식의 코드 — 버전 기록(v1…)이 남아 있어 같은 코드로 새로 저장하면 옛 버전과 부딪힌다
    if (isNew && versionHeads.has(code)) {
      return setMsg({ kind: 'err', text: `서식 코드 '${code}'는 예전에 지운 시트 서식이 쓰던 코드입니다(버전 기록 v${versionHeads.get(code)}까지 남아 있음 — 그 코드로 쓴 문서를 보여 주려고 지우지 않음). 다른 코드를 정해 주세요.` });
    }
    const errors = [...validateApprovalSheet(sheet), ...repeatIssues(sheet), ...linkIssues(sheet, link)];
    if (errors.length) return setMsg({ kind: 'err', text: '저장할 수 없습니다. 아래를 고쳐 주세요.', list: errors });
    if (!user) return setMsg({ kind: 'err', text: '로그인 정보가 없습니다.' });

    // 기존 서식은 항목 목록을 그대로 둔다(옛 문서가 그 항목으로 보임). 서식 설정을 바꿨을 때만 서식 기록에 저장
    const header: ApprovalForm = { ...form, id: code, code, name, fields: legacy ? initialForm.fields : [] };
    const headerChanged = JSON.stringify(form) !== JSON.stringify(savedForm);
    try {
      setMsg({ kind: 'info', text: '저장 중…' });
      const res = await save.mutateAsync({
        form: header,
        sheet,
        baseVersion,
        link,
        note: note.trim() || undefined,
        user: { id: user.id, name: user.name },
        saveHeader: !legacy || headerChanged,
      });
      setSavedLink(link);
      setForm(header);
      setSavedForm(header);
      setSavedSheet(sheet);
      setBaseVersion(res.version);
      setNote('');
      setMsg({
        kind: 'ok',
        text:
          (res.created ? `저장했습니다 — v${res.version}` : `틀이 바뀌지 않아 서식 정보만 저장했습니다(v${res.version} 그대로).`) +
          (legacy && !applied ? " 아직 '시트로 기안'이 꺼져 있어 기안자는 기존 양식으로 씁니다 — 다 다듬으면 위에서 켜세요." : ''),
      });
      onSaved?.(code, res.version);
    } catch (err) {
      setMsg({ kind: 'err', text: `저장 실패: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // 시트 안에 있어서 문서 머리에서 빠지는 항목 — 편집 화면의 머리도 실제 문서처럼 뺀 모양으로
  const covered = useMemo(() => sheetHeaderItems(sheet), [sheet]);
  // 결재란까지 시트에 있으면 문서 머리 전체가 시트 안 — 머리 설정은 필요 없다
  const fullHeader = covered.includes('stampTable');
  const docForm = useMemo(() => withBodyHeader(form, covered), [form, covered]);

  // ── 부품 넣기(부품 목록 — 누르기·끌어 놓기) ──
  const putPart = (id: string, range: CellRange, toggle = false) => {
    const res = applyPart(sheet, range, id, toggle);
    if ('notice' in res) return setMsg({ kind: 'err', text: res.notice });
    setSheet(res);
    setSide('cell');
  };
  const onPartDrop = (e: React.DragEvent) => {
    const id = e.dataTransfer.getData(PART_MIME);
    if (!id) return;
    e.preventDefault();
    const at = (e.target as Element).closest?.('[data-cell]')?.getAttribute('data-cell');
    if (!at) return;
    const [r, c] = at.split(':').map(Number);
    const g = selection.range;
    // 고른 범위 안에 놓으면 범위 전체에, 아니면 놓은 칸에
    const inSel = r >= Math.min(g.r1, g.r2) && r <= Math.max(g.r1, g.r2) && c >= Math.min(g.c1, g.c2) && c <= Math.max(g.c1, g.c2);
    putPart(id, inSel ? g : { r1: r, r2: r, c1: c, c2: c });
  };

  // ── 칸 표시(편집 격자 안) ──
  const sections = useMemo(() => repeatSections(sheet), [sheet]);
  // 행 보이기 조건 표시용 — 조건 칸 이름 → 칸 왼쪽 글자(지출 항목)
  const condLabels = useMemo(() => new Map(conditionSources(sheet).map((x) => [x.name, x.label])), [sheet]);
  const badge = (r: number, c: number) => {
    if (markMode === 'off') return null;
    const p = approvalCellProps(sheet, r, c);
    // 반복 구간 — 첫 열 왼쪽에 보라색 띠, 첫 행에 이름
    const sec = c === 0 ? sections.find((x) => r >= x.first && r <= x.last) : undefined;
    const repeatMark = sec && (
      <>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-violet-500" />
        {r === sec.first && (
          <span title={`반복 구간: ${sec.label} (${sec.first + 1}~${sec.last + 1}행) — 기안자가 행을 추가·삭제`} className="pointer-events-none absolute left-1 top-0.5 rounded-sm bg-violet-500 px-1 text-[8.5px] font-bold leading-[13px] text-white">
            반복 · {sec.label}
          </span>
        )}
      </>
    );
    // 행 표시(대외 숨김·보이기 조건) — 마지막 열 오른쪽 아래에
    // 병합 칸이면 대표 칸(c)이 마지막 열이 아니어도 병합이 마지막 열까지 덮으면 그 칸에
    const lastCol = c + (sheet.merges.find((m) => m.startRow === r && m.startCol === c)?.colSpan ?? 1) - 1 === sheet.cols.length - 1;
    const ext = lastCol && isExternalHiddenRow(sheet, r);
    const cond = lastCol ? rowConditionOf(sheet, r) : undefined;
    const condText = cond && `${condLabels.get(cond.name) ?? nameLabel(cond.name)} = ${cond.values.map((v) => (v === CHECK_MARK ? '체크' : v)).join('·')}`;
    const extMark =
      ext || cond ? (
        <span className="pointer-events-none absolute bottom-0.5 right-0.5 flex gap-0.5">
          {cond && (
            <span
              title={`행 보이기 조건 — ${condText}일 때만 이 행이 보입니다(작성·결재·인쇄 모두)`}
              className="max-w-[220px] truncate rounded-sm bg-indigo-500/85 px-1 text-[8.5px] font-bold leading-[13px] text-white"
            >
              조건 · {condText}
            </span>
          )}
          {ext && (
            <span
              title="대외 문서에서 숨김 — 서식 '대외 문서'가 켜진 결재 완료 문서(거래처용)에서 이 행을 뺍니다"
              className="rounded-sm bg-slate-500/80 px-1 text-[8.5px] font-bold leading-[13px] text-white"
            >
              대외 숨김
            </span>
          )}
        </span>
      ) : null;
    const marks: { t: string; cls: string; title: string }[] = [];
    if (p.input) marks.push({ t: `입력·${INPUT_SHORT_LABELS[p.input.type] ?? ''}`, cls: 'bg-amber-400/90 text-white', title: '입력 칸 — 기안 화면에서 이 종류의 입력 도구가 뜹니다' });
    // 비어 있는 입력 칸에는 기안 화면에서 뜰 입력 도구 모양을 흐리게
    const col = sheet.cols[c];
    const emptyInput = p.input && col !== undefined && !sheet.rows[r]?.[col] && sheet.formulas[`${r}:${col}`] === undefined;
    // 자동 채우기(기안 정보) 칸 — 어떤 값이 들어갈지 흐리게
    const emptyCell = col !== undefined && !sheet.rows[r]?.[col] && sheet.formulas[`${r}:${col}`] === undefined;
    const autoLook =
      p.bind === 'doc.formTitle' ? (
        <span
          aria-hidden
          title="문서 이름 — 위 '격식 문서명'(비면 서식명)이 저절로 들어갑니다"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-1 text-sky-700/80"
        >
          <span>{form.docTitle || form.name || '문서 이름'}</span>
          <span className="mt-0.5 text-[10px] font-normal tracking-normal text-sky-600/80">격식 문서명(없다면 서식명)이 자동으로 들어갑니다</span>
        </span>
      ) : p.autoNo ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center px-1.5 text-[11px] italic text-sky-600/70">
          {`{자동번호 · 예 ${autoNumberPreview(p.autoNo)}}`}
        </span>
      ) : p.bind === 'doc.approvalLine' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 flex items-center justify-center rounded border-2 border-dashed border-indigo-300 bg-indigo-50/60 text-[11px] font-semibold text-indigo-500"
        >
          결재란 — 결재선에 따라 칸 수가 바뀝니다
        </span>
      ) : (p.bind?.startsWith('draft.') || p.bind?.startsWith('doc.')) && emptyCell ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center px-1.5 text-[11px] italic text-sky-600/70">
          {`{${bindLabel(p.bind).replace(/^.+? · /, '')}}`}
        </span>
      ) : null;
    const inputLook = autoLook ?? (emptyInput && p.input ? <InputLook input={p.input} quiet={markMode === 'simple'} /> : null);
    if (markMode === 'simple') {
      // 기안자가 쓰거나 고칠 수 있는 칸 — 잠그지 않은 입력 칸, 문서 항목(제목·보존연한·공개범위)
      const writable = (!!p.input && !p.lock && !p.bind) || isDocFieldBind(p.bind);
      // 못 고치는 칸 중 내용이 있는 칸만 표시(빈 여백 칸까지 칠하면 오히려 어지럽다)
      const fixed = !writable && (!emptyCell || !!p.bind || !!p.seal || !!p.autoNo);
      return simpleBadge(p, sec, ext, cond ? condText : undefined, inputLook, fixed);
    }
    if (p.name) marks.push({ t: nameLabel(p.name), cls: 'bg-teal text-white', title: '칸 이름' });
    if (p.bind) {
      const isDoc = p.bind.startsWith('doc.');
      marks.push({
        t: isDoc ? '문서' : p.bind.startsWith('draft.') ? '자동' : '프로젝트',
        cls: isDoc ? 'bg-indigo-500 text-white' : 'bg-sky-500 text-white',
        title: isDoc ? `문서 항목: ${bindLabel(p.bind)} — 기안자가 여기서 쓰고, 문서 자체에 저장` : `자동 채우기: ${bindLabel(p.bind)}`,
      });
    }
    if (p.lock) marks.push({ t: '잠금', cls: 'bg-ink3 text-white', title: '기안자 수정 잠금' });
    if (p.secret) marks.push({ t: '비공개', cls: 'bg-rose-500 text-white', title: '비공개' });
    if (p.seal) marks.push({ t: '직인', cls: 'bg-red-600 text-white', title: '회사 직인 자리' });
    if (p.required && p.input) marks.push({ t: '필수', cls: 'bg-rose-500 text-white', title: '필수 입력 — 비어 있으면 상신할 수 없음' });
    if (p.autoNo) marks.push({ t: '자동번호', cls: 'bg-sky-500 text-white', title: '자동번호 — 상신할 때 번호를 매김' });
    if (p.guide) marks.push({ t: '안내', cls: 'bg-ink3 text-white', title: '안내문 — 작성 화면에만 흐리게(결재·인쇄엔 안 나옴)' });
    if (p.input?.depends) marks.push({ t: '종속', cls: 'bg-indigo-500 text-white', title: `종속 선택 — '${condLabels.get(p.input.depends.name) ?? nameLabel(p.input.depends.name)}' 값에 따라 고를 항목이 바뀝니다` });
    if (!marks.length)
      return repeatMark || extMark ? (
        <>
          {repeatMark}
          {extMark}
        </>
      ) : null;
    return (
      <>
        {inputLook}
        {repeatMark}
        {extMark}
        <span className="pointer-events-none absolute right-0.5 top-0.5 flex gap-0.5">
          {marks.map((m) => (
            <span key={m.t} title={m.title} className={`rounded-sm px-1 text-[8.5px] font-bold leading-[13px] ${m.cls}`}>
              {m.t}
            </span>
          ))}
        </span>
      </>
    );
  };

  /**
   * 간단 표시 — 칸 내용을 가리지 않게.
   * 기안자가 못 고치는 칸(글자·수식·자동 채우기·잠근 칸): 옅은 빗금. 쓸 수 있는 칸은 서식 색 그대로. 빈 입력 칸엔 글 아닌 종류만 흐리게(금액·날짜 등).
   * 특별한 칸(필수·잠금·비공개·직인·칸 이름·종속·안내): 오른쪽 위 작은 아이콘 — 마우스를 올리면 설명.
   * 자동 채우기·문서 항목은 '{기안자}' 같은 흐린 글자로 이미 보이므로 따로 표시하지 않는다.
   * 행 표시(반복 구간·대외 숨김·보이기 조건): 아이콘으로(반복 구간 보라 띠는 그대로)
   */
  const simpleBadge = (
    p: ReturnType<typeof approvalCellProps>,
    sec: ReturnType<typeof repeatSections>[number] | undefined,
    ext: boolean,
    condText: string | undefined,
    inputLook: React.ReactNode,
    fixed: boolean,
  ) => {
    type Mark = { key: string; icon: React.ReactNode; cls: string; title: string };
    const ic = 'h-2.5 w-2.5';
    const icons: Mark[] = [];
    if (p.required && p.input) icons.push({ key: 'req', icon: <Asterisk className={ic} />, cls: 'text-rose-500', title: '필수 입력 — 비어 있으면 상신할 수 없음' });
    if (p.name) icons.push({ key: 'name', icon: <Tag className={ic} />, cls: 'text-teal', title: `칸 이름: ${nameLabel(p.name)}` });
    if (p.lock) icons.push({ key: 'lock', icon: <Lock className={ic} />, cls: 'text-ink3', title: '기안자 수정 잠금' });
    if (p.secret) icons.push({ key: 'secret', icon: <EyeOff className={ic} />, cls: 'text-rose-500', title: '비공개' });
    if (p.seal) icons.push({ key: 'seal', icon: <Stamp className={ic} />, cls: 'text-red-600', title: '회사 직인 자리' });
    if (p.input?.depends) {
      const dep = p.input.depends.name;
      icons.push({ key: 'dep', icon: <GitBranch className={ic} />, cls: 'text-indigo-500', title: `종속 선택 — '${condLabels.get(dep) ?? nameLabel(dep)}' 값에 따라 고를 항목이 바뀝니다` });
    }
    if (p.guide) icons.push({ key: 'guide', icon: <Info className={ic} />, cls: 'text-ink3', title: '안내문 — 작성 화면에만 흐리게(결재·인쇄엔 안 나옴)' });
    const rowIcons: Mark[] = [];
    if (condText) rowIcons.push({ key: 'cond', icon: <Filter className={ic} />, cls: 'text-indigo-500', title: `행 보이기 조건 — ${condText}일 때만 이 행이 보입니다(작성·결재·인쇄 모두)` });
    if (ext) rowIcons.push({ key: 'ext', icon: <EyeOff className={ic} />, cls: 'text-slate-500', title: "대외 문서에서 숨김 — 서식 '대외 문서'가 켜진 결재 완료 문서(거래처용)에서 이 행을 뺍니다" });
    const iconRow = (list: Mark[], pos: string) =>
      list.length ? (
        <span className={`pointer-events-none absolute ${pos} z-[1] flex gap-px rounded-sm bg-white/85 px-px`}>
          {list.map((m) => (
            // 아이콘에만 마우스 — 설명(title)이 뜨게. 누르면 칸 선택으로 이어진다
            <span key={m.key} title={m.title} className={`pointer-events-auto flex h-3 w-3 items-center justify-center ${m.cls}`}>
              {m.icon}
            </span>
          ))}
        </span>
      ) : null;
    return (
      <>
        {fixed && (
          // 기안자가 못 고치는 칸 — 옅은 빗금(회색 바탕은 표 제목 칸 색으로도 쓰여 구분이 안 되므로)
          <span
            aria-hidden
            title="기안자가 쓰거나 고칠 수 없는 칸"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(100,116,139,0.13) 0 1.5px, transparent 1.5px 6px)' }}
          />
        )}
        {inputLook}
        {/* 반복 구간 — 보라 띠만(첫 글자를 가리지 않게 아이콘은 두지 않음). 띠에 마우스를 올리면 구간 이름 */}
        {sec && (
          <span
            title={`반복 구간: ${sec.label} (${sec.first + 1}~${sec.last + 1}행) — 기안자가 행을 추가·삭제`}
            className="absolute inset-y-0 left-0 z-[1] w-[4px] bg-violet-500"
          />
        )}
        {iconRow(icons, 'right-0.5 top-0.5')}
        {iconRow(rowIcons, 'bottom-0.5 right-0.5')}
      </>
    );
  };

  // 열 때 — 맨 위부터 보이게(서식 목록에서 내려 둔 스크롤 자리가 남으면 긴 시트의 아래쪽부터 보인다).
  // 그리고 이 화면 동안 본문 상자(main)의 넘침 설정을 푼다 — 본문 상자는 실제로는 스크롤하지 않고(창이 스크롤) 넘침 설정만 있어,
  // 화면 위에 붙는 도구 막대·열 머리·옆 패널(sticky)이 그 상자 기준이 되어 페이지를 내려도 따라오지 않았다
  const rootRef = useRef<HTMLDivElement>(null);
  // 화면 위에 붙을 자리 — 창이 스크롤하면 앱 상단바·탭 막대 아래, 본문 상자가 스크롤하면 그 상자 맨 위
  const [stickTop, setStickTop] = useState(standalone ? 0 : APP_STICKY_TOP);
  // 편집하는 동안 앱 왼쪽 메뉴를 접는다(닫으면 원래대로) — 새 탭엔 메뉴가 없다
  useEffect(() => {
    if (standalone) return;
    requestSidebarCollapse(true);
    return () => requestSidebarCollapse(false);
  }, [standalone]);
  // 화면 폭에 따라 배치 — three: 부품(왼쪽)·문서·설정(오른쪽) / compact: 부품을 아이콘 막대로 / two: 부품도 오른쪽 패널 안에 / stack: 위아래로
  // 쓸 수 있는 폭은 창 기준으로 잰다 — 앱 바탕이 내용 폭에 맞춰 늘어나므로(min-w-fit) 이 상자 폭을 재면 늘 '다 들어감'이 된다
  const [rootW, setRootW] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1; // 화면 배율(body zoom)
      setRootW(Math.floor((window.innerWidth - rect.left) / (scale || 1)) - 24); // 오른쪽 여백·스크롤 막대
    };
    measure();
    // 왼쪽 메뉴가 접히는 움직임(0.2초)이 끝난 뒤 한 번 더
    const t = window.setTimeout(measure, 350);
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    const main = rootRef.current?.closest('main');
    window.scrollTo({ top: 0 });
    if (!main) {
      setStickTop(0); // 앱 틀 밖(새 탭) — 화면 맨 위에 붙는다
      return;
    }
    main.scrollTop = 0;
    if (main.scrollHeight > main.clientHeight + 1) {
      setStickTop(0); // 본문 상자가 정말 스크롤하는 화면이면 그대로(그 상자 맨 위에 붙는다)
      return;
    }
    const prev = main.style.overflow;
    main.style.overflow = 'visible';
    return () => {
      main.style.overflow = prev;
    };
  }, []);

  const GAP = 12;
  // 새 탭(엑셀처럼) — 편집기가 남는 폭을 다 쓰고 안에서 스크롤하므로, 편집기 최소 폭만 있으면 된다
  const needEditor = standalone ? 720 : editorWidth;
  const layout: 'three' | 'compact' | 'two' | 'stack' =
    rootW === 0 || rootW >= needEditor + PALETTE_W + SIDE_W + GAP * 2
      ? 'three'
      : rootW >= needEditor + PALETTE_ICONS_W + SIDE_W + GAP * 2
        ? 'compact'
        : rootW >= needEditor + SIDE_MIN_W + GAP
          ? 'two'
          : 'stack';
  // 새 탭 — 편집기가 남는 폭을 다 쓴다(높이는 앱 안과 같이: 문서는 아래로 펼치고 페이지가 스크롤, 도구 막대·열 머리·옆 막대는 위에 붙음)
  const fill = standalone && layout !== 'stack';
  // 화면에 붙는 옆 막대(부품·설정) — 앱 상단바·탭 막대 바로 아래, 화면 높이를 넘지 않게(넘치면 안에서만 스크롤). 화면 높이는 글자 크기 배율(body zoom)로 나눈다
  const stickyStyle = layout === 'stack' ? undefined : { top: stickTop + 8, maxHeight: `calc(100vh / var(--font-scale, 1) - ${stickTop + 16}px)` };

  const msgCls =
    msg?.kind === 'err'
      ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
      : msg?.kind === 'info'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        : 'border-teal/30 bg-teal-soft/70 text-teal';

  return (
    <div ref={rootRef} className={standalone ? 'space-y-2' : 'space-y-3'}>
      {/* 머리 */}
      <div className={`flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel shadow-xs ${standalone ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={close}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-bold text-ink2 hover:text-ink cursor-pointer"
          >
            {standalone ? <X className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{standalone ? '탭 닫기' : '서식 목록'}</span>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-ink">{isNew ? '새 시트 서식' : form.name}</span>
              <span className="rounded bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-600">{legacy ? '기존 양식 + 시트' : '시트'}</span>
              {baseVersion !== null && <span className="rounded bg-teal-soft px-1.5 font-mono text-[10px] font-bold text-teal">v{baseVersion}</span>}
              {dirty && <span className="text-[10.5px] font-bold text-amber-600">저장 안 됨</span>}
            </div>
            <span className={`text-[10.5px] text-ink3 ${standalone ? 'hidden' : ''}`}>
              {legacy
                ? "기존 서식에 시트 틀을 붙입니다 — 서식 코드·항목 목록은 그대로라 옛 문서는 지금 모습, 결재선 규칙·권한도 그대로. '시트로 기안'을 켜면 새 기안부터 시트로"
                : "엑셀처럼 틀을 만들고, 기안자가 쓸 칸을 '입력 칸'으로 정합니다 · 사용을 켜면 기안 서식 목록에 나옵니다"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {legacy && (
            <>
              {onOpenLegacy && (
                <button
                  type="button"
                  onClick={() => {
                    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 기존 양식 편집으로 갈까요?')) return;
                    onOpenLegacy();
                  }}
                  title="시트를 켜기 전까지 기안자가 쓰는 기존 양식(항목 목록) 편집"
                  className="rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink"
                >
                  기존 양식 편집
                </button>
              )}
              {baseVersion !== null && (
                // 붙여 둔 시트를 버리고 기존 양식에서 다시 변환 — 저장해야 새 버전으로 쌓인다(옛 버전·그 버전으로 쓴 문서는 그대로)
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !confirm(
                        "지금 시트를 버리고 기존 양식에서 다시 만듭니다(최신 변환 규칙). 손본 모양·수식은 사라집니다.\n저장해야 새 버전이 되고, 저장하지 않고 닫으면 지금 시트 그대로 남습니다. 계속할까요?"
                      )
                    )
                      return;
                    const res = legacyFormToSheet(initialForm);
                    setSheet(res.sheet);
                    setLink(res.link);
                    setNote('기존 양식에서 다시 만듦');
                    setMsg({ kind: 'info', text: '기존 양식에서 다시 만들었습니다 — 모양을 다듬고 [미리보기]로 확인한 뒤 저장하세요.', list: res.warnings });
                  }}
                  title="붙여 둔 시트를 버리고 기존 양식에서 다시 변환(저장 전까지는 바뀌지 않음)"
                  className="rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink"
                >
                  기존 양식에서 다시 만들기
                </button>
              )}
              <button
                type="button"
                disabled={setSwitch.isPending || (!applied && baseVersion === null)}
                onClick={() => {
                  if (!user) return;
                  if (!applied) {
                    if (dirty) return setMsg({ kind: 'err', text: '저장하지 않은 변경이 있습니다 — 먼저 [서식 저장]을 누른 뒤 켜세요.' });
                    if (!confirm(`지금부터 '${form.name}' 새 기안은 시트(v${baseVersion})로 작성됩니다. 이미 쓴 문서는 그대로입니다. 켤까요?`)) return;
                  } else if (!confirm(`'${form.name}' 새 기안을 다시 기존 양식으로 받습니다(시트 틀은 그대로 남음). 끌까요?`)) return;
                  setSwitch.mutate(
                    { formId: form.id, applied: !applied, user: { id: user.id, name: user.name } },
                    {
                      onSuccess: () => setMsg({ kind: 'ok', text: !applied ? '시트로 기안을 켰습니다 — 새 기안부터 시트로 작성됩니다.' : '시트로 기안을 껐습니다 — 새 기안은 기존 양식으로 작성됩니다.' }),
                      onError: (e) => setMsg({ kind: 'err', text: `바꾸지 못했습니다: ${e instanceof Error ? e.message : String(e)}` }),
                    }
                  );
                }}
                title={baseVersion === null ? '시트 틀을 한 번 저장한 뒤 켤 수 있습니다' : '켜면 새 기안부터 시트로, 끄면 기존 양식으로'}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${
                  applied ? 'border-teal bg-teal-soft text-teal' : 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${applied ? 'bg-teal' : 'bg-amber-500'}`} />
                시트로 기안 {applied ? '켜짐' : '꺼짐'}
              </button>
            </>
          )}
          <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-ink2" title="켜면 기안 서식 목록에 나옵니다">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} className="h-3.5 w-3.5 accent-teal" />
            <span>사용</span>
          </label>
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>엑셀 불러오기</span>
          </button>
          <button
            type="button"
            onClick={() => setPreview({ sheet, title: '지금 편집 중인 틀' })}
            title="지금 편집 중인 서식을 기안 화면·결재 화면 그대로 열어 봅니다(입력해 봐도 저장되지 않음)"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>미리보기</span>
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={save.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-teal px-4 py-1.5 text-[12px] font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{save.isPending ? '저장 중…' : '서식 저장'}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className={`shrink-0 rounded-lg border px-4 py-2.5 text-[12px] font-bold ${msgCls}`}>
          <div className="flex items-start justify-between gap-3">
            <span>{msg.text}</span>
            <button type="button" onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100" aria-label="닫기">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {msg.list && msg.list.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11.5px] font-medium">
              {msg.list.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <InfoBlock collapsible={standalone} defaultOpen={isNew}>
      {/* 서식 정보 */}
      <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-panel p-3 md:grid-cols-[70px_1fr_1fr_1fr_1fr_1fr_1.4fr]">
        <Field label="아이콘">
          <input className={inp} value={form.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="📄" />
        </Field>
        <Field label="서식명">
          <input className={inp} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="발주서" />
        </Field>
        <Field label="서식 코드">
          {isNew && !codeManual ? (
            // 코드는 서식명에서 저절로 — 연동·결재선 규칙이 쓰는 내부 이름이라 보통은 몰라도 된다
            <div className="flex items-center gap-1.5 py-1.5 text-[11.5px] text-ink3">
              <span className="truncate" title="서식명에서 저절로 정합니다. 저장하면 바꿀 수 없습니다.">
                자동{form.name.trim() ? ` (${autoCode})` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  set({ code: autoCode });
                  setCodeManual(true);
                }}
                className="shrink-0 font-semibold text-teal hover:underline"
              >
                직접 정하기
              </button>
            </div>
          ) : (
            <input
              className={inp}
              value={form.code}
              disabled={!isNew}
              onChange={(e) => set({ code: e.target.value })}
              title={isNew ? '연동·결재선 규칙이 쓰는 내부 이름 — 저장하면 바꿀 수 없습니다' : '저장 후 고정'}
            />
          )}
        </Field>
        <Field label="격식 문서명">
          <input className={inp} value={form.docTitle} onChange={(e) => set({ docTitle: e.target.value })} placeholder="발 주 서" />
        </Field>
        <Field label="소속 폴더">
          <select className={inp} value={form.folderId ?? ''} onChange={(e) => set({ folderId: e.target.value || null })}>
            <option value="">루트 (미지정)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="연동 기능">
          <select
            className={inp}
            value={link ?? ''}
            onChange={(e) => setLink(e.target.value || null)}
            title="이 서식으로 쓴 문서가 고른 기능(휴가 차감·근태·캘린더)과 이어지고, 그 기능의 결재선 규칙도 걸립니다. 고르면 칸 이름 목록에 연동 칸(휴가 기간 등)이 나옵니다."
          >
            <option value="">없음 (일반 결재 서식)</option>
            {LINK_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.feature}
              </option>
            ))}
          </select>
        </Field>
        <Field label="이번 저장 메모 (버전 기록에 남음)">
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 품목 표 열 추가" maxLength={255} />
        </Field>
      </div>

      {/* 문서 머리 항목 — 기존 서식과 같은 설정(hiddenHeaderItems). 시트 위·아래에 붙는 머리·맺음말 중 보일 것 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-panel px-3 py-2 text-[11.5px]">
        <span className="font-semibold text-ink2" title="기안·결재·인쇄 화면에서 시트 위(로고·제목·문서 정보)와 아래(맺음말·서명)에 붙는 항목">
          문서 머리에 보일 항목
        </span>
        {fullHeader ? (
          <span className="text-ink3">문서 머리 전체(로고·큰 제목·결재란·문서 정보·맺음말)가 시트 안에 있습니다 — 위치·모양은 시트에서 바꿉니다.</span>
        ) : HEADER_ITEMS.map((item) => {
          const shown = !(form.hiddenHeaderItems ?? []).includes(item);
          // 시트 안에 같은 칸(기안자·문서번호 등)이 있으면 머리에서 저절로 빠진다
          const inSheet = covered.includes(item);
          return (
            <label
              key={item}
              className={`flex items-center gap-1 ${inSheet ? 'cursor-default text-ink3 line-through decoration-ink3/50' : 'cursor-pointer text-ink2'}`}
              title={inSheet ? '시트 안에 같은 칸이 있어 문서 머리에서는 저절로 빠집니다' : undefined}
            >
              <input
                type="checkbox"
                checked={shown && !inSheet}
                disabled={inSheet}
                onChange={(e) => {
                  const hidden = new Set(form.hiddenHeaderItems ?? []);
                  if (e.target.checked) hidden.delete(item);
                  else hidden.add(item);
                  set({ hiddenHeaderItems: [...hidden] });
                }}
                className="h-3 w-3 accent-teal"
              />
              {HEADER_ITEM_LABEL[item]}
            </label>
          );
        })}
        {!fullHeader && covered.includes('titleRow') && (
          <span className="text-ink3 line-through decoration-ink3/50" title="시트 안에 제목 칸이 있어 문서 머리의 제목 줄은 저절로 빠집니다">
            제목 줄
          </span>
        )}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <label
          className="flex cursor-pointer items-center gap-1 font-semibold text-ink2"
          title="결재가 끝난 문서는 거래처에 보낼 모양으로 — 상단 바·문서 정보·제목·결재란·첨부·맺음말과, 시트에서 '대외 문서에서 숨김' 행을 뺍니다(발주서 PDF와 같은 모양)"
        >
          <input type="checkbox" checked={!!form.hideDocInfoOnComplete} onChange={(e) => set({ hideDocInfoOnComplete: e.target.checked })} className="h-3 w-3 accent-teal" />
          대외 문서
        </label>
      </div>
      </InfoBlock>

      {/* 편집기 + 옆 패널 */}
      {/* 편집기는 문서(A4 세로) 폭에 맞춘 폭만 — 넓은 화면에서 빈 공간이 생기지 않게 옆 패널을 바로 붙인다 */}
      <div className={`flex gap-3 ${layout === 'stack' ? 'flex-col' : fill ? 'items-start gap-2' : 'items-start'}`}>
        {(layout === 'three' || layout === 'compact') && (
          // 부품 — 편집기 왼쪽(끌어다 놓기 거리가 짧고, 오른쪽 설정 패널이 짧아진다)
          <div
            className={`shrink-0 overflow-y-auto rounded-xl border border-border bg-panel p-2 sticky`}
            style={{ ...stickyStyle, width: layout === 'three' ? PALETTE_W : PALETTE_ICONS_W }}
          >
            {layout === 'three' && <div className="mb-1 text-[12.5px] font-extrabold text-ink">부품</div>}
            <SheetPalette sheet={sheet} selection={selection} onApply={putPart} variant={layout === 'three' ? 'side' : 'icons'} />
          </div>
        )}
        <div
          className={`min-w-0 rounded-xl border border-border bg-panel p-2 ${layout === 'stack' ? 'w-full' : fill ? 'flex-1' : 'flex-none'}`}
          style={layout === 'stack' || fill ? undefined : { width: editorWidth, maxWidth: '100%' }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(PART_MIME)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={onPartDrop}
        >
          {user && view === 'grid' && !fullHeader && (
            <details open className="mb-2 rounded-lg bg-[#878d90] px-3 pb-3 pt-1.5 [&[open]>summary]:mb-2">
              <summary className="cursor-pointer select-none text-[11px] font-semibold text-white/90">
                문서 머리 — 기안·결재·인쇄 화면에서 시트 위에 붙는 부분(위 '문서 머리에 보일 항목'으로 켜고 끔)
              </summary>
              <DocFrame form={docForm} me={user} only="header" />
            </details>
          )}
          <SheetEditor
            value={sheet}
            onChange={setSheet}
            normalize={healRepeatSections}
            mode="design"
            // 왼쪽 위 칸이 기준 — 가려지는 칸의 부품(입력 칸 등)은 뺀다. 칸 이름·불러오기·직인·자동번호가 빠지면 먼저 묻는다
            mergeCells={(s, range) => {
              if (mergeCoversLinks(s, range) && !confirm('가려지는 칸에 연결된 부품(칸 이름·불러오기·직인·자동번호)이 있습니다. 병합하면 그 연결이 빠집니다. 병합할까요?')) return s;
              if (mergeDropsContent(s, range) && !confirm('병합하면 왼쪽 위 칸만 남고 다른 칸의 글자는 지워집니다. 병합할까요?')) return s;
              return mergeApprovalRange(s, range);
            }}
            canDeleteRow={(s, r) => !isStructureLocked(s, 'row', r)}
            canDeleteCol={(s, c) => !isStructureLocked(s, 'col', c)}
            setValue={setApprovalCellValue}
            renderBadge={badge}
            onSelect={setSelection}
            onNotice={(text) => setMsg({ kind: 'err', text })}
            guideWidth={SHEET_PAGE_WIDTH}
            // 화면 높이에 맞춤 — 글자 크기 배율(body zoom)로 나눠야 실제 화면 높이(안 그러면 페이지 전체를 위아래로 스크롤해야 함)
            // 문서는 아래로 펼치고 페이지가 스크롤 — 도구 막대·열 머리는 화면 위에 붙어 따라온다
            height="auto"
            stickyTop={stickTop}
            paper={user && view === 'paper' ? (table) => <DocFrame form={docForm} me={user} interactive body={table} paperWidth={sheetWidth + PAPER_PAD > 800 ? sheetWidth + PAPER_PAD : undefined} /> : undefined}
            toolbarExtra={
              <>
              <button
                type="button"
                onClick={() => {
                  if (covered.length > 0 && !confirm('시트에 이미 문서 머리 칸(결재란·기안자·문서번호·제목 등)이 있습니다. 그래도 문서 머리를 하나 더 넣을까요?')) return;
                  setSheet(insertDocHeader(sheet, { formTitle: true, closing: form.closing || undefined }));
                  setMsg({
                    kind: 'ok',
                    text: '맨 위에 회사 로고·큰 제목/결재란·문서 정보 표를, 맨 아래에 맺음말·기안일·기안자 서명을 넣었습니다 — 시트 밖 문서 머리는 저절로 빠집니다. 큰 제목에는 격식 문서명(없으면 서식명)이 저절로 들어갑니다 — 엑셀 제목과 겹치면 한쪽을 지우세요. 색·위치는 서식에 맞게 바꾸세요(Ctrl+Z 로 되돌리기).',
                  });
                }}
                title="문서 머리 전체를 시트 안으로 — 위: 회사 로고·큰 제목·결재란·문서 정보 표, 아래: 맺음말·기안일·기안자 서명(대외 문서에서는 숨김)"
                className="h-7 rounded-md border border-border bg-white px-2 text-[11.5px] font-semibold text-ink2 hover:border-teal hover:text-teal"
              >
                문서 머리 넣기
              </button>
              <div className="flex rounded-md border border-border bg-white p-0.5 text-[11px] font-semibold" title="문서 보기: 실제 문서 모양 그대로 편집 · 격자 보기: 엑셀처럼 A·B·C 머리와 함께">
                {(
                  [
                    ['paper', '문서 보기'],
                    ['grid', '격자 보기'],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => changeView(k)} className={`rounded px-2 py-0.5 ${view === k ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center rounded-md border border-border bg-white p-0.5 text-[11px] font-semibold" title="칸 표시 — 간단: 기안자가 못 고치는 칸만 옅은 빗금, 특별한 칸은 작은 아이콘 · 자세히: 모든 표시를 글자로 · 끔: 표시 없이 엑셀처럼">
                <span className="px-1 text-ink3">표시</span>
                {(
                  [
                    ['simple', '간단'],
                    ['detail', '자세히'],
                    ['off', '끔'],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => changeMarks(k)} className={`rounded px-2 py-0.5 ${markMode === k ? 'bg-teal text-white' : 'text-ink3 hover:text-ink'}`}>
                    {label}
                  </button>
                ))}
              </div>
              </>
            }
          />
          <div className="space-y-0.5 px-1 pt-1.5 text-[10.5px] text-ink3">
            {pageScale < 1 && (
              <div className="font-semibold text-amber-700 dark:text-amber-400">
                A4 세로 폭보다 넓어(전체 {sheetWidth}px) 문서·인쇄에서는 약 {Math.round(pageScale * 100)}%로 줄여 한 쪽 폭에 맞춥니다 — 엑셀의 '한 페이지에 맞춤'과 같습니다. 글씨가 너무 작으면 열 너비를 줄여 주세요.
              </div>
            )}
            <div>
              {view === 'paper'
                ? `문서 보기 — 기안·결재·인쇄 화면과 같은 모양입니다${fullHeader ? '' : "(시트 밖 문서 머리는 위 '문서 머리에 보일 항목'으로 켜고 끔)"}. 시트 왼쪽·위의 가는 띠를 누르면 행·열을 고르고, 띠 끝을 끌면 크기가 바뀝니다.`
                : '세로 점선 = A4 세로 인쇄 폭.'}{' '}
              칸 이름·프로젝트 값·비공개·직인이 든 행·열은 그 속성을 먼저 지워야 지울 수 있습니다. 보라색 띠 = 반복 구간(기안자가 행 추가·삭제).</div>
          </div>
        </div>

        {/* 화면에 붙어 있고 안에서만 스크롤 — 시트를 내려 봐도 패널은 그 자리에. 높이는 글자 크기 배율(body zoom)로 나눠야 화면 높이와 맞는다 */}
        <div
          className={`rounded-xl border border-border bg-panel p-3 ${layout === 'stack' ? 'w-full' : 'sticky min-w-0 shrink overflow-y-auto'}`}
          style={layout === 'stack' ? undefined : { ...stickyStyle, width: SIDE_W, minWidth: SIDE_MIN_W }}
        >
          <div className="mb-3 flex rounded-lg border border-border bg-panel-alt p-0.5 text-[11.5px]">
            {(
              [
                ['cell', '칸 속성'],
                ['settings', '서식 설정'],
                ['history', '버전 기록'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSide(k)}
                className={`flex-1 rounded-md py-1.5 font-bold ${side === k ? 'bg-panel text-teal shadow-xs' : 'text-ink3 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {side === 'cell' ? (
            <>
              {(layout === 'two' || layout === 'stack') && (
              <details open className="group mb-3 border-b border-border pb-3">
                <summary className="mb-1 flex cursor-pointer list-none items-center justify-between text-[12.5px] font-extrabold text-ink">
                  부품
                  <span className="text-[10.5px] font-semibold text-ink3 group-open:hidden">펼치기 ▾</span>
                  <span className="hidden text-[10.5px] font-semibold text-ink3 group-open:inline">접기 ▴</span>
                </summary>
                <SheetPalette sheet={sheet} selection={selection} onApply={putPart} />
              </details>
              )}
              <SheetCellPanel sheet={sheet} selection={selection} onChange={setSheet} link={link} external={!!form.hideDocInfoOnComplete} />
            </>
          ) : side === 'settings' ? (
            <SheetFormSettings form={form} onChange={set} />
          ) : (
            <VersionHistory
              formId={isNew ? null : form.id}
              current={baseVersion}
              onPreview={(s, v) => setPreview({ sheet: s, title: `v${v}` })}
              onLoad={(s, v) => {
                if (!confirm(`v${v}의 틀을 편집기로 가져옵니다. 저장하면 새 버전이 됩니다(이전 버전은 그대로 남음). 계속할까요?`)) return;
                setSheet(s);
                setNote(`v${v}에서 되살림`);
                setSide('cell');
              }}
            />
          )}
        </div>
      </div>

      {preview && <PreviewModal form={form} sheet={preview.sheet} title={preview.title} link={link} onClose={() => setPreview(null)} />}
    </div>
  );
}

/** 서식 정보·문서 머리 항목 — 새 탭에서는 접어 두는 띠(새 서식은 펼쳐서), 앱 안에서는 그대로 */
function InfoBlock({ collapsible, defaultOpen, children }: { collapsible: boolean; defaultOpen: boolean; children: React.ReactNode }) {
  if (!collapsible) return <>{children}</>;
  return (
    <details open={defaultOpen} className="group shrink-0 rounded-xl border border-border bg-panel [&[open]>summary]:border-b [&[open]>summary]:border-border">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold text-ink2 hover:text-ink">
        <span className="text-ink3 group-open:rotate-90">▸</span>
        서식 정보 · 문서 머리 항목
        <span className="font-normal text-ink3">(서식명·코드·격식 문서명·폴더·연동·저장 메모·대외 문서)</span>
      </summary>
      <div className="space-y-2 p-2 [&>div]:border-0 [&>div]:shadow-none">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block truncate text-[10.5px] font-semibold text-ink3">{label}</span>
      {children}
    </label>
  );
}

function VersionHistory({
  formId,
  current,
  onPreview,
  onLoad,
}: {
  formId: string | null;
  current: number | null;
  onPreview: (s: Sheet, v: number) => void;
  onLoad: (s: Sheet, v: number) => void;
}) {
  const { data: versions = [], isLoading } = useFormVersionList(formId);
  const [picked, setPicked] = useState<number | null>(null);
  const { data: pickedSheet, isFetching } = useFormVersionSheet(formId, picked);
  const fmt = useMemo(() => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }), []);

  if (!formId) return <div className="text-[11.5px] text-ink3">처음 저장하면 v1 이 생깁니다. 이후 틀을 바꿔 저장할 때마다 버전이 하나씩 쌓입니다.</div>;
  if (isLoading) return <div className="text-[11.5px] text-ink3">불러오는 중…</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-ink3">
        <History className="h-3.5 w-3.5" />
        <span>저장할 때마다 쌓이며 고치거나 지우지 않습니다. 문서는 쓸 때의 버전 모양으로 보입니다.</span>
      </div>
      <ul className="max-h-[calc(100vh-380px)] space-y-1.5 overflow-y-auto">
        {versions.map((v) => (
          <li key={v.version} className={`rounded-lg border px-2.5 py-2 ${picked === v.version ? 'border-teal bg-teal-soft/40' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] font-bold text-ink">
                v{v.version}
                {v.version === current && <span className="ml-1.5 rounded bg-teal px-1 text-[9px] text-white">최신</span>}
              </span>
              <span className="text-[10.5px] text-ink3">{fmt.format(new Date(v.createdAt))}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-ink2">{v.createdByName ?? v.createdBy}</div>
            {v.note && <div className="mt-0.5 text-[11px] text-ink3">{v.note}</div>}
            <div className="mt-1.5 flex gap-1.5">
              {picked === v.version && pickedSheet ? (
                <>
                  <button type="button" onClick={() => onPreview(pickedSheet.sheet, v.version)} className="rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold text-ink2 hover:text-ink">
                    미리보기
                  </button>
                  {v.version !== current && (
                    <button type="button" onClick={() => onLoad(pickedSheet.sheet, v.version)} className="rounded border border-teal/40 px-2 py-0.5 text-[10.5px] font-semibold text-teal hover:bg-teal-soft">
                      이 버전으로 되살리기
                    </button>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => setPicked(v.version)} className="rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold text-ink2 hover:text-ink">
                  {picked === v.version && isFetching ? '읽는 중…' : '열기'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 미리보기 — 편집 중인 틀을 실제 문서 그대로 연다(입력해 봐도 저장 안 함).
 * - 작성 화면: 기안 화면과 같은 부품(SheetDraftForm) — 입력 도구·숫자 칸·수식·반복 구간 행 추가
 * - 결재·인쇄 화면: 문서 보기 부품(SheetDocView) — 작성 탭에서 넣은 값이 결재자·인쇄에 어떻게 보이는지(직인·기안 정보 포함)
 * 두 탭 모두 문서 머리·첨부·맺음말까지 문서 전체(DocFrame)
 */
function PreviewModal({ form, sheet, title, link, onClose }: { form: ApprovalForm; sheet: Sheet; title: string; link: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<'draft' | 'view' | 'external'>('draft');
  const [values, setValues] = useState<Record<string, string>>({});
  // 문서 항목 칸(제목·보존연한·공개범위) — 기안 화면에선 문서 머리와 같은 값
  const [docFields, setDocFields] = useState<DocFields>({ title: '', preservationPeriod: form.preservationPeriod || '5년', visibility: '부서' });
  const docForm = withBodyHeader(form, sheetHeaderItems(sheet));
  const [issues, setIssues] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const { data: holidays = [] } = useHolidays();
  const { user } = useAuth();
  // 열 때 한 번만 초점(Esc 로 닫기) — 그릴 때마다 초점을 가져오면 칸 입력이 끊긴다
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => boxRef.current?.focus(), []);
  const info = {
    drafter: user ? [user.name, user.position].filter(Boolean).join(' ') : '홍길동 사원',
    dept: user?.dept ?? '기획팀',
    date: korDateText(new Date()),
    formTitle: form.docTitle || form.name,
  };
  const draftBody = (slots: SheetSlots) => (
    <SheetDraftForm
      slots={slots}
      formId="미리보기"
      version={1}
      template={sheet}
      link={link}
      systemValues={(l, linked) => linkSystemValues(l, linked, holidays)}
      draftInfo={{ ...info, docNo: '(작성 완료 시 자동 발번)', completedDate: '' }}
      docFields={docFields}
      onDocField={(p) => setDocFields((d) => ({ ...d, ...p }))}
      values={values}
      onFields={(f) => setValues((v) => ({ ...v, ...f }))}
      onIssues={setIssues}
      onRequired={setMissing}
    />
  );
  const viewBody = (slots?: SheetSlots) => (
    <SheetDocView
      slots={slots}
      template={sheet}
      fieldValues={{ ...values, __formVersion: '미리보기@v1' }}
      masked={false}
      stamped
      external={tab === 'external'}
      docInfo={{
        ...info,
        docNo: 'AP-미리보기',
        // 결재·인쇄 화면 미리보기는 결재가 끝난 모양(직인도 찍힘)
        completedDate: korDateText(new Date()),
        title: docFields.title,
        preservation: docFields.preservationPeriod,
        visibility: VISIBILITY_LABEL[docFields.visibility] ?? docFields.visibility,
      }}
    />
  );
  const tabCls = (on: boolean) => `rounded-md px-3 py-1 text-[12px] font-bold ${on ? 'bg-panel text-teal shadow-xs' : 'text-ink3 hover:text-ink'}`;
  // 창 바깥을 누르면 닫는다 — 창 안에서 누른 채 바깥으로 끌어 놓은 경우(글자 고르기)는 닫지 않게, 누른 곳과 뗀 곳이 모두 바깥일 때만
  const downOutside = useRef(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      onMouseDown={(e) => (downOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOutside.current && e.target === e.currentTarget) onClose();
        downOutside.current = false;
      }}
      tabIndex={-1}
      ref={boxRef}
    >
      {/* 위 막대는 늘 보이고 문서만 창 안에서 스크롤 — 높이는 화면 배율(body zoom)로 나눠 실제 화면에 맞춘다 */}
      <div className="flex max-h-[calc(100vh/var(--font-scale,1)-48px)] w-full max-w-[880px] flex-col overflow-hidden rounded-xl bg-panel shadow-2xl">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-[13px] font-bold text-ink">미리보기 — {title}</div>
            <div className="text-[11px] text-ink3">실제 문서 그대로입니다. 작성 화면에서 입력해 보고 결재·인쇄 화면으로 확인하세요(저장되지 않음).</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-panel-alt p-0.5">
              <button type="button" className={tabCls(tab === 'draft')} onClick={() => setTab('draft')}>
                작성 화면
              </button>
              <button type="button" className={tabCls(tab === 'view')} onClick={() => setTab('view')}>
                결재·인쇄 화면
              </button>
              {form.hideDocInfoOnComplete && (
                <button type="button" className={tabCls(tab === 'external')} onClick={() => setTab('external')} title="결재가 끝난 뒤 거래처에 보낼 모양(발주서 PDF와 같음)">
                  대외 문서
                </button>
              )}
            </div>
            <button type="button" onClick={() => setValues({})} className="rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-ink2 hover:text-ink">
              입력 지우기
            </button>
            <button type="button" onClick={onClose} className="rounded p-1 text-ink3 hover:bg-panel-alt" aria-label="닫기">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        <div className="bg-[#878d90] p-4">
          {user ? (
            tab === 'external' ? (
              // 대외 문서 — 문서 머리·결재란·첨부·맺음말 없이 시트만(숨김 행 뺌)
              <div className="mx-auto w-full max-w-[800px] bg-white px-8 py-7">{viewBody()}</div>
            ) : (
              <DocFrame form={docForm} me={user} interactive={tab === 'draft'} body={tab === 'draft' ? draftBody : viewBody} />
            )
          ) : (
            <div className="mx-auto w-full max-w-[800px] bg-white px-8 py-7">{tab === 'draft' ? draftBody({}) : viewBody()}</div>
          )}
        </div>
        {tab === 'draft' && missing.length > 0 && <div className="mt-2 text-[11.5px] font-semibold text-rose-600">상신하면 막히는 칸: 비어 있는 필수 칸 — {missing.join(', ')}</div>}
        {tab === 'draft' && issues.length > 0 && <div className="mt-2 text-[11.5px] font-semibold text-rose-600">상신하면 막히는 칸: 숫자 칸에 숫자가 아닌 값 — {issues.join(', ')}</div>}
        {tab === 'view' && <div className="mt-2 text-[10.5px] text-ink3">결재 완료 모양(직인 칸엔 회사 직인) · 넓은 시트는 종이 폭에 맞춰 줄여 보입니다.</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * 문서 틀 — 기안 화면과 같은 문서 부품(ApprovalDraftDocumentSheet)을 보기 전용으로 그린다.
 * only='header' 면 머리(로고·제목·결재란·문서 정보·제목 줄)만, 아니면 body(시트)를 끼운 문서 전체.
 */
function DocFrame({
  form,
  me,
  only,
  body,
  interactive = false,
  paperWidth,
}: {
  form: ApprovalForm;
  me: User;
  only?: 'header';
  /** 본문(시트) — 함수면 결재란·로고·기안자 서명(SheetSlots)을 받아 칸에 넣는다 */
  body?: React.ReactNode | ((slots: SheetSlots) => React.ReactNode);
  interactive?: boolean;
  /** 종이 폭 — 편집 중엔 넓은 시트가 종이 밖으로 나가지 않게 넓힌다(문서·인쇄에선 줄여 맞춤) */
  paperWidth?: number;
}) {
  const noop = () => {};
  // 결재란이 어떻게 보이는지 — 예시 결재선(나 한 명)
  const sampleSteps: ApprovalStep[] = [
    { seq: 1, parallelGroup: null, executionType: 'sequential', kind: '결재', approverId: me.id, delegatedFromId: null, decision: '대기', decidedAt: null, comment: '' },
  ];
  return (
    // 머리·첨부 등은 보기만(실제 동작 안 함). 작성 화면 미리보기는 시트 부분만 입력할 수 있게 연다
    <div className="pointer-events-none select-none">
      <ApprovalDraftDocumentSheet
        // 본문은 시트 — 기존 서식에 붙인 경우에도 기존 항목은 그리지 않는다
        form={{ ...form, fields: [] }}
        docCode={form.code || '기안'}
        me={me}
        title={form.name ? `${form.name} 제목 예시` : '문서 제목'}
        setTitle={noop}
        values={{}}
        setVals={noop}
        amount=""
        setAmount={noop}
        securityLevel={form.securityLevel || '일반'}
        setSecurityLevel={noop}
        visibility={form.visibility === '비공개' ? '비공개' : '부서'}
        setVisibility={noop}
        preservationPeriod={form.preservationPeriod || '5년'}
        setPreservationPeriod={noop}
        isPostApproval={false}
        setIsPostApproval={noop}
        isPostApprovalSystemEnabled={false}
        postApprovedBy=""
        setPostApprovedBy={noop}
        postApprovalActionTaken=""
        setPostApprovalActionTaken={noop}
        postApprovalNecessity=""
        setPostApprovalNecessity={noop}
        steps={sampleSteps}
        recipients={[]}
        attachments={[]}
        setAttachments={noop}
        attachmentRetention="5년"
        setAttachmentRetention={noop}
        relatedDocs={[]}
        setRelatedDocs={noop}
        setShowRelatedModal={noop}
        onFileUpload={async () => {}}
        uploading={false}
        editDocNo="AP-미리보기"
        isDesignMode
        only={only}
        paperWidth={paperWidth}
        sheetBody={(slots: SheetSlots) => {
          const b = typeof body === 'function' ? body(slots) : body;
          return interactive ? <div className="pointer-events-auto select-text">{b}</div> : b;
        }}
      />
    </div>
  );
}
