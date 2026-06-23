import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { USERS, type User } from './mock';

const STATUS_TONE: Record<User['status'], Tone> = {
  활성: 'ok',
  휴직: 'mute',
  잠금: 'err',
};

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

/** 사용자관리 — 공통 DataTable 적용 검증 화면. */
export default function UserScreen() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Array<string | number>>([]);

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return USERS;
    return USERS.filter((u) =>
      [u.empNo, u.name, u.dept, u.role, u.email].some((v) => v.toLowerCase().includes(kw)),
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 페이지 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사용자관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 사용자·거래처</p>
        </div>
      </div>

      <Card
        title={`사용자 목록`}
        action={
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="사번·이름·부서·역할 검색"
              className="h-8 w-56 rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
            />
            <button className="h-8 rounded-md border border-border-hi bg-panel px-3 text-[11px] font-bold text-ink2 hover:bg-panel-alt">
              엑셀다운로드
            </button>
            <button className="h-8 rounded-md bg-navy px-3 text-[11px] font-bold text-white shadow-sm hover:opacity-95">
              + 사용자 추가
            </button>
          </div>
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
