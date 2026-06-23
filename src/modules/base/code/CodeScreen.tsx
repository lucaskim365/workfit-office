import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';

interface CodeRow {
  code: string;
  name: string;
  order: string;
  use: boolean;
  regBy: string;
}
interface CodeGroup {
  code: string;
  name: string;
  codes: CodeRow[];
}

const GROUPS: CodeGroup[] = [
  {
    code: 'EQ_STATUS',
    name: '설비 가동 상태',
    codes: [
      { code: 'RUN', name: '가동', order: '10', use: true, regBy: '관리자' },
      { code: 'IDLE', name: '대기', order: '20', use: true, regBy: '관리자' },
      { code: 'STOP', name: '정지', order: '30', use: true, regBy: '관리자' },
      { code: 'DOWN', name: '고장', order: '40', use: true, regBy: '관리자' },
      { code: 'PM', name: '예방정비', order: '50', use: false, regBy: '관리자' },
    ],
  },
  { code: 'USE_YN', name: '사용 여부', codes: [
    { code: 'Y', name: '사용', order: '10', use: true, regBy: '관리자' },
    { code: 'N', name: '미사용', order: '20', use: true, regBy: '관리자' },
  ] },
  { code: 'DEFECT_GRADE', name: '결함 등급', codes: [
    { code: 'A', name: '심', order: '10', use: true, regBy: '관리자' },
    { code: 'B', name: '중', order: '20', use: true, regBy: '관리자' },
    { code: 'C', name: '경', order: '30', use: true, regBy: '관리자' },
    { code: 'D', name: '정보', order: '40', use: false, regBy: '관리자' },
  ] },
  { code: 'INSP_TYPE', name: '검사 유형', codes: [
    { code: 'IQC', name: '수입검사', order: '10', use: true, regBy: '관리자' },
    { code: 'PQC', name: '공정검사', order: '20', use: true, regBy: '관리자' },
    { code: 'OQC', name: '출하검사', order: '30', use: true, regBy: '관리자' },
  ] },
  { code: 'VENDOR_TYPE', name: '거래처 구분', codes: [
    { code: 'BUY', name: '매입', order: '10', use: true, regBy: '관리자' },
    { code: 'SELL', name: '매출', order: '20', use: true, regBy: '관리자' },
    { code: 'SUB', name: '외주', order: '30', use: true, regBy: '관리자' },
  ] },
  { code: 'LINE_CODE', name: '라인 코드', codes: [
    { code: 'A', name: 'A라인', order: '10', use: true, regBy: '관리자' },
    { code: 'B', name: 'B라인', order: '20', use: true, regBy: '관리자' },
    { code: 'C', name: 'C라인', order: '30', use: true, regBy: '관리자' },
  ] },
  { code: 'UNIT', name: '단위', codes: [
    { code: 'EA', name: '개', order: '10', use: true, regBy: '관리자' },
    { code: 'KG', name: '킬로그램', order: '20', use: true, regBy: '관리자' },
    { code: 'BOX', name: '박스', order: '30', use: false, regBy: '관리자' },
  ] },
];

/** 공통코드정보 — 코드그룹 ↔ 상세코드 2패널. 와이어프레임 admin-screens.CommonCodeContent 정본. */
export default function CodeScreen() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('EQ_STATUS');

  const groups = GROUPS.filter(
    (g) => !search || g.code.toLowerCase().includes(search.toLowerCase()) || g.name.includes(search),
  );
  const cur = GROUPS.find((g) => g.code === selected) ?? GROUPS[0];

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
          title={<span>상세 코드 <span className="text-teal">· {cur.code}</span></span>}
          action={<span className="text-[10.5px] text-ink3">총 {cur.codes.length}건</span>}
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
                {cur.codes.map((c, i) => (
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
