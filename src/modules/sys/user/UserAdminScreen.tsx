import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { DetailField } from '@/shared/ui/DetailField';
import { useSysAdmins } from '@/features/sysAdmin/useSysAdmins';
import type { SysAdmin } from '@/domain/sysAdmin/schema';

const ST_TONE: Record<SysAdmin['status'], Tone> = { 사용: 'ok', 잠금: 'warn', 미사용: 'mute' };
const LV_TONE: Record<SysAdmin['level'], Tone> = { 슈퍼관리자: 'err', 시스템관리자: 'info', 운영관리자: 'mute' };
const LEVELS = ['슈퍼관리자', '시스템관리자', '운영관리자'] as const;
const LEVEL_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...LEVELS.map((l) => ({ value: l, label: l }))];
const STATUS_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '잠금', label: '잠금' }, { value: '미사용', label: '미사용' }];

/** 사용자 관리(시스템 어드민) — 와이어프레임 sys-screens.UserAdminContent 정본. */
export default function UserAdminScreen() {
  const { data: admins = [], isLoading } = useSysAdmins();
  const [draft, setDraft] = useState({ level: '', status: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState('admin');

  const rows = useMemo(() => {
    const kw = applied.q.trim().toLowerCase();
    return admins.filter(
      (a) =>
        (!applied.level || a.level === applied.level) &&
        (!applied.status || a.status === applied.status) &&
        (!kw || a.id.toLowerCase().includes(kw) || a.name.toLowerCase().includes(kw)),
    );
  }, [admins, applied]);
  const cur = admins.find((a) => a.id === selected) ?? admins[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '관리자 계정이 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">사용자 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 사용자 관리 (시스템 어드민)</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '관리자 추가' }, 'save', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="관리자 등급">
          <Select value={draft.level} onChange={(v) => setDraft({ ...draft, level: v })} options={LEVEL_OPTIONS} width={130} />
        </FilterField>
        <FilterField label="상태">
          <Select value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={STATUS_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="계정 ID / 성명" width={200} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="전체 관리자" value="14" unit="명" tone="teal" /></Card>
        <Card><Kpi label="슈퍼관리자" value="2" unit="명" /></Card>
        <Card><Kpi label="시스템관리자" value="5" unit="명" /></Card>
        <Card><Kpi label="운영관리자" value="7" unit="명" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="시스템 관리자 계정" action={<span className="text-[10.5px] text-ink3">총 14명 중 {rows.length}명</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['계정 ID', '성명', '관리자 등급', '담당 모듈', '상태', '2FA'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const on = a.id === selected;
                  return (
                    <tr key={a.id} onClick={() => setSelected(a.id)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{a.id}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink">{a.name}</td>
                      <td className="px-3 py-2.5"><Pill tone={LV_TONE[a.level]}>{a.level}</Pill></td>
                      <td className="px-3 py-2.5 text-ink2">{a.modules}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={ST_TONE[a.status]}>{a.status}</Pill></td>
                      <td className={`px-3 py-2.5 text-center text-[10.5px] font-bold ${a.twoFa === 'ON' ? 'text-ok' : 'text-ink3'}`}>{a.twoFa}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="관리자 계정 상세" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          <div className="flex flex-col gap-3">
            <DetailField label="계정 ID" required value={cur.id} mono />
            <DetailField label="성명" required value={cur.name} />
            <DetailField label="등급" select value={cur.level} />
            <DetailField label="담당 모듈" select value={cur.modules} />
            <div className="grid grid-cols-[88px_1fr] items-center gap-3.5">
              <span className="text-[12px] font-bold text-ink2">비밀번호</span>
              <div className="flex items-center gap-2">
                <div className="flex h-[38px] flex-1 items-center rounded-md border border-border-hi bg-panel px-3.5 text-[12.5px] text-ink2">••••••••</div>
                <ActionButton icon="refresh" label="초기화" />
              </div>
            </div>
            <DetailField label="2단계 인증" select value={cur.twoFa === 'ON' ? '사용 (OTP)' : '미사용'} />
            <DetailField label="접속 IP 제한" value={cur.ip} mono />
            <DetailField label="상태" select value={cur.status} />
          </div>
        </Card>
      </div>
    </div>
  );
}
