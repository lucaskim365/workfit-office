import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { FilterBar, FilterField, Select, TextInput, type Option } from '@/shared/ui/FilterBar';
import { DetailField } from '@/shared/ui/DetailField';
import { VENDOR_TYPES, type Vendor } from '@/domain/vendor/schema';
import { useVendors } from '@/features/vendor/useVendors';

const TYPE_TONE: Record<Vendor['type'], Tone> = { 매입: 'info', 매출: 'ok', 외주: 'mute' };
const TYPE_OPTIONS: Option[] = [{ value: '', label: '전체' }, ...VENDOR_TYPES.map((t) => ({ value: t, label: t }))];
const USE_OPTIONS: Option[] = [{ value: '', label: '전체' }, { value: '사용', label: '사용' }, { value: '미사용', label: '미사용' }];

/** 거래처관리 — 필터 + 마스터-디테일. 데이터: features/vendor/useVendors (Firestore/seed). */
export default function VendorScreen() {
  const [draft, setDraft] = useState({ type: '', use: '', q: '' });
  const [applied, setApplied] = useState(draft);
  const [selected, setSelected] = useState('V-10021');

  const { data: rows = [], isLoading } = useVendors(applied);
  const cur = rows.find((v) => v.code === selected) ?? rows[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">거래처관리</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 거래처관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '거래처 추가' }, 'save', 'upload', 'download']} />
      </div>

      <FilterBar onSearch={() => setApplied(draft)}>
        <FilterField label="거래 구분">
          <Select value={draft.type} onChange={(v) => setDraft({ ...draft, type: v })} options={TYPE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="사용여부">
          <Select value={draft.use} onChange={(v) => setDraft({ ...draft, use: v })} options={USE_OPTIONS} width={100} />
        </FilterField>
        <FilterField label="검색">
          <TextInput value={draft.q} onChange={(v) => setDraft({ ...draft, q: v })} placeholder="거래처코드 / 거래처명" width={200} onEnter={() => setApplied(draft)} />
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="거래처 목록" action={<span className="text-[10.5px] text-ink3">총 86건 중 {rows.length}건</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['거래처코드', '거래처명', '구분', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3.5 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 3 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={4} className="px-3.5 py-8 text-center text-[11.5px] text-ink3">불러오는 중…</td></tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={4} className="px-3.5 py-8 text-center text-[11.5px] text-ink3">조회된 거래처가 없습니다.</td></tr>
                )}
                {rows.map((v) => {
                  const on = v.code === selected;
                  return (
                    <tr key={v.code} onClick={() => setSelected(v.code)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3.5 py-2.5 font-bold ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        {v.code}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{v.name}</td>
                      <td className="px-3.5 py-2.5"><Pill tone={TYPE_TONE[v.type]}>{v.type}</Pill></td>
                      <td className="px-3.5 py-2.5 text-center"><Pill tone={v.use === '사용' ? 'ok' : 'mute'}>{v.use}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="거래처 상세정보" action={<ActionBar actions={[{ preset: 'save', label: '저장' }]} />}>
          {cur ? (
            <div className="flex flex-col gap-3">
              <DetailField label="거래처코드" required value={cur.code} />
              <DetailField label="거래처명" required value={cur.name} />
              <DetailField label="사업자번호" value={cur.bizNo} mono />
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="대표자" value={cur.ceo} />
                <DetailField label="구분" select value={cur.type} />
              </div>
              <DetailField label="담당자" value={cur.manager} />
              <DetailField label="사용여부" select value={cur.use} />
              <DetailField label="주소" multiline value={cur.addr} />
            </div>
          ) : (
            <div className="py-10 text-center text-[11.5px] text-ink3">선택된 거래처가 없습니다.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
