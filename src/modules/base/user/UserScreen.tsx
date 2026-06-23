import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { USERS, type User } from './mock';

const STATUS_TONE: Record<User['status'], Tone> = {
  활성: 'ok',
  휴직: 'mute',
  잠금: 'err',
};

const DEPT_OPTIONS: Option[] = [
  { value: '', label: '전체 부서' },
  ...[...new Set(USERS.map((u) => u.dept))].map((d) => ({ value: d, label: d })),
];

const STATUS_OPTIONS: Option[] = [
  { value: '', label: '전체 상태' },
  { value: '활성', label: '활성' },
  { value: '휴직', label: '휴직' },
  { value: '잠금', label: '잠금' },
];

const COLUMNS: Column<User>[] = [
  { key: 'empNo', header: '사번', mono: true, sortable: true, width: 110 },
  { key: 'name', header: '이름', sortable: true, width: 90 },
  { key: 'dept', header: '부서', sortable: true },
  { key: 'role', header: '역할', sortable: true },
  { key: 'email', header: '이메일' },
  {
    key: 'status',
    header: '상태',
    align: 'center',
    sortable: true,
    width: 80,
    render: (u) => (
      <Pill tone={STATUS_TONE[u.status]} solid={u.status === '잠금'}>
        {u.status}
      </Pill>
    ),
  },
  { key: 'lastLogin', header: '최근 접속', align: 'right', mono: true, sortable: true, width: 140 },
];

/** 사용자관리 — 공통 FilterBar / ActionBar / DataTable 적용 화면. */
export default function UserScreen() {
  // 입력 중 필터(draft) → '조회' 시 적용(applied) 패턴
  const [draft, setDraft] = useState({ dept: '', status: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState<Array<string | number>>([]);

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return USERS.filter(
      (u) =>
        (!applied.dept || u.dept === applied.dept) &&
        (!applied.status || u.status === applied.status) &&
        (!kw || [u.empNo, u.name, u.dept, u.role, u.email].some((v) => v.toLowerCase().includes(kw))),
    );
  }, [applied]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사용자관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 사용자·거래처</p>
        </div>
        <ActionBar actions={['refresh', 'upload', 'download']} />
      </div>

      {/* 필터 바 */}
      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="부서">
          <Select
            value={draft.dept}
            onChange={(v) => setDraft({ ...draft, dept: v })}
            options={DEPT_OPTIONS}
            width={140}
          />
        </FilterField>
        <FilterField label="상태">
          <Select
            value={draft.status}
            onChange={(v) => setDraft({ ...draft, status: v })}
            options={STATUS_OPTIONS}
            width={110}
          />
        </FilterField>
        <FilterField label="검색어">
          <TextInput
            value={draft.q}
            onChange={(v) => setDraft({ ...draft, q: v })}
            placeholder="사번·이름·역할·이메일"
            width={220}
            onEnter={() => setApplied(draft)}
          />
        </FilterField>
      </FilterBar>

      {/* 목록 */}
      <Card
        title="사용자 목록"
        action={<ActionBar actions={[{ preset: 'add', label: '사용자 추가', variant: 'primary' }, 'delete']} />}
        bodyClassName="p-3"
      >
        {selected.length > 0 && (
          <div className="mb-2 flex items-center gap-3 rounded-md bg-teal-soft px-3 py-2 text-[11.5px] text-navy">
            <b>{selected.length}</b>명 선택됨
            <button
              className="font-semibold underline-offset-2 hover:underline"
              onClick={() => setSelected([])}
            >
              선택 해제
            </button>
          </div>
        )}
        <DataTable<User>
          columns={COLUMNS}
          rows={rows}
          rowKey={(u) => u.id}
          pageSize={10}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
        />
      </Card>
    </div>
  );
}
