/**
 * 워드 편집기 — A4 종이 모양 화면에서 문서를 쓴다(Tiptap). 위 도구 막대는 화면 위에 붙어 따라온다.
 * 값은 문서 JSON(model.ts) — 저장·불러오기는 docxWrite·docxRead.
 * 이 폴더 밖 코드는 쓰지 않는다(react·@tiptap 만) — 아이콘도 글자로.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { A4, A4_CONTENT_WIDTH, type WordNode } from './model';
import { fromDataUrl, imageSize } from './image';
import { WordTableCell, WordTableHeader, WordTableRow } from './cell';
import { Btn, Palette, Popover, SELECT_CLS, Sep, closePopover } from './controls';
import { ParagraphFormat, INDENT_STEP, changeIndent, setParaFormat } from './paragraph';
import { CELL_MIN_WIDTH, paraDefault } from './format';
import { TableBar } from './TableBar';
import { TableSnap } from './tableSnap';
import { PAGE_GAP, PAGE_PITCH, Pagination, pageCount } from './pagination';

export interface WordEditorProps {
  value: WordNode;
  onChange: (doc: WordNode) => void;
  /** 읽기만 */
  readOnly?: boolean;
  /** 도구 막대가 붙을 화면 위 자리(px) */
  stickyTop?: number;
  /** 빈 문서에 흐리게 보일 글 */
  placeholder?: string;
  /** 도구 막대 끝에 붙일 쓰는 쪽 단추 */
  toolbarExtra?: ReactNode;
  /** 편집기를 만들었을 때(쓰는 쪽이 명령을 쓸 때 — 인쇄·내용 바꾸기 등) */
  onReady?: (editor: Editor) => void;
}

export const WORD_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: { openOnClick: false, autolink: true } }),
  TextStyleKit,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Image.configure({ inline: true, allowBase64: true, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 24, minHeight: 24 } }),
  TableKit.configure({ table: { resizable: true, cellMinWidth: CELL_MIN_WIDTH }, tableRow: false, tableCell: false, tableHeader: false }),
  WordTableRow,
  WordTableCell,
  WordTableHeader,
  ParagraphFormat,
  TableSnap,
  Pagination,
];

