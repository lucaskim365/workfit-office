import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { useCommonCodeGroups } from '@/features/commonCode/useCommonCodes';

/** 공통코드정보 — 코드그룹 ↔ 상세코드 2패널. 데이터: features/commonCode/useCommonCodes. */
export default function CodeScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('EQ_STATUS');

  const { data: all = [], isLoading } = useCommonCodeGroups();
  const groups = all.filter(
    (g) => !search || g.code.toLowerCase().includes(search.toLowerCase()) || g.name.includes(search),
  );
  const cur = all.find((g) => g.code === selected) ?? all[0];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">공통코드정보</h1>
          <p className="mt-0.5 text-xs text-ink3">기준 정보 / 공통코드정보</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: '코드 추가' }, 'save', 'upload', 'download']} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[380px_1fr]">
        {/* 코드 그룹 */}
        <Card title="코드 그룹" bodyClassName="p-0">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="그룹코드 / 그룹명"
              className="h-8 flex-1 rounded-md border border-border-hi bg-panel px-3 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-teal"
            />
            <ActionButton icon="search" label="조회" variant="primary" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['그룹코드', '그룹명', '코드수'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3.5 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 2 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={3} className="px-3.5 py-8 text-center text-[11.5px] text-ink3">불러오는 중…</td></tr>
                )}
                {!isLoading && groups.length === 0 && (
                  <tr><td colSpan={3} className="px-3.5 py-8 text-center text-[11.5px] text-ink3">조회된 코드 그룹이 없습니다.</td></tr>
                )}
                {groups.map((g) => {
                  const on = g.code === selected;
                  return (
                    <tr key={g.code} onClick={() => setSelected(g.code)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3.5 py-2.5 font-bold tabular-nums ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>
                        {g.code}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-ink">{g.name}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-ink3">{g.codes.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 상세 코드 */}
        <Card
          title={<span>상세 코드 {cur && <span className="text-teal">· {cur.code}</span>}</span>}
          action={<span className="text-[10.5px] text-ink3">총 {cur?.codes.length ?? 0}건</span>}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  {['코드', '코드명', '정렬순서', '사용여부', '등록자'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3.5 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i === 2 ? 'text-right' : i === 3 ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cur?.codes ?? []).map((c, i) => (
                  <tr key={c.code} className={i % 2 ? 'bg-panel-alt' : 'bg-panel'}>
                    <td className="border-b border-border px-3.5 py-2.5 font-bold text-ink">{c.code}</td>
                    <td className="border-b border-border px-3.5 py-2.5 font-semibold text-ink2">{c.name}</td>
                    <td className="border-b border-border px-3.5 py-2.5 text-right tabular-nums text-ink3">{c.order}</td>
                    <td className="border-b border-border px-3.5 py-2.5 text-center">
                      <Pill tone={c.use ? 'ok' : 'mute'}>{c.use ? '사용' : '미사용'}</Pill>
                    </td>
                    <td className="border-b border-border px-3.5 py-2.5 text-ink3">{c.regBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
