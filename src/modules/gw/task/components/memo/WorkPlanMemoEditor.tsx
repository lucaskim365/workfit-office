import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, Extension, useEditor, type Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Highlight from '@tiptap/extension-highlight';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { contentToEditorDoc, editorDocToContent } from '@/domain/workPlan/richText';
import { MemoFormatToolbar } from './MemoFormatToolbar';

/**
 * 업무계획 메모 편집기 — 편집 중에도 굵게·기울임·취소선·체크박스가 그대로 보인다(Tiptap).
 * 2026-10 개편 때 지운 칸 편집기(WorkPlanRichEditor)를 메모용으로 되살렸다.
 *
 * 값은 저장 형식 그대로의 **줄 단위 텍스트**(`**굵게**`, `- [ ] 할 일` …) — 변환은 domain/workPlan/richText.
 * 줄 하나가 문단 하나라 제목·인용 같은 여러 줄 서식과 줄 안 줄바꿈은 끈다(텍스트로 되돌릴 수 없어서).
 *
 * 키: Enter = 새 줄(체크박스 줄이면 다음 체크박스, 빈 체크박스에서 Enter = 일반 줄로), Ctrl+Enter = 저장, Esc = 취소.
 */

/**
 * 할 일 항목.
 * - 체크박스는 버튼·Ctrl+Shift+9로만 만든다. `- `·`[ ] ` 입력 자동 전환은 끈다 — '-'로 시작하는 줄이 체크박스가 되지 않게.
 * - 할 일 맨 앞에서 Backspace = 체크박스만 빼고 글자는 일반 줄로(기본 동작은 윗 항목과 합쳐 버렸다).
 */
const MemoTaskItem = TaskItem.extend({
  addInputRules() {
    return [];
  },
  addKeyboardShortcuts() {
    const cursorAtItemStart = () => {
      const { empty, $from } = this.editor.state.selection;
      return empty && $from.parentOffset === 0 && $from.node(-1)?.type === this.type;
    };
    return {
      ...this.parent?.(),
      Backspace: () => (cursorAtItemStart() ? this.editor.commands.liftListItem(this.name) : false),
    };
  },
}).configure({ nested: false });

/** 체크박스 목록 바로 아래 일반 줄 맨 앞에서 Backspace → 윗줄(마지막 할 일) 끝으로 합친다(기본은 체크박스를 되살렸다) */
const BackspaceIntoTaskAbove = Extension.create({
  name: 'memoBackspaceIntoTaskAbove',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { empty, $from } = editor.state.selection;
        if (!empty || $from.parentOffset !== 0 || $from.depth !== 1 || $from.parent.type.name !== 'paragraph') return false;
        const index = $from.index(0);
        if (index === 0 || editor.state.doc.child(index - 1).type.name !== 'taskList') return false;
        const paraStart = $from.before(1);
        // 목록 끝(paraStart) ← 할 일 끝 ← 문단 끝 ← 문단 내용 끝: 세 칸 앞이 마지막 할 일의 글 끝
        const joinPos = paraStart - 3;
        return editor
          .chain()
          .command(({ tr }) => {
            const para = tr.doc.nodeAt(paraStart);
            if (!para) return false;
            tr.delete(paraStart, paraStart + para.nodeSize);
            tr.insert(joinPos, para.content);
            tr.setSelection(TextSelection.create(tr.doc, joinPos));
            return true;
          })
          .run();
      },
    };
  },
});

const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    link: false,
    hardBreak: false,
    trailingNode: false,
  }),
  TaskList,
  MemoTaskItem,
  BackspaceIntoTaskAbove,
  Highlight,
  TextStyle,
  Color,
];

export function WorkPlanMemoEditor({
  value,
  onChange,
  onSave,
  onCancel,
  onBlur,
  disabled,
  label,
  toolbar = 'floating',
  className = '',
}: {
  value: string;
  onChange: (content: string) => void;
  /** Ctrl+Enter */
  onSave: () => void;
  /** Esc */
  onCancel: () => void;
  /** 편집기 밖을 눌렀을 때(서식 버튼은 제외) */
  onBlur?: () => void;
  disabled?: boolean;
  label: string;
  /** floating = 편집기 바로 위에 떠 있는 버튼(좁은 칸), inline = 편집기 위에 한 줄(휴대폰) */
  toolbar?: 'floating' | 'inline';
  className?: string;
}) {
  // 편집기 콜백은 만들 때 한 번 묶이므로 최신 함수를 ref 로 읽는다
  const handlers = useRef({ onChange, onSave, onCancel, onBlur });
  handlers.current = { onChange, onSave, onCancel, onBlur };
  const wrapRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: contentToEditorDoc(value),
    autofocus: 'end',
    editable: !disabled,
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        class: `workplan-rich-editor w-full outline-none ${className}`,
      },
      handleKeyDown: (_view, event) => {
        if (event.isComposing) return false;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          handlers.current.onCancel();
          return true;
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          handlers.current.onSave();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => handlers.current.onChange(editorDocToContent(ed.getJSON())),
    onBlur: () => handlers.current.onBlur?.(),
  });

  return (
    <div ref={wrapRef} className="w-full" onClick={(e) => e.stopPropagation()}>
      {toolbar === 'inline' && (
        <div className="mb-1.5">
          <MemoFormatToolbar editor={editor} size="md" />
        </div>
      )}
      <EditorContent editor={editor} />
      {toolbar === 'floating' && <FloatingToolbar anchor={wrapRef} editor={editor} />}
    </div>
  );
}

/** 화면 배율(body zoom, 설정의 글자 크기) — 실제 걸린 값을 읽는다(변수가 비어도 CSS 기본 1.48) */
function bodyScale(): number {
  const v = parseFloat(getComputedStyle(document.body).zoom);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** 좁은 칸 위에 띄우는 서식 버튼 — 표 칸이 넘치는 부분을 잘라도 보이게 화면 위(portal)에 그린다 */
function FloatingToolbar({ anchor, editor }: { anchor: React.RefObject<HTMLDivElement | null>; editor: Editor | null }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      // 화면 배율(body zoom) — 잰 자리는 배율이 곱해진 화면 px, fixed 좌표는 배율 전 px 라 나눠서 넣는다
      // (안 나누면 배율만큼 아래·오른쪽으로 밀려 화면 밖에 그려졌다)
      const scale = bodyScale();
      const r = el.getBoundingClientRect();
      const height = 34 * scale;
      const topPx = r.top - height - 4 < 8 ? r.bottom + 4 : r.top - height - 4;
      const leftPx = Math.max(8, Math.min(r.left, window.innerWidth - 260 * scale));
      setPos({ top: topPx / scale, left: leftPx / scale });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor]);

  if (!pos) return null;
  return createPortal(
    <div className="fixed z-[120]" style={{ top: pos.top, left: pos.left }}>
      <MemoFormatToolbar editor={editor} />
    </div>,
    document.body
  );
}
