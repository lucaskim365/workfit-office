import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { USERS, type User } from './mock';
import UserFormModal, { type UserFormValues } from './UserFormModal';

const STATUS_TONE: Record<User['status'], Tone> = {
  활성: 'ok',
  휴직: 'mute',
  잠금: 'err',
};

const STATUS_OPTIONS: Option[] = [
  { value: '', label: '전체 상태' },
  { value: '활성', label: '활성' },
  { value: '휴직', label: '휴직' },
  { value: '잠금', label: '잠금' },
];

/** 사용자관리 — FilterBar / ActionBar / DataTable / Modal(RHF+Zod) 통합 화면. */
export default function UserScreen() {
  const [list, setList] = useState<User[]>(USERS);
  const [draft, setDraft] = useState({ dept: '', status: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState<Array<string | number>>([]);

  // 모달: editing === undefined(닫힘) / null(추가) / User(수정)
  const [editing, setEditing] = useState<User | null | undefined>(undefined);

  const deptOptions = useMemo(() => [...new Set(list.map((u) => u.dept))], [list]);
  const deptFilterOptions: Option[] = [
    { value: '', label: '전체 부서' },
    ...deptOptions.map((d) => ({ value: d, label: d })),
  ];

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return list.filter(
      (u) =>
        (!applied.dept || u.dept === applied.dept) &&
        (!applied.status || u.status === applied.status) &&
        (!kw ||
          [u.empNo, u.name, u.dept, u.role, u.email].some((v) => v.toLowerCase().includes(kw))),
    );
  }, [list, applied]);

  const columns: Column<User>[] = [
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

  const handleSubmit = (values: UserFormValues, id?: string) => {
    if (id) {
      setList((prev) => prev.map((u) => (u.id === id ? { ...u, ...values } : u)));
    } else {
      const newUser: User = { id: `U${Date.now()}`, lastLogin: '-', ...values };
      setList((prev) => [newUser, ...prev]);
    }
  };

  const handleDelete = () => {
    if (selected.length === 0) return;
    setList((prev) => prev.filter((u) => !selected.includes(u.id)));
    setSelected([]);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사용자관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 사용자·거래처</p>
        </div>
        <ActionBar actions={['refresh', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="부서">
          <Select
            value={draft.dept}
            onChange={(v) => setDraft({ ...draft, dept: v })}
            options={deptFilterOptions}
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

      <Card
        title="사용자 목록"
        action={
          <ActionBar
            actions={[
              { preset: 'delete', onClick: handleDelete, disabled: selected.length === 0 },
              { preset: 'add', label: '사용자 추가', variant: 'primary', onClick: () => setEditing(null) },
            ]}
          />
        }
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
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          pageSize={10}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRowClick={(u) => setEditing(u)}
        />
      </Card>

      <UserFormModal
        open={editing !== undefined}
        initial={editing}
        deptOptions={deptOptions}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
