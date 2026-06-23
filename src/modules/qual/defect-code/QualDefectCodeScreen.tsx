import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid, SearchBox } from '../_qual';

const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const toneColor = (t: string) => ({ info: C.blue, ok: C.ok, warn: C.warn, err: C.err, mute: C.ink3 }[t] || C.ink3);

interface Code { code: string; ko: string; en: string; proc: string; grade: string; insp: string; qty: number; trend: number[]; use: boolean }
interface Group { gcode: string; name: string; tone: Tone; codes: Code[] }
const DEF_GROUPS: Group[] = [
  { gcode: 'AP', name: '외관 불량', tone: 'warn', codes: [
    { code: 'D-AP-SC', ko: '스크래치', en: 'Scratch', proc: '표면처리', grade: '치명', insp: 'QI-AP-001', qty: 142, trend: [18, 22, 16, 25, 20, 24, 17], use: true },
    { code: 'D-AP-CL', ko: '색상·광택 불량', en: 'Color NG', proc: '도장', grade: '주요', insp: 'QI-AP-002', qty: 76, trend: [9, 12, 8, 14, 10, 11, 12], use: true },
    { code: 'D-AP-BR', ko: '버(Burr)·이물', en: 'Burr / Foreign', proc: '사출·가공', grade: '치명', insp: 'QI-AP-003', qty: 98, trend: [14, 11, 16, 12, 18, 13, 14], use: true },
    { code: 'D-AP-DT', ko: '찍힘·눌림', en: 'Dent', proc: '취급·운반', grade: '주요', insp: 'QI-AP-001', qty: 41, trend: [5, 7, 4, 8, 6, 5, 6], use: true },
    { code: 'D-AP-ST', ko: '오염·얼룩', en: 'Stain', proc: '세정', grade: '경미', insp: 'QI-AP-003', qty: 33, trend: [4, 5, 6, 3, 5, 4, 6], use: false },
  ] },
  { gcode: 'DIM', name: '치수 불량', tone: 'info', codes: [
    { code: 'D-DIM-OS', ko: '외경 과대', en: 'O.D Oversize', proc: 'CNC 가공', grade: '주요', insp: 'QI-DIM-001', qty: 64, trend: [8, 10, 7, 9, 11, 8, 11], use: true },
    { code: 'D-DIM-US', ko: '내경 과소', en: 'I.D Undersize', proc: 'CNC 가공', grade: '주요', insp: 'QI-DIM-002', qty: 52, trend: [6, 8, 7, 5, 9, 8, 9], use: true },
    { code: 'D-DIM-LN', ko: '전장 불량', en: 'Length NG', proc: '절단', grade: '경미', insp: 'QI-DIM-003', qty: 38, trend: [5, 4, 6, 7, 5, 6, 5], use: true },
    { code: 'D-DIM-RD', ko: '진원도 불량', en: 'Roundness NG', proc: '연삭', grade: '주요', insp: 'QI-DIM-001', qty: 27, trend: [3, 5, 4, 4, 6, 3, 2], use: true },
  ] },
  { gcode: 'WT', name: '중량·충전 불량', tone: 'ok', codes: [
    { code: 'D-WT-OV', ko: '중량 초과', en: 'Overweight', proc: '용접·조립', grade: '주요', insp: 'QI-WT-001', qty: 31, trend: [4, 5, 3, 6, 4, 5, 4], use: true },
    { code: 'D-WT-FL', ko: '충전량 부족', en: 'Underfill', proc: '충전', grade: '주요', insp: 'QI-WT-002', qty: 19, trend: [2, 3, 4, 2, 3, 3, 2], use: false },
  ] },
  { gcode: 'PR', name: '물성·재질 불량', tone: 'mute', codes: [
    { code: 'D-PR-TS', ko: '인장강도 미달', en: 'Tensile Low', proc: '수입검사', grade: '치명', insp: 'QI-PRP-001', qty: 22, trend: [3, 2, 4, 3, 5, 2, 3], use: true },
    { code: 'D-PR-HD', ko: '경도 불량', en: 'Hardness NG', proc: '열처리', grade: '주요', insp: 'QI-PRP-002', qty: 29, trend: [4, 3, 5, 4, 3, 5, 5], use: true },
    { code: 'D-PR-TMP', ko: '성형온도 이상', en: 'Temp Abnormal', proc: '사출 성형', grade: '주요', insp: 'QI-TMP-001', qty: 35, trend: [5, 6, 4, 7, 5, 4, 4], use: true },
  ] },
  { gcode: 'ST', name: '구조·파손', tone: 'err', codes: [
    { code: 'D-ST-CR', ko: '크랙(균열)', en: 'Crack', proc: '성형·열처리', grade: '치명', insp: '-', qty: 47, trend: [6, 8, 5, 9, 7, 6, 6], use: true },
    { code: 'D-ST-BK', ko: '파손', en: 'Broken', proc: '취급·운반', grade: '치명', insp: '-', qty: 25, trend: [3, 4, 3, 5, 4, 3, 3], use: true },
    { code: 'D-ST-DF', ko: '변형·휨', en: 'Deformation', proc: '용접', grade: '주요', insp: 'QI-DIM-003', qty: 30, trend: [4, 5, 4, 3, 6, 4, 4], use: true },
  ] },
  { gcode: 'EL', name: '전기 특성', tone: 'info', codes: [
    { code: 'D-EL-IR', ko: '절연저항 불량', en: 'Insulation NG', proc: '전기검사', grade: '치명', insp: 'QI-EL-001', qty: 18, trend: [2, 3, 2, 4, 3, 2, 2], use: true },
    { code: 'D-EL-OP', ko: '단선·접촉불량', en: 'Open / Contact', proc: '조립', grade: '치명', insp: '-', qty: 14, trend: [2, 1, 3, 2, 2, 3, 1], use: true },
  ] },
];

