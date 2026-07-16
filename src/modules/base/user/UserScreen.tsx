import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { ROLE_GROUPS, type User } from '@/domain/user/schema';
import { useUsers, useUpsertUser, useRemoveUsers } from '@/features/user/useUsers';
import UserFormModal, { type UserFormValues } from './UserFormModal';

const STATUS_TONE: Record<User['status'], Tone> = { 사용: 'ok', 잠금: 'warn', 미사용: 'mute' };

const STATUS_OPTIONS: Option[] = [
  { value: '', label: '전체' },
  { value: '사용', label: '사용' },
  { value: '잠금', label: '잠금' },
  { value: '미사용', label: '미사용' },
];
const ROLE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...ROLE_GROUPS.map((r) => ({ value: r, label: r }))];

/** 사용자관리 — 필터 + KPI 요약 + 목록(직급·직책·권한그룹) + CRUD. 와이어프레임 admin-screens.UserMgmtContent 정본. */
export default function UserScreen() {
  const [draft, setDraft] = useState({ dept: '', roleGroup: '', status: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);

  const { data: all = [] } = useUsers();
  const { data: rows = [] } = useUsers(applied);
  const upsert = useUpsertUser();
  const removeUsers = useRemoveUsers();

  const deptOptions: Option[] = [
    { value: '', label: '전체' },
    ...[...new Set(all.map((u) => u.dept))].map((d) => ({ value: d, label: d })),
  ];

  const summary = useMemo(
    () => ({
      total: all.length,
      active: all.filter((u) => u.status === '사용').length,
      locked: all.filter((u) => u.status === '잠금').length,
      inactive: all.filter((u) => u.status === '미사용').length,
    }),
    [all],
  );

  const columns: Column<User>[] = [
    { key: 'empNo', header: '사번', mono: true, sortable: true, width: 100 },
    { key: 'name', header: '이름', sortable: true, width: 90 },
    { key: 'dept', header: '부서', sortable: true },
    {
      key: 'position',
      header: '직급',
      sortable: true,
      width: 84,
      sortAccessor: (u) => {
        const order: Record<string, number> = {
          '대표이사': 1,
          '대표': 1,
          '사장': 2,
          '부사장': 3,
          '전무': 4,
          '전무이사': 4,
          '상무': 5,
          '상무이사': 5,
          '이사': 6,
          '부장': 7,
          '차장': 8,
          '과장': 9,
          '대리': 10,
          '주임': 11,
          '사원': 12,
        };
        return order[u.position] ?? 99;
      },
    },
    {
      key: 'jobTitle',
      header: '직책',
      sortable: true,
      width: 84,
      sortAccessor: (u) => {
        const order: Record<string, number> = {
          '대표이사': 1,
          '대표': 1,
          '사장': 2,
          '재경이사': 3,
          '본부장': 4,
          '부본부장': 5,
          '팀장': 6,
          '부팀장': 7,
          '팀원': 8,
          '사원': 8,
        };
        return u.jobTitle ? (order[u.jobTitle] ?? 90) : 99;
      },
      render: (u) => (u.jobTitle ? u.jobTitle : <span className="text-ink3">—</span>),
    },
    {
      key: 'roleGroup',
      header: '권한그룹',
      sortable: true,
      width: 130,
      render: (u) => (
        <span className="rounded-md bg-blue-soft px-2 py-1 text-[10.5px] font-bold text-navy">
          {u.roleGroup}
        </span>
      ),
    },
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
    upsert.mutate({ values, id });
  };
  const handleDelete = () => {
    if (selected.length === 0) return;
    removeUsers.mutate(selected);
    setSelected([]);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사용자관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 사용자관리</p>
        </div>
        <ActionBar actions={['refresh', 'upload', 'download']} />
      </div>

      {/* 필터 */}
      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="부서">
          <Select value={draft.dept} onChange={(v) => setDraft({ ...draft, dept: v })} options={deptOptions} width={130} />
        </FilterField>
        <FilterField label="권한그룹">
          <Select value={draft.roleGroup} onChange={(v) => setDraft({ ...draft, roleGroup: v })} options={ROLE_OPTIONS} width={130} />
        </FilterField>
        <FilterField label="사용여부">
          <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={STATUS_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="사번 / 이름" width={180} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      {/* KPI 요약 */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="전체 사용자" value={String(summary.total)} unit="명" /></Card>
        <Card><Kpi label="사용중" value={String(summary.active)} unit="명" tone="teal" /></Card>
        <Card><Kpi label="잠금" value={String(summary.locked)} unit="명" /></Card>
        <Card><Kpi label="미사용" value={String(summary.inactive)} unit="명" /></Card>
      </div>

      {/* 목록 */}
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
            <button className="font-semibold underline-offset-2 hover:underline" onClick={() => setSelected([])}>
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
        onClose={() => setEditing(undefined)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
