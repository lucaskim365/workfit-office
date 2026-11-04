import type { LucideIcon } from 'lucide-react';
import { AlignLeft, Archive, CalendarCheck, Info, Landmark, ListOrdered, ImageIcon, Signature, Table2, Banknote, Building2, Calendar, CalendarRange, Eraser, Eye, FileDigit, Hash, Heading, List, ListChecks, Repeat, SquareCheck, Stamp, Type, User, UserRound, Users, CalendarDays } from 'lucide-react';
import type { CellRange, Sheet, SheetSelection } from '@/lib/sheet';
import {
  APPROVAL_NS,
  BIND_GROUPS,
  CELL_INPUT_LABELS,
  approvalCellProps,
  setApprovalProp,
  type ApprovalCellProps,
  type CellInputType,
} from '@/modules/gw/approval/sheetForm/approvalSheet';
import { repeatSectionAt, setRepeatSection } from '@/modules/gw/approval/sheetForm/repeatRows';
import { DEFAULT_AUTO_NUMBER } from '@/domain/approvalForm/autoNumber';

/**
 * 부품 목록 — 다우오피스 양식 편집기처럼 칸에 넣을 부품을 왼쪽에 모아 둔다.
 * 칸을 고르고 부품을 누르거나, 부품을 칸으로 끌어다 놓는다.
 * 하는 일은 오른쪽 '칸 속성'의 입력 칸·자동 채우기·직인·반복 구간과 같다(같은 저장 형식).
 */

/** 끌어 놓기 데이터 종류 */
export const PART_MIME = 'application/x-workfit-sheet-part';

type Result = Sheet | { notice: string };

interface Part {
  id: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  apply: (s: Sheet, range: CellRange) => Result;
  active?: (p: ApprovalCellProps) => boolean;
  /** 넣은 부품 빼기 — 같은 부품을 다시 누를 때 */
  remove?: (s: Sheet, range: CellRange) => Sheet;
}

const INPUT_ICONS: Record<CellInputType, LucideIcon> = {
  text: Type,
  multiline: AlignLeft,
  number: Hash,
  currency: Banknote,
  date: Calendar,
  dateRange: CalendarRange,
  select: List,
  multiSelect: ListChecks,
  checkbox: SquareCheck,
  user: User,
  users: Users,
  dept: Building2,
};

const INPUT_HINTS: Partial<Record<CellInputType, string>> = {
  select: '고를 항목은 오른쪽 칸 속성에서 한 줄에 하나씩 적습니다',
  multiSelect: '고를 항목은 오른쪽 칸 속성에서 한 줄에 하나씩 적습니다',
  user: '임직원 검색 창으로 사람을 고릅니다(이름과 함께 사람 ID 저장)',
  users: '임직원 검색 창으로 여러 명을 고릅니다(참석자·동행자 등) — 업무 대행자처럼 한 사람만 받는 연동 칸에는 [사람]을',
  dateRange: '달력에서 시작~끝 날짜를 고릅니다',
};

const BIND_ICONS: Record<string, LucideIcon> = {
  'draft.drafter': UserRound,
  'draft.dept': Users,
  'draft.date': CalendarDays,
  'draft.docNo': FileDigit,
  'draft.completedDate': CalendarCheck,
  'doc.title': Heading,
  'doc.formTitle': Type,
  'doc.approvalLine': Table2,
  'doc.logo': ImageIcon,
  'draft.sign': Signature,
  'doc.letterhead': Landmark,
  'doc.preservation': Archive,
  'doc.visibility': Eye,
};

const DOC_HINTS: Record<string, string> = {
  'doc.formTitle': '큰 제목 — 위 \'격식 문서명\'(비면 서식명)이 저절로 들어갑니다(문서 머리 큰 제목과 같음)',
  'doc.approvalLine': '결재자 이름·도장 칸 — 결재선에 따라 칸 수가 바뀌고, 기안 화면에서 누르면 결재선을 고칩니다. 넓게 합친 칸에 두세요. 시트에 결재란이 있으면 문서 머리 전체가 빠집니다',
  'doc.logo': '회사 로고 그림',
  'doc.letterhead': '회사 주소·사업장 주소·전화·팩스·홈페이지·이메일 머리글 — 회사 정보 화면의 값이 저절로(기존 서식 \'회사정보\'와 같음)',
  'draft.sign': '맺음말 아래 \'기안자 이름 (인)\' — 기안자 도장이나 서명',
  'draft.completedDate': '결재가 끝난 날짜를 채웁니다(작성·결재 중엔 비어 있음). 문서 머리의 결재 완료일은 빠집니다',
  'doc.title': '기안자가 여기서 문서 제목을 씁니다(필수, 문서 목록·검색에 쓰는 제목). 문서 머리의 제목 줄은 빠집니다',
  'doc.preservation': '기안자가 여기서 보존연한을 고릅니다. 문서 머리의 보존연한은 빠집니다',
  'doc.visibility': '기안자가 여기서 공개범위를 고릅니다. 문서 머리의 공개범위는 빠집니다',
};

