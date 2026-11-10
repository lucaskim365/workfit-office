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
  TableKit.configure({ table: { resizable: true, cellMinWidth: 40 }, tableRow: false, tableCell: false, tableHeader: false }),
  WordTableRow,
  WordTableCell,
  WordTableHeader,
];

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
.wf-word .ProseMirror{outline:none;font-family:'Malgun Gothic','맑은 고딕',sans-serif;font-size:10pt;line-height:1.5;color:#111;word-break:keep-all;overflow-wrap:anywhere}
.wf-word .ProseMirror p{margin:0 0 6pt}
.wf-word .ProseMirror h1,.wf-word .ProseMirror h2,.wf-word .ProseMirror h3,.wf-word .ProseMirror h4,.wf-word .ProseMirror h5,.wf-word .ProseMirror h6{font-weight:700;margin:12pt 0 6pt;line-height:1.3}
.wf-word .ProseMirror h1{font-size:18pt}.wf-word .ProseMirror h2{font-size:15pt}.wf-word .ProseMirror h3{font-size:13pt}
.wf-word .ProseMirror h4{font-size:12pt}.wf-word .ProseMirror h5{font-size:11pt}.wf-word .ProseMirror h6{font-size:10pt}
.wf-word .ProseMirror ul{list-style:disc;padding-left:2em;margin:0 0 6pt}.wf-word .ProseMirror ul ul{list-style:circle}.wf-word .ProseMirror ul ul ul{list-style:square}
.wf-word .ProseMirror ol{list-style:decimal;padding-left:2em;margin:0 0 6pt}.wf-word .ProseMirror ol ol{list-style:lower-alpha}.wf-word .ProseMirror ol ol ol{list-style:lower-roman}
.wf-word .ProseMirror li>p{margin:0 0 2pt}
.wf-word .ProseMirror blockquote{border-left:3px solid #bfbfbf;padding-left:10px;color:#595959;margin:0 0 6pt}
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
.wf-word .ProseMirror .selectedCell:after{content:'';position:absolute;inset:0;background:rgba(58,123,213,.15);pointer-events:none}
.wf-word .ProseMirror .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-2px;width:4px;background:#3a7bd5;pointer-events:none}
.wf-word .ProseMirror.resize-cursor{cursor:col-resize}
.wf-word .ProseMirror .tableWrapper{overflow-x:auto}
.wf-word .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#aaa;float:left;height:0;pointer-events:none}
@media print{html,body{background:#fff!important}.wf-word-bar{display:none!important}.wf-word-paper{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;min-height:0!important}}
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

  return (
    <div className="wf-word">
      <style>{CSS}</style>
      {!readOnly && editor && (
        <div className="wf-word-bar sticky z-20 mb-3" style={{ top: stickyTop }}>
          <Toolbar editor={editor} extra={toolbarExtra} />
        </div>
      )}
      <div
        className="wf-word-paper mx-auto bg-white shadow-[0_1px_4px_rgba(0,0,0,.15)]"
        style={{ width: A4.width, minHeight: A4.height, padding: A4.margin, boxSizing: 'border-box' }}
        onClick={() => editor && !editor.isDestroyed && !editor.isFocused && !readOnly && editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ── 도구 막대 ──

function Btn({ on, title, onClick, children, disabled }: { on?: boolean; title: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-7 min-w-7 rounded px-1.5 text-[12.5px] leading-none ${on ? 'bg-[#dbe6f7] text-[#1d4ed8]' : 'text-[#333] hover:bg-[#eef1f5]'} disabled:opacity-35`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-[#d4dbe7]" />;

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

  const sel = 'h-7 rounded border border-[#d4dbe7] bg-white px-1 text-[12px] text-[#333] outline-none';
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
      <Btn title="내어쓰기 (Shift+Tab)" onClick={() => c().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')}>⇤</Btn>
      <Btn title="들여쓰기 (Tab)" onClick={() => c().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')}>⇥</Btn>
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
      {inTable && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-0.5 border-t border-[#eef1f5] pt-1">
          <span className="mr-1 text-[11.5px] font-bold text-[#56607a]">표</span>
          <Btn title="위에 행 넣기" onClick={() => c().addRowBefore().run()}>↑행</Btn>
          <Btn title="아래에 행 넣기" onClick={() => c().addRowAfter().run()}>↓행</Btn>
          <Btn title="왼쪽에 열 넣기" onClick={() => c().addColumnBefore().run()}>←열</Btn>
          <Btn title="오른쪽에 열 넣기" onClick={() => c().addColumnAfter().run()}>→열</Btn>
          <Btn title="행 지우기" onClick={() => c().deleteRow().run()}>행 삭제</Btn>
          <Btn title="열 지우기" onClick={() => c().deleteColumn().run()}>열 삭제</Btn>
          <Sep />
          <Btn title="칸 합치기(여러 칸을 끌어 고른 뒤)" onClick={() => c().mergeCells().run()} disabled={!editor.can().mergeCells()}>합치기</Btn>
          <Btn title="칸 나누기" onClick={() => c().splitCell().run()} disabled={!editor.can().splitCell()}>나누기</Btn>
          <Btn title="머리 행(첫 줄 강조) 켜고 끄기" onClick={() => c().toggleHeaderRow().run()}>머리 행</Btn>
          <Sep />
          <Btn title="표 지우기" onClick={() => c().deleteTable().run()}>표 삭제</Btn>
        </div>
      )}
    </div>
  );
}

function Palette({ title, colors, current, onPick, face }: { title: string; colors: string[]; current?: string; onPick: (v: string | null) => void; face: ReactNode }) {
  return (
    <details className="relative">
      <summary title={title} className="flex h-7 min-w-7 cursor-pointer list-none items-center justify-center rounded px-1.5 text-[12.5px] text-[#333] hover:bg-[#eef1f5]">
        {face}
        <span className="ml-0.5 text-[9px] text-[#8b95ab]">▾</span>
      </summary>
      <div className="absolute left-0 top-8 z-30 grid w-[132px] grid-cols-5 gap-1 rounded-lg border border-[#d4dbe7] bg-white p-2 shadow-lg">
        {colors.map((col) => (
          <button
            key={col}
            type="button"
            title={col}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              onPick(col);
              (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
            }}
            className={`h-5 w-5 rounded border ${current === col ? 'border-[#1d4ed8] ring-1 ring-[#1d4ed8]' : 'border-[#d4dbe7]'}`}
            style={{ background: col }}
          />
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            onPick(null);
            (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
          }}
          className="col-span-5 mt-1 rounded border border-[#d4dbe7] py-0.5 text-[11px] text-[#56607a] hover:bg-[#eef1f5]"
        >
          없음
        </button>
      </div>
    </details>
  );
}
