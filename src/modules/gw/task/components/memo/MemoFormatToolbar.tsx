import { useEffect, useRef, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { CheckSquare, Bold, Italic, Underline, Strikethrough, Highlighter, Palette, ChevronDown } from 'lucide-react';
import { WORK_PLAN_COLORS, WORK_PLAN_COLOR_LABELS, type WorkPlanColor } from '@/domain/workPlan/richText';

const COLOR_NAMES = Object.keys(WORK_PLAN_COLORS) as WorkPlanColor[];

/** 버튼을 눌러도 편집기 포커스를 뺏지 않는다 — 메모는 칸 밖을 누르면(포커스가 빠지면) 저장되기 때문 */
const keepFocus = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

/**
 * 메모 서식 버튼 — 체크박스·굵게·기울임·밑줄·취소선·형광펜·글자색.
 * 예전 업무계획 칸 편집기의 서식 버튼(2026-10 개편 때 지움)을 메모용으로 되살린 것.
 * 글자색은 저장 표기(`{red}…{/}`)로 되돌릴 수 있는 정해진 색만 고르게 한다.
 */
export function MemoFormatToolbar({ editor, size = 'sm' }: { editor: Editor | null; size?: 'sm' | 'md' }) {
  const [showColors, setShowColors] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      task: ed?.isActive('taskItem') ?? false,
      bold: ed?.isActive('bold') ?? false,
      italic: ed?.isActive('italic') ?? false,
      underline: ed?.isActive('underline') ?? false,
      strike: ed?.isActive('strike') ?? false,
      highlight: ed?.isActive('highlight') ?? false,
      color: (ed?.getAttributes('textStyle').color as string | undefined) ?? null,
    }),
  });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) setShowColors(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const disabled = !editor;
  const buttons = [
    // 현재 줄(여러 줄 선택 시 선택한 줄 전부)을 체크박스 ↔ 일반 줄로 전환
    { key: 'task', label: '체크박스 (Ctrl+Shift+9)', icon: CheckSquare, active: state?.task, run: () => editor?.chain().focus().toggleTaskList().run() },
    { key: 'bold', label: '굵게 (Ctrl+B)', icon: Bold, active: state?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', label: '기울임 (Ctrl+I)', icon: Italic, active: state?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'underline', label: '밑줄 (Ctrl+U)', icon: Underline, active: state?.underline, run: () => editor?.chain().focus().toggleUnderline().run() },
    { key: 'strike', label: '취소선 (Ctrl+Shift+S)', icon: Strikethrough, active: state?.strike, run: () => editor?.chain().focus().toggleStrike().run() },
    { key: 'highlight', label: '형광펜 (Ctrl+Shift+H)', icon: Highlighter, active: state?.highlight, run: () => editor?.chain().focus().toggleHighlight().run() },
  ];

  const currentColor = COLOR_NAMES.find((name) => WORK_PLAN_COLORS[name] === state?.color?.toLowerCase());
  const box = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  const icon = size === 'md' ? 16 : 13;

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border bg-panel p-0.5 shadow-md"
      onMouseDown={keepFocus}
      onClick={(e) => e.stopPropagation()}
    >
      {buttons.map(({ key, label, icon: Icon, active, run }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={run}
          title={label}
          aria-label={label}
          aria-pressed={Boolean(active)}
          className={`grid ${box} place-items-center rounded-md transition-colors disabled:opacity-40 ${
            active ? 'bg-teal text-white' : 'text-ink2 hover:bg-panel-alt'
          }`}
        >
          <Icon size={icon} strokeWidth={2.4} />
        </button>
      ))}

      <div className="relative" ref={colorMenuRef}>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => setShowColors((prev) => !prev)}
          title="글자색"
          aria-label="글자색"
          className={`flex ${size === 'md' ? 'h-8' : 'h-6'} items-center gap-0.5 rounded-md px-1 text-ink2 hover:bg-panel-alt disabled:opacity-40`}
        >
          <Palette size={icon} style={currentColor ? { color: WORK_PLAN_COLORS[currentColor] } : undefined} />
          <ChevronDown size={10} />
        </button>
        {showColors && (
          <div className="absolute right-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-border bg-panel p-1.5 shadow-lg">
            {COLOR_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => {
                  editor?.chain().focus().setColor(WORK_PLAN_COLORS[name]).run();
                  setShowColors(false);
                }}
                title={WORK_PLAN_COLOR_LABELS[name]}
                aria-label={WORK_PLAN_COLOR_LABELS[name]}
                className={`h-5 w-5 rounded-full border-2 ${currentColor === name ? 'border-ink' : 'border-transparent'}`}
                style={{ backgroundColor: WORK_PLAN_COLORS[name] }}
              />
            ))}
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => {
                editor?.chain().focus().unsetColor().run();
                setShowColors(false);
              }}
              className="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink2 hover:bg-panel-alt"
            >
              기본
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
