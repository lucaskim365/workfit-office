/** 표 도구 막대 — 커서가 표 안에 있을 때 나온다(행·열·합치기, 칸 색·세로 맞춤·행 높이·테두리) */
import type { Editor } from '@tiptap/react';
import { Btn, Palette, Popover, SELECT_CLS, Sep, Swatches, closePopover } from './controls';
import { addColumnKeepWidth, setCellBorders, setRowHeight, type CellVAlign } from './cell';
import type { CellBorder, CellBorders } from './format';

const CELL_COLORS = ['#1f2d50', '#2b4c7e', '#dde7f5', '#eaf0fa', '#f5f7fa', '#f2f2f2', '#d9d9d9', '#fff2cc', '#e2efda', '#fce4d6'];
const ROW_HEIGHTS = [24, 32, 40, 48, 60, 80];
const LINE_COLORS = ['#000000', '#595959', '#808080', '#999999', '#bfbfbf', '#1f2d50', '#1d4ed8', '#2b8a3e', '#c62828', '#d9480f'];
/** 선 모양 — 색은 지금 칸 선 색을 이어 쓴다 */
const LINE_STYLES: { label: string; make: (color: string) => CellBorder | null }[] = [
  { label: '기본 선', make: () => null },
  { label: '가는 실선', make: (color) => ({ style: 'solid', width: 1, color }) },
  { label: '굵은 실선', make: (color) => ({ style: 'solid', width: 2, color }) },
  { label: '이중선', make: (color) => ({ style: 'double', width: 3, color }) },
  { label: '점선', make: (color) => ({ style: 'dashed', width: 1, color }) },
  { label: '선 없음', make: () => ({ style: 'none', width: 0, color: '#000000' }) },
];

export function TableBar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const cell = (editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell')) as {
    background?: string | null;
    verticalAlign?: CellVAlign | null;
    borders?: CellBorders | null;
  };
  const rowHeight = Number(editor.getAttributes('tableRow').height) || 0;
  const valign = cell.verticalAlign ?? 'top';
  const line = cell.borders?.top;
  const lineColor = line && line.style !== 'none' ? line.color : '#808080';
  const setBorders = (b: CellBorder | null) => setCellBorders(editor, b);

  return (
    <div className="mt-1 flex w-full flex-wrap items-center gap-0.5 border-t border-[#eef1f5] pt-1">
      <span className="mr-1 text-[11.5px] font-bold text-[#56607a]">표</span>
      <Btn title="위에 행 넣기" onClick={() => c().addRowBefore().run()}>↑행</Btn>
      <Btn title="아래에 행 넣기" onClick={() => c().addRowAfter().run()}>↓행</Btn>
      <Btn title="왼쪽에 열 넣기" onClick={() => addColumnKeepWidth(editor, 'before')}>←열</Btn>
      <Btn title="오른쪽에 열 넣기" onClick={() => addColumnKeepWidth(editor, 'after')}>→열</Btn>
      <Btn title="행 지우기" onClick={() => c().deleteRow().run()}>행 삭제</Btn>
      <Btn title="열 지우기" onClick={() => c().deleteColumn().run()}>열 삭제</Btn>
      <Sep />
      <Btn title="칸 합치기(여러 칸을 끌어 고른 뒤)" onClick={() => c().mergeCells().run()} disabled={!editor.can().mergeCells()}>합치기</Btn>
      <Btn title="칸 나누기" onClick={() => c().splitCell().run()} disabled={!editor.can().splitCell()}>나누기</Btn>
      <Btn title="머리 행(첫 줄 강조) 켜고 끄기" onClick={() => c().toggleHeaderRow().run()}>머리 행</Btn>
      <Sep />
      <Palette
        title="칸 색(고른 칸들)"
        colors={CELL_COLORS}
        current={cell.background}
        onPick={(v) => c().setCellAttribute('background', v).run()}
        face={
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-[#b8c2d4]" style={{ background: cell.background ?? '#fff' }} />칸 색
          </span>
        }
      />
      {(
        [
          ['top', '위', '칸 글 위로'],
          ['middle', '가운데', '칸 글 세로 가운데'],
          ['bottom', '아래', '칸 글 아래로'],
        ] as const
      ).map(([v, label, title]) => (
        <Btn key={v} title={title} on={valign === v} onClick={() => c().setCellAttribute('verticalAlign', v === 'top' ? null : v).run()}>
          {label}
        </Btn>
      ))}
      <select
        className={`${SELECT_CLS} ml-0.5`}
        title="행 높이(최소, 글이 많으면 늘어남)"
        value={rowHeight ? String(rowHeight) : ''}
        onChange={(e) => setRowHeight(editor, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">행 높이: 자동</option>
        {[...new Set([...ROW_HEIGHTS, ...(rowHeight ? [rowHeight] : [])])]
          .sort((a, b) => a - b)
          .map((h) => (
            <option key={h} value={h}>
              행 높이: {h}px
            </option>
          ))}
      </select>
      <Popover title="테두리(고른 칸들)" width={168} face={<span style={{ borderBottom: `2px solid ${lineColor}` }}>테두리</span>}>
        <div className="flex flex-col gap-0.5">
          {LINE_STYLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                setBorders(s.make(lineColor));
                closePopover(e.currentTarget);
              }}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] text-[#333] hover:bg-[#eef1f5]"
            >
              <span className="inline-block w-8" style={{ borderTop: previewLine(s.make(lineColor)) }} />
              {s.label}
            </button>
          ))}
        </div>
        <div className="mb-1 mt-2 text-[11px] font-bold text-[#56607a]">선 색</div>
        <Swatches
          colors={LINE_COLORS}
          current={line && line.style !== 'none' ? line.color : null}
          noneLabel={null}
          onPick={(col) => col && setBorders(line && line.style !== 'none' ? { ...line, color: col } : { style: 'solid', width: 1, color: col })}
        />
      </Popover>
      <Sep />
      <Btn title="표 지우기" onClick={() => c().deleteTable().run()}>표 삭제</Btn>
    </div>
  );
}

/** 선 모양 미리보기 */
function previewLine(b: CellBorder | null): string {
  if (!b) return '1px solid #808080';
  if (b.style === 'none') return '1px dotted #d4dbe7';
  return `${b.style === 'double' ? 3 : b.width}px ${b.style} ${b.color}`;
}