const cellsOf = (s: Sheet, g: CellRange) => {
  const out: { r: number; c: number }[] = [];
  for (let r = Math.min(g.r1, g.r2); r <= Math.max(g.r1, g.r2); r++) for (let c = Math.min(g.c1, g.c2); c <= Math.max(g.c1, g.c2); c++) if (s.cols[c] !== undefined) out.push({ r, c });
  return out;
};
const hasFormula = (s: Sheet, g: CellRange) => cellsOf(s, g).some(({ r, c }) => s.formulas[`${r}:${s.cols[c]}`] !== undefined);

/** 입력 부품 — 자동 채우기와는 함께 두지 않는다(자동 칸은 기안자가 쓰지 않음) */
const inputPart = (type: CellInputType): Part => ({
  id: `input.${type}`,
  label: CELL_INPUT_LABELS[type],
  icon: INPUT_ICONS[type],
  hint: INPUT_HINTS[type] ?? `기안자가 ${CELL_INPUT_LABELS[type]} 값을 씁니다`,
  apply: (s, g) => {
    if (hasFormula(s, g)) return { notice: '수식 칸에는 입력 부품을 넣을 수 없습니다(기안자가 쓰면 수식이 지워짐).' };
    const keep = type === 'select' || type === 'multiSelect' ? { options: approvalCellProps(s, g.r1, g.c1).input?.options ?? [] } : {};
    return setApprovalProp(setApprovalProp(s, g, APPROVAL_NS.bind, undefined), g, APPROVAL_NS.input, { type, ...keep });
  },
  active: (p) => p.input?.type === type,
  remove: (s, g) => setApprovalProp(s, g, APPROVAL_NS.input, undefined),
});

const bindPart = (value: string, label: string): Part => ({
  id: `bind.${value}`,
  label,
  icon: BIND_ICONS[value] ?? FileDigit,
  hint: DOC_HINTS[value] ?? `작성할 때·문서를 볼 때 ${label}을(를) 자동으로 채웁니다(기안자가 고칠 수 없음). 문서 머리의 같은 항목은 빠집니다`,
  apply: (s, g) => setApprovalProp(setApprovalProp(s, g, APPROVAL_NS.input, undefined), g, APPROVAL_NS.bind, value),
  active: (p) => p.bind === value,
  remove: (s, g) => setApprovalProp(s, g, APPROVAL_NS.bind, undefined),
});

