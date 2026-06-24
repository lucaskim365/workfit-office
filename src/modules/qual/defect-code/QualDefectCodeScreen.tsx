import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid, SearchBox } from '../_qual';
import { useDefectCodes } from '@/features/defectCode/useDefectCodes';
import { DEF_GROUPS } from '@/domain/defectCode/schema';

const sevTone = (s: string): Tone => (s === '치명' ? 'err' : s === '주요' ? 'warn' : 'mute');
const toneColor = (t: string) => ({ info: C.blue, ok: C.ok, warn: C.warn, err: C.err, mute: C.ink3 }[t] || C.ink3);

/** 그룹 표시 메타(한글명·tone) — 데이터가 아닌 화면 상수. */
const GROUP_META: Record<string, { name: string; tone: Tone }> = {
  AP: { name: '외관 불량', tone: 'warn' },
  DIM: { name: '치수 불량', tone: 'info' },
  WT: { name: '중량·충전 불량', tone: 'ok' },
  PR: { name: '물성·재질 불량', tone: 'mute' },
  ST: { name: '구조·파손', tone: 'err' },
  EL: { name: '전기 특성', tone: 'info' },
};

/** 불량 코드 마스터 — 와이어프레임 qual-defect-code.jsx 정본. */
export default function QualDefectCodeScreen() {
  const { data: allCodes = [], isLoading } = useDefectCodes();
  const [grp, setGrp] = useState('AP');
  const [q, setQ] = useState('');

  if (allCodes.length === 0) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '불량 코드가 없습니다.'}</div>;
  }

  const curMeta = GROUP_META[grp];
  let codes = grp === '전체' ? allCodes : allCodes.filter((c) => c.group === grp);
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
            {DEF_GROUPS.map((gcode) => {
              const meta = GROUP_META[gcode];
              const groupCodes = allCodes.filter((c) => c.group === gcode);
              const on = gcode === grp;
              const crit = groupCodes.filter((c) => c.grade === '치명').length;
              return (
                <button key={gcode} onClick={() => setGrp(gcode)} className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5 text-left" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent', background: on ? C.tealSoft : '#fff' }}>
                  <span className="grid h-7 w-[34px] shrink-0 place-items-center rounded-[7px] font-mono text-[10.5px] font-extrabold" style={{ color: toneColor(meta.tone), background: toneColor(meta.tone) + '1a' }}>{gcode}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold" style={{ color: on ? C.teal : C.ink }}>{meta.name}</span>
                    <span className="mt-px block text-[9.5px] text-ink3">코드 {groupCodes.length}{crit > 0 && <span className="font-bold" style={{ color: C.err }}> · 치명 {crit}</span>}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 코드 목록 */}
        <Card title={grp === '전체' ? '불량 코드 — 전체' : `불량 코드 — ${curMeta.name}`} bodyClassName="p-0" action={<SearchBox value={q} onChange={setQ} placeholder="코드·국문·영문" w={130} />}>
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
                  {grp === '전체' && <td className="border-b border-border px-3 py-2.5 text-center"><Pill tone={GROUP_META[c.group].tone}>{c.group}</Pill></td>}
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
