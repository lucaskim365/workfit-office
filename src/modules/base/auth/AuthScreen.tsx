import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Select, type Option } from '@/shared/ui/FilterBar';

interface Member {
  name: string;
  code: string;
}
interface Group {
  code: string;
  name: string;
  members: Member[];
  desc: string;
}

const GROUPS: Group[] = [
  { code: 'ADMIN', name: '관리자 그룹', members: [{ name: '김승기', code: 'A12345' }, { name: '오태경', code: 'A67890' }], desc: '전사 시스템 관리 권한 그룹. 사용자/권한/코드 전 영역 접근 가능.' },
  { code: 'OPERATOR', name: '운영자 그룹', members: [{ name: '박민준', code: 'B10021' }], desc: '운영 모니터링 및 기준정보 조회 중심 권한.' },
  { code: 'FIELD_ADMIN', name: '현장관리자 그룹', members: [{ name: '임건우', code: 'C33012' }], desc: '현장 생산·실적 등록 및 설비 상태 제어 권한.' },
  { code: 'MT_ADMIN', name: '생산 관리자', members: [{ name: '문성민', code: 'D45100' }], desc: '생산계획·작업지시 관리 권한.' },
  { code: 'MT_USER', name: '생산 담당자 그룹', members: [{ name: '정하윤', code: 'D45221' }], desc: '생산 실적 입력 권한.' },
  { code: 'QC_USER', name: '품질 담당자 그룹', members: [{ name: '이서연', code: 'Q22013' }], desc: '품질 검사·판정 등록 권한.' },
];

const MENUS = ['시스템관리', '사용자관리', '그룹권한관리', '공통코드정보', '품목정보', '설비정보', '불량항목정보', '접속이력관리'];
const PERM_COLS = ['보기', '조회', '신규', '저장', '삭제', '엑셀'];
const USE_OPTIONS: Option[] = [
  { value: '사용', label: '사용' },
  { value: '미사용', label: '미사용' },
];

// 그룹별 권한 매트릭스 초기값 (MENUS × PERM_COLS)
const SEED: Record<string, boolean[][]> = {
  ADMIN: MENUS.map(() => PERM_COLS.map(() => true)),
  OPERATOR: MENUS.map((_, i) => PERM_COLS.map((_, c) => c < 2 || i < 2)),
  FIELD_ADMIN: MENUS.map((_, i) => PERM_COLS.map((_, c) => c < 4 && i > 1)),
  MT_ADMIN: MENUS.map(() => PERM_COLS.map((_, c) => c < 4)),
  MT_USER: MENUS.map(() => PERM_COLS.map((_, c) => c < 2)),
  QC_USER: MENUS.map((_, i) => PERM_COLS.map((_, c) => c < 3 && i > 3)),
};