/** 불량 코드 마스터 — 와이어프레임 qual-defect-code.jsx 정본. */
export default function QualDefectCodeScreen() {
  const [grp, setGrp] = useState('AP');
  const [q, setQ] = useState('');
  const allCodes = DEF_GROUPS.flatMap((g) => g.codes.map((c) => ({ ...c, gcode: g.gcode, gname: g.name, gtone: g.tone })));
  const curG = DEF_GROUPS.find((g) => g.gcode === grp);
  let codes = grp === '전체' ? allCodes : curG!.codes.map((c) => ({ ...c, gcode: curG!.gcode, gname: curG!.name, gtone: curG!.tone }));
  if (q) codes = codes.filter((c) => c.ko.includes(q) || c.en.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase()));

  const critical = allCodes.filter((c) => c.grade === '치명').length;
  const unused = allCodes.filter((c) => !c.use).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">불량 코드 마스터</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 품질 기준정보 / 불량 코드 마스터</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '불량코드 등록', variant: 'primary' }, 'save', 'upload', 'download']} />
      </div>

      <KpiGrid cols={4} items={[
        ['총 불량 코드', '' + allCodes.length, '건', C.ink],
        ['불량 그룹(대분류)', '' + DEF_GROUPS.length, '개', C.blue],
        ['치명 등급 코드', '' + critical, '건', C.err],
        ['미사용 코드', '' + unused, '건', C.ink3],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[0.8fr_2.2fr]">
        {/* 그룹 */}
        <Card title="불량 그룹" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">대분류 {DEF_GROUPS.length}</span>}>
          <div className="flex flex-col">
            <button onClick={() => setGrp('전체')} className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-left" style={{ borderLeft: grp === '전체' ? `3px solid ${C.teal}` : '3px solid transparent', background: grp === '전체' ? C.tealSoft : '#fff' }}>
              <span className="text-[12.5px] font-bold" style={{ color: grp === '전체' ? C.teal : C.ink }}>전체 보기</span>
              <span className="text-[10.5px] font-bold text-ink3">{allCodes.length}</span>
            </button>
            {DEF_GROUPS.map((g) => {
              const on = g.gcode === grp;
              const crit = g.codes.filter((c) => c.grade === '치명').length;
              return (
                <button key={g.gcode} onClick={() => setGrp(g.gcode)} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5 text-left" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', background: on ? C.tealSoft : '#fff' }}>
                  <span className="grid h-7 w-[34px] shrink-0 place-items-center rounded-[7px] font-mono text-[10.5px] font-extrabold" style={{ color: toneColor(g.tone), background: toneColor(g.tone) + '1a' }}>{g.gcode}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold" style={{ color: on ? C.teal : C.ink }}>{g.name}</span>
                    <span className="mt-px block text-[9.5px] text-ink3">코드 {g.codes.length}{crit > 0 && <span className="font-bold" style={{ color: C.err }}> · 치명 {crit}</span>}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 코드 목록 */}
        <Card title={grp === '전체' ? '불량 코드 — 전체' : `불량 코드 — ${curG!.name}`} bodyClassName="p-0" action={<SearchBox value={q} onChange={setQ} placeholder="코드·국문·영문" w={130} />}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-left text-[10.5px] font-bold whitespace-nowrap text-ink2">불량 코드</th>
                {grp === '전체' && <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">그룹</th>}
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-left text-[10.5px] font-bold whitespace-nowrap text-ink2">불량명 (국문 / 영문)</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">발생 공정</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">등급</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">연계 검사항목</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">최근 추이</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-right text-[10.5px] font-bold whitespace-nowrap text-ink2">누적</th>
                <th className="border-b border-border bg-panel-alt px-3 py-2 text-center text-[10.5px] font-bold whitespace-nowrap text-ink2">사용</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.code} style={{ background: i % 2 ? C.panelAlt : '#fff', opacity: c.use ? 1 : 0.5 }}>
                  <td className="border-b border-border px-3 py-2.5 font-mono font-bold text-ink">{c.code}</td>
                  {grp === '전체' && <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={c.gtone}>{c.gcode}</Pill></td>}
                  <td className="border-b border-border px-3 py-2.5"><div className="font-bold text-ink">{c.ko}</div><div className="mt-px text-[9.5px] italic text-ink3">{c.en}</div></td>
                  <td className="border-b border-border px-3 py-2.5 text-center text-[10.5px]">{c.proc}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={sevTone(c.grade)}>{c.grade}</Pill></td>
                  <td className="border-b border-border px-3 py-2.5 text-center font-mono text-[10px] font-bold" style={{ color: c.insp === '-' ? C.ink3 : C.teal }}>{c.insp}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center"><span className="inline-flex align-middle"><Sparkline data={c.trend} w={64} h={20} color={toneColor(sevTone(c.grade))} /></span></td>
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono font-bold text-ink2">{c.qty}</td>
                  <td className="border-b border-border px-3 py-2.5 text-center">
                    <span className="relative inline-flex h-[18px] w-8 rounded-full" style={{ background: c.use ? C.teal : C.borderHi }}>
                      <span className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white" style={{ left: c.use ? 16 : 2 }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5" style={{ background: C.panelAlt }}>
            <span className="text-[10.5px] text-ink3">표시 {codes.length}건 · 누적 발생 <b className="text-ink2">{codes.reduce((s, c) => s + c.qty, 0).toLocaleString()}</b>건 (최근 3개월)</span>
            <span className="text-[10px] text-ink3">코드 체계 : D-[그룹]-[유형]</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
