import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, Eye, FileSpreadsheet, History, Save, X } from 'lucide-react';
import { useAuth } from '@/app/auth/AuthProvider';
import type { ApprovalFolder, ApprovalForm } from '@/domain/approvalForm/schema';
import { useFormVersionList, useFormVersionSheet, useSaveSheetForm } from '@/features/gw/useApprovalFormVersions';
import { DEFAULT_COL_WIDTH, SheetEditor, SheetView, createSheet, importXlsx, recalculate, type Sheet, type SheetSelection } from '@/lib/sheet';
import {
  SHEET_PAGE_WIDTH,
  approvalCellProps,
  bindLabel,
  canMergeApprovalRange,
  cellNameLabel,
  isStructureLocked,
  setApprovalCellValue,
  validateApprovalSheet,
} from '@/modules/gw/approval/sheetForm/approvalSheet';
import { SheetCellPanel } from './SheetCellPanel';

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
  return <Designer {...props} initial={loaded?.sheet ?? createSheet(20, 8)} />;
}

function Designer({ form: initialForm, version: initialVersion, forms, folders, onClose, initial }: Props & { initial: Sheet }) {
  const { user } = useAuth();
  const save = useSaveSheetForm();
  const [form, setForm] = useState<ApprovalForm>(initialForm);
  const [sheet, setSheet] = useState<Sheet>(initial);
  const [baseVersion, setBaseVersion] = useState<number | null>(initialVersion);
  const [savedSheet, setSavedSheet] = useState<Sheet>(initial);
  const [savedForm, setSavedForm] = useState<ApprovalForm>(initialForm);
  const [selection, setSelection] = useState<SheetSelection>({ range: { r1: 0, c1: 0, r2: 0, c2: 0 }, focus: { r: 0, c: 0 } });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string; list?: string[] } | null>(null);
  const [note, setNote] = useState('');
  const [side, setSide] = useState<'cell' | 'history'>('cell');
  const [preview, setPreview] = useState<{ sheet: Sheet; title: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isNew = !form.id;
  const sheetWidth = sheet.cols.reduce((sum, col) => sum + (sheet.colWidths[col] ?? DEFAULT_COL_WIDTH), 0);
  const pageScale = sheetWidth > SHEET_PAGE_WIDTH ? SHEET_PAGE_WIDTH / sheetWidth : 1;
  const dirty = sheet !== savedSheet || JSON.stringify(form) !== JSON.stringify(savedForm);
  const set = (patch: Partial<ApprovalForm>) => setForm((f) => ({ ...f, ...patch }));

  const close = () => {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 닫을까요?')) return;
    onClose();
  };

  // ── 엑셀 불러오기 ──
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const hasContent = sheet.rows.some((row) => Object.values(row).some((v) => v !== ''));
    if (hasContent && !confirm(`지금 시트를 '${file.name}' 내용으로 바꿉니다. 칸 속성도 모두 지워집니다(Ctrl+Z 로 되돌릴 수 있음). 계속할까요?`)) return;
    try {
      const { sheet: imported, warnings } = await importXlsx(new Uint8Array(await file.arrayBuffer()));
      setSheet(imported);
      const base = file.name.replace(/\.xlsx$/i, '');
      if (!form.name.trim()) set({ name: base });
      setNote(`엑셀에서 불러옴: ${file.name}`);
      setMsg({
        kind: warnings.length ? 'info' : 'ok',
        text: `'${file.name}'을 불러왔습니다 — ${imported.rows.length}행 × ${imported.cols.length}열. 이제 기안자가 쓸 칸을 골라 '입력 칸'으로 정해 주세요.`,
        list: warnings,
      });
    } catch (err) {
      setMsg({ kind: 'err', text: `엑셀을 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // ── 저장 ──
  const onSave = async () => {
    const code = form.code.trim();
    const name = form.name.trim();
    if (!name) return setMsg({ kind: 'err', text: '서식명을 입력하세요.' });
    if (!code) return setMsg({ kind: 'err', text: '서식 코드를 입력하세요.' });
    if (isNew && forms.some((f) => f.code.toLowerCase() === code.toLowerCase())) {
      return setMsg({ kind: 'err', text: `서식 코드 '${code}'는 이미 쓰고 있습니다. 다른 코드를 정해 주세요.` });
    }
    const errors = validateApprovalSheet(sheet);
    if (errors.length) return setMsg({ kind: 'err', text: '저장할 수 없습니다. 아래를 고쳐 주세요.', list: errors });
    if (!user) return setMsg({ kind: 'err', text: '로그인 정보가 없습니다.' });

    const header: ApprovalForm = { ...form, id: code, code, name, fields: [], active: false };
    try {
      setMsg({ kind: 'info', text: '저장 중…' });
      const res = await save.mutateAsync({ form: header, sheet, baseVersion, note: note.trim() || undefined, user: { id: user.id, name: user.name } });
      setForm(header);
      setSavedForm(header);
      setSavedSheet(sheet);
      setBaseVersion(res.version);
      setNote('');
      setMsg({ kind: 'ok', text: res.created ? `저장했습니다 — v${res.version}` : `틀이 바뀌지 않아 서식 정보만 저장했습니다(v${res.version} 그대로).` });
    } catch (err) {
      setMsg({ kind: 'err', text: `저장 실패: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  // ── 칸 표시(편집 격자 안) ──
  const badge = (r: number, c: number) => {
    const p = approvalCellProps(sheet, r, c);
    const marks: { t: string; cls: string; title: string }[] = [];
    if (p.input) marks.push({ t: '입력', cls: 'bg-amber-400/90 text-white', title: '입력 칸' });
    if (p.name) marks.push({ t: cellNameLabel(p.name), cls: 'bg-teal text-white', title: '칸 이름' });
    if (p.bind) marks.push({ t: '불러옴', cls: 'bg-sky-500 text-white', title: bindLabel(p.bind) });
    if (p.lock) marks.push({ t: '잠금', cls: 'bg-ink3 text-white', title: '기안자 수정 잠금' });
    if (p.secret) marks.push({ t: '비공개', cls: 'bg-rose-500 text-white', title: '비공개' });
    if (p.seal) marks.push({ t: '직인', cls: 'bg-red-600 text-white', title: '회사 직인 자리' });
    if (!marks.length) return null;
    return (
      <span className="pointer-events-none absolute right-0.5 top-0.5 flex gap-0.5">
        {marks.map((m) => (
          <span key={m.t} title={m.title} className={`rounded-sm px-1 text-[8.5px] font-bold leading-[13px] ${m.cls}`}>
            {m.t}
          </span>
        ))}
      </span>
    );
  };

  const msgCls =
    msg?.kind === 'err'
      ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
      : msg?.kind === 'info'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        : 'border-teal/30 bg-teal-soft/70 text-teal';

  return (
    <div className="space-y-3">
      {/* 머리 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={close}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-bold text-ink2 hover:text-ink cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>서식 목록</span>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-ink">{isNew ? '새 시트 서식' : form.name}</span>
              <span className="rounded bg-sky-500/15 px-1.5 text-[10px] font-bold text-sky-600">시트</span>
              {baseVersion !== null && <span className="rounded bg-teal-soft px-1.5 font-mono text-[10px] font-bold text-teal">v{baseVersion}</span>}
              {dirty && <span className="text-[10.5px] font-bold text-amber-600">저장 안 됨</span>}
            </div>
            <span className="text-[10.5px] text-ink3">엑셀처럼 틀을 만들고, 기안자가 쓸 칸을 '입력 칸'으로 정합니다 · 기안 연결은 다음 단계(지금은 사용 안 함으로 저장)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => setPreview({ sheet: recalculate(sheet), title: '지금 편집 중인 틀' })}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel-alt px-3 py-1.5 text-[12px] font-semibold text-ink2 hover:text-ink cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>문서 모양</span>
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
        <div className={`rounded-lg border px-4 py-2.5 text-[12px] font-bold ${msgCls}`}>
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

      {/* 서식 정보 */}
      <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-panel p-3 md:grid-cols-[70px_1fr_1fr_1fr_1fr_1.4fr]">
        <Field label="아이콘">
          <input className={inp} value={form.icon} onChange={(e) => set({ icon: e.target.value })} placeholder="📄" />
        </Field>
        <Field label="서식명">
          <input className={inp} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="발주서" />
        </Field>
        <Field label={isNew ? '서식 코드' : '서식 코드(저장 후 고정)'}>
          <input className={inp} value={form.code} disabled={!isNew} onChange={(e) => set({ code: e.target.value })} placeholder="발주_시트" />
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
        <Field label="이번 저장 메모 (버전 기록에 남음)">
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 품목 표 열 추가" maxLength={255} />
        </Field>
      </div>

      {/* 편집기 + 옆 패널 */}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_290px]">
        <div className="min-w-0 rounded-xl border border-border bg-panel p-2">
          <SheetEditor
            value={sheet}
            onChange={setSheet}
            mode="design"
            canMerge={canMergeApprovalRange}
            canDeleteRow={(s, r) => !isStructureLocked(s, 'row', r)}
            canDeleteCol={(s, c) => !isStructureLocked(s, 'col', c)}
            setValue={setApprovalCellValue}
            renderBadge={badge}
            onSelect={setSelection}
            onNotice={(text) => setMsg({ kind: 'err', text })}
            guideWidth={SHEET_PAGE_WIDTH}
            height="calc(100vh - 330px)"
          />
          <div className="space-y-0.5 px-1 pt-1.5 text-[10.5px] text-ink3">
            {pageScale < 1 && (
              <div className="font-semibold text-amber-700 dark:text-amber-400">
                A4 세로 폭보다 넓어(전체 {sheetWidth}px) 문서·인쇄에서는 약 {Math.round(pageScale * 100)}%로 줄여 한 쪽 폭에 맞춥니다 — 엑셀의 '한 페이지에 맞춤'과 같습니다. 글씨가 너무 작으면 열 너비를 줄여 주세요.
              </div>
            )}
            <div>세로 점선 = A4 세로 인쇄 폭. 칸 이름·불러오기·비공개·직인이 든 행·열은 그 속성을 먼저 지워야 지울 수 있습니다.</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-3">
          <div className="mb-3 flex rounded-lg border border-border bg-panel-alt p-0.5 text-[11.5px]">
            {(
              [
                ['cell', '칸 속성'],
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
            <SheetCellPanel sheet={sheet} selection={selection} onChange={setSheet} />
          ) : (
            <VersionHistory
              formId={isNew ? null : form.id}
              current={baseVersion}
              onPreview={(s, v) => setPreview({ sheet: recalculate(s), title: `v${v}` })}
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

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="rounded-xl bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-6">
              <span className="text-[13px] font-bold text-ink">문서 모양 — {preview.title}</span>
              <button type="button" onClick={() => setPreview(null)} className="rounded p-1 text-ink3 hover:bg-panel-alt" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="border border-black/10 bg-white p-[38px]" style={{ width: SHEET_PAGE_WIDTH + 76 }}>
              <SheetView sheet={preview.sheet} fitWidth={SHEET_PAGE_WIDTH} />
            </div>
            <div className="mt-2 text-[10.5px] text-ink3">A4 세로(여백 10mm) 폭에 맞춘 모양 · 넓으면 비율로 줄여 보입니다.</div>
          </div>
        </div>
      )}
    </div>
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
                    문서 모양
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