function Check({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-[18px] w-[18px] place-items-center rounded border transition-colors ${
        on ? 'border-teal bg-teal' : 'border-border-hi bg-panel hover:border-teal'
      }`}
    >
      {on && (
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2 6.2l2.6 2.6L10 3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** 그룹권한관리 — 역할그룹 목록 + 상세 + 메뉴권한 매트릭스. 와이어프레임 sub-auth.jsx 정본. */
export default function AuthScreen() {
  const [selected, setSelected] = useState('ADMIN');
  const [matrix, setMatrix] = useState<Record<string, boolean[][]>>(SEED);
  const [search, setSearch] = useState('');

  const group = GROUPS.find((g) => g.code === selected) ?? GROUPS[0];
  const grid = matrix[selected];
  const filteredGroups = GROUPS.filter(
    (g) => !search || g.code.toLowerCase().includes(search.toLowerCase()) || g.name.includes(search),
  );

  const toggleCell = (mi: number, ci: number) => {
    setMatrix((prev) => {
      const next = prev[selected].map((row) => [...row]);
      next[mi][ci] = !next[mi][ci];
      return { ...prev, [selected]: next };
    });
  };
  const toggleRow = (mi: number) => {
    setMatrix((prev) => {
      const allOn = prev[selected][mi].every(Boolean);
      const next = prev[selected].map((row) => [...row]);
      next[mi] = next[mi].map(() => !allOn);
      return { ...prev, [selected]: next };
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">그룹권한관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 사용자·거래처</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '그룹 추가' }, 'save', 'download']} />
      </div>

      {/* 상단: 그룹 목록 + 상세 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[360px_1fr]">
        <Card title="역할그룹 목록" bodyClassName="p-0">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="역할그룹명·코드 검색"
              className="h-8 flex-1 rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredGroups.map((g) => {
              const on = g.code === selected;
              return (
                <button
                  key={g.code}
                  onClick={() => setSelected(g.code)}
                  style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}
                  className={`flex w-full items-center gap-2 border-b border-border px-4 py-3 text-left text-[12.5px] transition-colors ${
                    on ? 'bg-teal-soft' : 'hover:bg-panel-alt'
                  }`}
                >
                  <span className={`font-mono font-bold ${on ? 'text-teal' : 'text-ink'}`}>{g.code}</span>
                  <span className="text-[11.5px] text-ink3">({g.name})</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card
          title="상세정보"
          action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}
        >
          <div className="flex flex-col gap-3">
            <FieldRow label="역할그룹명" required>
              <div className="flex h-9 items-center rounded-md border border-border-hi bg-panel px-3.5 text-[12.5px] font-bold text-ink">
                {group.code}
              </div>
            </FieldRow>
            <FieldRow label="사용여부">
              <Select value="사용" onChange={() => {}} options={USE_OPTIONS} width={140} />
            </FieldRow>
            <FieldRow label="구성원">
              <div className="flex flex-wrap gap-2">
                {group.members.map((m) => (
                  <span
                    key={m.code}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#cfe0fb] bg-blue-soft py-1.5 pl-3 pr-2 text-[11.5px] font-semibold text-navy"
                  >
                    {m.name}
                    <span className="font-normal text-ink3">({m.code})</span>
                    <span className="grid h-4 w-4 place-items-center rounded-full border border-[#f3c6c1] bg-panel text-[10px] font-bold text-danger">
                      ×
                    </span>
                  </span>
                ))}
              </div>
            </FieldRow>
            <FieldRow label="비고" top>
              <div className="min-h-[56px] rounded-md border border-border-hi bg-panel px-3.5 py-2.5 text-[12px] leading-relaxed text-ink2">
                {group.desc}
              </div>
            </FieldRow>
          </div>
        </Card>
      </div>

      {/* 하단: 메뉴권한 매트릭스 */}
      <Card
        title="메뉴권한 목록"
        action={<ActionBar actions={[{ preset: 'save', label: '권한 저장', variant: 'primary' }]} />}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th className="w-11 border-r border-white/10 bg-navy px-2.5 py-2.5 text-center text-[10.5px] font-bold text-[#dfe6f2]">
                  전체
                </th>
                <th className="border-r border-white/10 bg-navy px-2.5 py-2.5 text-left text-[10.5px] font-bold text-[#dfe6f2]">
                  메뉴명
                </th>
                {PERM_COLS.map((c) => (
                  <th
                    key={c}
                    className="w-16 border-r border-white/10 bg-navy px-2.5 py-2.5 text-center text-[10.5px] font-bold text-[#dfe6f2]"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MENUS.map((menu, mi) => (
                <tr key={menu} className={mi % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-r border-border px-2.5 py-2 text-center">
                    <div className="flex justify-center">
                      <Check on={grid[mi].every(Boolean)} onClick={() => toggleRow(mi)} />
                    </div>
                  </td>
                  <td className="border-b border-r border-border px-2.5 py-2 font-bold text-ink">{menu}</td>
                  {grid[mi].map((on, ci) => (
                    <td key={ci} className="border-b border-r border-border px-2.5 py-2 text-center">
                      <div className="flex justify-center">
                        <Check on={on} onClick={() => toggleCell(mi, ci)} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function FieldRow({
  label,
  required,
  top,
  children,
}: {
  label: string;
  required?: boolean;
  top?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[92px_1fr] gap-3.5 ${top ? 'items-start' : 'items-center'}`}>
      <span className={`text-[12.5px] font-bold text-ink2 ${top ? 'pt-2' : ''}`}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
    </div>
  );
}
