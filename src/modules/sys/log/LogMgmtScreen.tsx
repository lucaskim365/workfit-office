import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';

interface Log {
  at: string;
  user: string;
  type: '접속' | '변경';
  screen: string;
  detail: string;
  ip: string;
}

const LOGS: Log[] = [
  { at: '2026-06-09 14:22:11', user: 'A12345 홍길동', type: '변경', screen: '품목정보', detail: 'UPDATE · WF-200-A 안전재고 500→600', ip: '10.20.3.14' },
  { at: '2026-06-09 14:08:55', user: 'B22120 이순신', type: '접속', screen: '로그인', detail: 'LOGIN SUCCESS', ip: '10.20.3.51' },
  { at: '2026-06-09 13:51:02', user: 'A67890 김철수', type: '변경', screen: '작업 지시', detail: 'INSERT · WO-20260609-022', ip: '10.20.3.22' },
  { at: '2026-06-09 13:30:40', user: 'C77201 유관순', type: '접속', screen: '로그아웃', detail: 'LOGOUT', ip: '10.20.3.77' },
  { at: '2026-06-09 12:47:18', user: 'A12345 홍길동', type: '변경', screen: '그룹권한관리', detail: 'UPDATE · ADMIN 권한 수정', ip: '10.20.3.14' },
  { at: '2026-06-09 11:20:33', user: 'B53410 강감찬', type: '접속', screen: '로그인 실패', detail: 'LOGIN FAIL (비밀번호 오류)', ip: '10.20.3.99' },
];

const TONE: Record<Log['type'], Tone> = { 접속: 'info', 변경: 'warn' };
const TYPE_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '접속', label: '접속' }, { value: '변경', label: '변경' }];

/** 로그 관리 — 접속·변경 이력. 와이어프레임 sys-screens.LogMgmtContent 정본. */
export default function LogMgmtScreen() {
  const [draft, setDraft] = useState({ type: '', q: '' });
  const [applied, setApplied] = useState(draft);

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return LOGS.filter((l) => (!applied.type || l.type === applied.type) && (!kw || l.user.toLowerCase().includes(kw)));
  }, [applied]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">로그 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 로그 관리</p>
        </div>
        <ActionBar actions={['download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="기간">
          <span className="inline-flex h-8 min-w-[130px] items-center justify-between gap-3.5 rounded-md border border-border-hi bg-panel px-3.5 text-[11.5px] font-semibold text-ink">
            2026-06-09 <span className="text-[8px] text-ink3">▾</span>
          </span>
        </FilterField>
        <FilterField label="유형">
          <Select value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="사용자">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="사번 / 성명" width={160} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <Card title="접속 · 변경 이력" action={<span className="text-[10.5px] text-ink3">총 1,284건 중 {rows.length}건</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                {['일시', '사용자', '유형', '화면', '내용', 'IP'].map((h, i) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={i} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap tabular-nums text-ink3">{l.at}</td>
                  <td className="border-b border-border px-3 py-2.5 font-semibold text-ink">{l.user}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={TONE[l.type]}>{l.type}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 font-semibold text-ink2">{l.screen}</td>
                  <td className="border-b border-border px-3 py-2.5 text-ink2">{l.detail}</td>
                  <td className="border-b border-border px-3 py-2.5 whitespace-nowrap tabular-nums text-ink3">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