export const PART_GROUPS: { label: string; parts: Part[] }[] = [
  // 묶음 이름은 아래 '칸 속성'과 같게 — 입력 칸 / 자동 채우기 / 문서 항목
  { label: '입력 칸', parts: (Object.keys(CELL_INPUT_LABELS) as CellInputType[]).map(inputPart) },
  { label: '자동 채우기', parts: (BIND_GROUPS.find((g) => g.label === '기안 정보')?.items ?? []).map((i) => bindPart(i.value, i.label)) },
  { label: '문서 항목', parts: (BIND_GROUPS.find((g) => g.label === '문서 항목')?.items ?? []).map((i) => bindPart(i.value, i.label)) },
  { label: '문서 머리', parts: (BIND_GROUPS.find((g) => g.label === '문서 머리')?.items ?? []).map((i) => bindPart(i.value, i.label)) },
  {
    label: '기타',
    parts: [
      {
        id: 'seal',
        label: '회사 직인',
        icon: Stamp,
        hint: '결재가 끝나면 이 칸에 회사 직인을 찍습니다',
        apply: (s, g) => setApprovalProp(s, g, APPROVAL_NS.seal, true),
        active: (p) => p.seal,
        remove: (s, g) => setApprovalProp(s, g, APPROVAL_NS.seal, false),
      },
      {
        id: 'autoNo',
        label: '자동번호',
        icon: ListOrdered,
        hint: "상신할 때 서식 규칙(접두어·날짜·자릿수·초기화 주기)으로 번호를 매깁니다 — 번호 모양은 오른쪽 칸 속성에서(기존 서식 '자동번호'와 같음)",
        apply: (s, g) => {
          if (hasFormula(s, g)) return { notice: '수식 칸에는 자동번호를 넣을 수 없습니다.' };
          const at = { r1: Math.min(g.r1, g.r2), r2: Math.min(g.r1, g.r2), c1: Math.min(g.c1, g.c2), c2: Math.min(g.c1, g.c2) };
          const cleared = setApprovalProp(setApprovalProp(s, at, APPROVAL_NS.input, undefined), at, APPROVAL_NS.bind, undefined);
          return setApprovalProp(cleared, at, APPROVAL_NS.autoNo, DEFAULT_AUTO_NUMBER);
        },
        active: (p) => !!p.autoNo,
        remove: (s, g) => setApprovalProp(s, g, APPROVAL_NS.autoNo, undefined),
      },
      {
        id: 'guide',
        label: '안내문',
        icon: Info,
        hint: '칸에 쓴 글을 작성 화면에만 흐리게 보입니다(결재·인쇄 화면엔 안 나옴) — 작성 요령 안내용(기존 서식 \'안내문\'과 같음)',
        apply: (s, g) => setApprovalProp(setApprovalProp(s, g, APPROVAL_NS.input, undefined), g, APPROVAL_NS.guide, true),
        active: (p) => p.guide,
        remove: (s, g) => setApprovalProp(s, g, APPROVAL_NS.guide, false),
      },
      {
        id: 'repeat',
        label: '반복 구간',
        icon: Repeat,
        hint: '고른 행을 기안자가 [행 추가]·[행 삭제]로 늘이고 줄이는 구간으로(이름은 오른쪽 칸 속성에서)',
        apply: (s, g) => {
          const r1 = Math.min(g.r1, g.r2);
          const r2 = Math.max(g.r1, g.r2);
          for (let r = r1; r <= r2; r++) if (repeatSectionAt(s, r)) return { notice: '이미 반복 구간인 행이 있습니다 — 오른쪽 칸 속성에서 해제한 뒤 다시 지정하세요.' };
          return setRepeatSection(s, r1, r2, '반복 구간');
        },
      },
      {
        id: 'clear',
        label: '부품 빼기',
        icon: Eraser,
        hint: '고른 칸의 입력 칸·자동 채우기·문서 항목·직인·자동번호·안내문을 뺍니다(글자·서식은 그대로)',
        apply: (s, g) =>
          [APPROVAL_NS.input, APPROVAL_NS.bind, APPROVAL_NS.seal, APPROVAL_NS.sealMark, APPROVAL_NS.autoNo, APPROVAL_NS.guide].reduce(
            (acc, ns) => setApprovalProp(acc, g, ns, undefined),
            s,
          ),
      },
    ],
  },
];

const PARTS = new Map(PART_GROUPS.flatMap((g) => g.parts).map((p) => [p.id, p]));

/**
 * 부품 넣기 — 바뀐 시트, 또는 막힌 이유.
 * toggle: 고른 칸(범위 첫 칸)에 이미 그 부품이 있으면 뺀다(부품 목록에서 다시 누를 때). 끌어 놓기는 늘 넣기
 */
export function applyPart(s: Sheet, range: CellRange, id: string, toggle = false): Result {
  const part = PARTS.get(id);
  if (!part) return s;
  const first = approvalCellProps(s, Math.min(range.r1, range.r2), Math.min(range.c1, range.c2));
  if (toggle && part.remove && part.active?.(first)) return part.remove(s, range);
  return part.apply(s, range);
}

export function SheetPalette({
  sheet,
  selection,
  onApply,
}: {
  sheet: Sheet;
  selection: SheetSelection;
  /** 부품 id 와 넣을 범위 — 넣기·빼기·알림은 쓰는 쪽에서(누르기는 toggle: 이미 있으면 뺀다) */
  onApply: (id: string, range: CellRange, toggle?: boolean) => void;
}) {
  const props = approvalCellProps(sheet, selection.focus.r, selection.focus.c);
  return (
    <div className="space-y-2">
      <div className="text-[10.5px] leading-snug text-ink3">칸을 고르고 누르거나, 칸으로 끌어다 놓으세요. 넣은 부품(초록)을 다시 누르면 뺍니다.</div>
      {PART_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="mb-1 text-[10.5px] font-bold text-ink3">{g.label}</div>
          <div className="grid grid-cols-4 gap-1">
            {g.parts.map((p) => {
              const on = p.active?.(props) ?? false;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PART_MIME, p.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onApply(p.id, selection.range, true)}
                  title={on && p.remove ? `${p.hint} — 다시 누르면 뺍니다` : p.hint}
                  className={`flex cursor-grab flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1 text-[10px] font-semibold leading-tight active:cursor-grabbing ${
                    on ? 'border-teal bg-teal-soft text-teal' : 'border-border bg-panel-alt/60 text-ink2 hover:border-teal/60 hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-center">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