/** 줄 간격(워드 배수)·문단 앞뒤 간격(pt) 고르기 */
const LINE_HEIGHTS = [1, 1.15, 1.5, 2, 2.5, 3];
const PARA_SPACES = [0, 3, 6, 8, 10, 12, 18, 24];
const FONT_SIZES = ['8', '9', '10', '10.5', '11', '12', '14', '16', '18', '20', '24', '28', '36'];
const COLORS = ['#000000', '#595959', '#c62828', '#d9480f', '#a16207', '#2b8a3e', '#0f766e', '#1d4ed8', '#6d28d9'];
const HIGHLIGHTS = ['#fff59d', '#c8e6c9', '#bbdefb', '#f8bbd0', '#ffe0b2', '#e0e0e0'];
const FONTS = [
  { label: '맑은 고딕', value: '' },
  { label: '바탕', value: 'Batang, 바탕, serif' },
  { label: '굴림', value: 'Gulim, 굴림, sans-serif' },
  { label: '돋움', value: 'Dotum, 돋움, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
];

/** 종이 안 문서 모양 — 앱 공통 CSS(Tailwind 초기화)가 목록 점·표 선을 지우므로 여기서 다시 그린다 */
const CSS = `
.wf-word .ProseMirror{outline:none;display:flow-root;font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:10pt;line-height:1.5;color:#111;word-break:keep-all;overflow-wrap:anywhere}
.wf-word .ProseMirror p{margin:0 0 6pt}
.wf-word .ProseMirror h1,.wf-word .ProseMirror h2,.wf-word .ProseMirror h3,.wf-word .ProseMirror h4,.wf-word .ProseMirror h5,.wf-word .ProseMirror h6{font-weight:700;margin:12pt 0 6pt;line-height:1.3}
.wf-word .ProseMirror h1,.wf-word .ProseMirror h2{margin-top:18pt}
.wf-word .ProseMirror h1{font-size:18pt}.wf-word .ProseMirror h2{font-size:15pt}.wf-word .ProseMirror h3{font-size:13pt}
.wf-word .ProseMirror h4{font-size:12pt}.wf-word .ProseMirror h5{font-size:11pt}.wf-word .ProseMirror h6{font-size:10pt}
.wf-word .ProseMirror ul{list-style:disc;padding-left:2em;margin:0 0 6pt}.wf-word .ProseMirror ul ul{list-style:circle}.wf-word .ProseMirror ul ul ul{list-style:square}
.wf-word .ProseMirror ol{list-style:decimal;padding-left:2em;margin:0 0 6pt}.wf-word .ProseMirror ol ol{list-style:lower-alpha}.wf-word .ProseMirror ol ol ol{list-style:lower-roman}
.wf-word .ProseMirror li>p{margin:0 0 2pt}
.wf-word .ProseMirror blockquote{border-left:3px solid #bfbfbf;padding-left:10px;color:#595959;margin:0 0 6pt;display:flow-root}
.wf-word .ProseMirror hr{border:none;border-top:1px solid #bfbfbf;margin:8pt 0}
.wf-word .ProseMirror a{color:#0563c1;text-decoration:underline}
.wf-word .ProseMirror code{font-family:Consolas,monospace;background:#f2f2f2;padding:0 2px;border-radius:2px}
.wf-word .ProseMirror mark{padding:0 1px;border-radius:1px}
.wf-word .ProseMirror img{display:inline-block;max-width:100%;height:auto;vertical-align:bottom}
.wf-word .ProseMirror [data-resize-handle]{background:#3a7bd5;border-radius:2px}
.wf-word .ProseMirror table{border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 6pt;overflow:hidden}
.wf-word .ProseMirror td,.wf-word .ProseMirror th{border:1px solid #808080;padding:3px 6px;vertical-align:top;position:relative;min-width:40px}
.wf-word .ProseMirror th{background:#f2f2f2;font-weight:700;text-align:left}
.wf-word .ProseMirror td>p,.wf-word .ProseMirror th>p{margin:0}
.wf-word .ProseMirror td>:is(h1,h2,h3,h4,h5,h6),.wf-word .ProseMirror th>:is(h1,h2,h3,h4,h5,h6){margin:0}
.wf-word .ProseMirror .selectedCell:after{content:'';position:absolute;inset:0;background:rgba(58,123,213,.15);pointer-events:none}
.wf-word .ProseMirror .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-2px;width:4px;background:#3a7bd5;pointer-events:none}
.wf-word .ProseMirror.resize-cursor{cursor:col-resize}
.wf-word .ProseMirror .tableWrapper{overflow-x:auto}
.wf-word .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#aaa;float:left;height:0;pointer-events:none}
@media print{html,body{background:#fff!important}.wf-word-bar,.wf-word-sheets,.wf-pg-spacer,.wf-pg-split{display:none!important}.wf-pg-push{padding-top:0!important}.wf-word-paper{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;min-height:0!important}}
`;

export function WordEditor({ value, onChange, readOnly = false, stickyTop = 0, placeholder = '내용을 입력하세요', toolbarExtra, onReady }: WordEditorProps) {
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  /** 편집기가 가진 문서(처음 넣은 값 또는 마지막으로 내보낸 값) — 같은 값이 돌아오면 편집기에 다시 넣지 않는다 */
  const sentRef = useRef<WordNode | null>(value);
  const editor = useEditor({
    extensions: [...WORD_EXTENSIONS, Placeholder.configure({ placeholder })],
    content: value,
    editable: !readOnly,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: ed }) => {
      const doc = ed.getJSON() as WordNode;
      sentRef.current = doc;
      changeRef.current(doc);
    },
  });
  useEffect(() => {
    if (editor) onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  // 바깥에서 문서를 통째로 바꾸면(새 문서·파일 열기) 편집기에도 넣는다 — 편집기가 보낸 값이면 그대로
  useEffect(() => {
    // 개발 모드(StrictMode)는 화면을 두 번 붙였다 떼며 편집기를 한 번 정리한다 — 정리된 편집기엔 명령을 보내지 않는다
    if (!editor || editor.isDestroyed || value === sentRef.current) return;
    sentRef.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly);
  }, [editor, readOnly]);
  const pages = editor && !editor.isDestroyed ? pageCount(editor.state) : 1;

  return (
    <div className="wf-word">
      <style>{CSS}</style>
      {!readOnly && editor && (
        <div className="wf-word-bar sticky z-20 mb-3" style={{ top: stickyTop }}>
          <Toolbar editor={editor} extra={toolbarExtra} />
        </div>
      )}
      <div
        className="wf-word-paper relative mx-auto"
        style={{ width: A4.width, minHeight: pages * PAGE_PITCH - PAGE_GAP, padding: A4.margin, boxSizing: 'border-box' }}
        onClick={() => editor && !editor.isDestroyed && !editor.isFocused && !readOnly && editor.commands.focus()}
      >
        <PageSheets pages={pages} />
        {/* 종이(위치 지정된 요소)보다 위에 그려지게 */}
        <div className="relative z-[1]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

/** 모서리 표시 길이(px)·색 */
const MARK = 20;
const MARK_COLOR = '#b4b4b4';

/**
 * A4 종이들 — 장마다 흰 종이와 본문 영역 네 모서리 표시(┘ └ ┐ ┌, 워드처럼 여백 경계). 장 사이는 틈(PAGE_GAP).
 * 어느 내용이 어느 장에 오는지는 쪽 나눔(pagination.ts)이 정한다. 인쇄에는 나오지 않는다
 */
function PageSheets({ pages }: { pages: number }) {
  const left = A4.margin - MARK;
  const right = A4.width - A4.margin;
  const line = `1px solid ${MARK_COLOR}`;
  return (
    <div className="wf-word-sheets pointer-events-none absolute inset-0" aria-hidden>
      {Array.from({ length: pages }, (_, i) => {
        const top = i * PAGE_PITCH;
        const marks = [
          { left, top: top + A4.margin - MARK, borderRight: line, borderBottom: line },
          { left: right, top: top + A4.margin - MARK, borderLeft: line, borderBottom: line },
          { left, top: top + A4.height - A4.margin, borderRight: line, borderTop: line },
          { left: right, top: top + A4.height - A4.margin, borderLeft: line, borderTop: line },
        ];
        return (
          <div key={i}>
            <div className="absolute left-0 bg-white shadow-[0_1px_4px_rgba(0,0,0,.15)]" style={{ top, width: A4.width, height: A4.height }} />
            {marks.map((st, k) => (
              <span key={k} className="absolute" style={{ width: MARK, height: MARK, ...st }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── 도구 막대 ──

function Toolbar({ editor, extra }: { editor: Editor; extra?: ReactNode }) {
  const imgRef = useRef<HTMLInputElement>(null);
  const c = () => editor.chain().focus();
  const ts = editor.getAttributes('textStyle') as { fontSize?: string; color?: string; fontFamily?: string };
  const level = [1, 2, 3, 4, 5, 6].find((l) => editor.isActive('heading', { level: l }));
  const align = (['left', 'center', 'right', 'justify'] as const).find((a) => editor.isActive({ textAlign: a })) ?? 'left';
  const inTable = editor.isActive('table');
  const size = (ts.fontSize ?? '').replace(/pt$/, '');

  const putImage = async (file: File) => {
    const src = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const bytes = fromDataUrl(src);
    const nat = bytes ? imageSize(bytes.data) : null;
    // 본문 폭보다 크면 본문 폭으로
    const width = nat ? Math.min(nat.width, A4_CONTENT_WIDTH) : undefined;
    c().setImage({ src, alt: file.name, ...(width ? { width } : {}) }).run();
  };

  const setLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('링크 주소(비우면 링크 빼기)', prev || 'https://');
    if (url === null) return;
    if (!url.trim() || url.trim() === 'https://') c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const sel = SELECT_CLS;
  const para = editor.getAttributes(level ? 'heading' : 'paragraph') as { lineHeight?: number | null; spaceBefore?: number | null; spaceAfter?: number | null };
  const inList = editor.isActive('listItem');
  /** 커서 자리 문단의 기본 줄 간격 — 제목·표 칸 안이면 다르다 */
  const baseLine = paraDefault(level, editor.isActive('tableCell') || editor.isActive('tableHeader')).lineHeight;
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-[#d4dbe7] bg-white/95 px-2 py-1 shadow-sm backdrop-blur">
      <Btn title="되돌리기 (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
      <Btn title="다시 하기 (Ctrl+Y)" onClick={() => c().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
      <Sep />
      <select
        className={sel}
        title="문단 모양"
        value={level ? `h${level}` : 'p'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }}
      >
        <option value="p">본문</option>
        <option value="h1">제목 1</option>
        <option value="h2">제목 2</option>
        <option value="h3">제목 3</option>
        <option value="h4">제목 4</option>
      </select>
      <select className={sel} title="글꼴" value={ts.fontFamily ?? ''} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}>
        {/* 목록에 없는 글꼴(불러온 문서) — 첫 글꼴 이름으로 보인다 */}
        {ts.fontFamily && !FONTS.some((f) => f.value === ts.fontFamily) && <option value={ts.fontFamily}>{ts.fontFamily.split(',')[0]}</option>}
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <select className={`${sel} w-[62px]`} title="글자 크기(pt)" value={size} onChange={(e) => (e.target.value ? c().setFontSize(`${e.target.value}pt`).run() : c().unsetFontSize().run())}>
        <option value="">10</option>
        {FONT_SIZES.filter((s) => s !== '10').map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Sep />
      <Btn title="굵게 (Ctrl+B)" on={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <b>가</b>
      </Btn>
      <Btn title="기울임 (Ctrl+I)" on={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <i>가</i>
      </Btn>
      <Btn title="밑줄 (Ctrl+U)" on={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}>
        <u>가</u>
      </Btn>
      <Btn title="취소선" on={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}>
        <s>가</s>
      </Btn>
      <Palette title="글자 색" colors={COLORS} current={ts.color} onPick={(v) => (v ? c().setColor(v).run() : c().unsetColor().run())} face={<span style={{ borderBottom: `3px solid ${ts.color ?? '#000'}` }}>가</span>} />
      <Palette
        title="형광펜"
        colors={HIGHLIGHTS}
        current={editor.getAttributes('highlight').color as string | undefined}
        onPick={(v) => (v ? c().setHighlight({ color: v }).run() : c().unsetHighlight().run())}
        face={<span style={{ background: (editor.getAttributes('highlight').color as string) ?? '#fff59d', padding: '0 2px' }}>가</span>}
      />
      <Btn title="서식 지우기" onClick={() => c().unsetAllMarks().run()}>⌫</Btn>
      <Sep />
      {(
        [
          ['left', '왼쪽 정렬', '⫷'],
          ['center', '가운데 정렬', '≡'],
          ['right', '오른쪽 정렬', '⫸'],
          ['justify', '양쪽 정렬', '☰'],
        ] as const
      ).map(([a, t, g]) => (
        <Btn key={a} title={t} on={align === a} onClick={() => c().setTextAlign(a).run()}>
          {g}
        </Btn>
      ))}
      <Sep />
      <Btn title="글머리 기호" on={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>•≡</Btn>
      <Btn title="번호 목록" on={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1.</Btn>
      <Btn title="내어쓰기 (목록은 Shift+Tab)" onClick={() => (inList ? c().liftListItem('listItem').run() : changeIndent(editor, -INDENT_STEP))}>⇤</Btn>
      <Btn title="들여쓰기 (목록은 Tab)" onClick={() => (inList ? c().sinkListItem('listItem').run() : changeIndent(editor, INDENT_STEP))}>⇥</Btn>
      <Popover title="줄 간격·문단 간격" width={196} face={<span>↕</span>}>
        <div className="mb-1 text-[11px] font-bold text-[#56607a]">줄 간격</div>
        <div className="grid grid-cols-4 gap-1">
          {LINE_HEIGHTS.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                setParaFormat(editor, { lineHeight: v === baseLine ? null : v });
                closePopover(e.currentTarget);
              }}
              className={`rounded border py-0.5 text-[12px] ${(para.lineHeight ?? baseLine) === v ? 'border-[#1d4ed8] bg-[#dbe6f7] text-[#1d4ed8]' : 'border-[#d4dbe7] text-[#333] hover:bg-[#eef1f5]'}`}
            >
              {v}
            </button>
          ))}
        </div>
        {(
          [
            ['spaceBefore', '문단 앞'],
            ['spaceAfter', '문단 뒤'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="mt-2 flex items-center justify-between text-[12px] text-[#333]">
            {label}
            <select className={sel} value={para[k] ?? ''} onChange={(e) => setParaFormat(editor, { [k]: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">기본</option>
              {[...new Set([...PARA_SPACES, ...(para[k] != null ? [para[k]!] : [])])]
                .sort((a, b) => a - b)
                .map((v) => (
                  <option key={v} value={v}>
                    {v}pt
                  </option>
                ))}
            </select>
          </label>
        ))}
      </Popover>
      <Btn title="인용" on={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
      <Btn title="구분선" onClick={() => c().setHorizontalRule().run()}>―</Btn>
      <Sep />
      <Btn title="링크" on={editor.isActive('link')} onClick={setLink}>🔗</Btn>
      <Btn title="그림 넣기" onClick={() => imgRef.current?.click()}>🖼</Btn>
      <Btn title="표 넣기(3×3)" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦</Btn>
      <input
        ref={imgRef}
        type="file"
        accept="image/png,image/jpeg,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void putImage(f);
        }}
      />
      {extra && (
        <>
          <Sep />
          {extra}
        </>
      )}
      {inTable && <TableBar editor={editor} />}
    </div>
  );
}

