import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Sparkline } from '@/shared/ui/charts/Sparkline';
import { C, KpiGrid } from '../_qual';

const IF_ST: Record<string, Tone> = { 연결: 'ok', 지연: 'warn', 단절: 'err' };
const PROTO_C: Record<string, string> = { 'OPC-UA': C.blue, MQTT: C.teal, 'Modbus-TCP': C.navy, MTConnect: '#8a5cf6', 'RS-232': C.ink3 };

interface Tag { tag: string; item: string; unit: string; spec: string }
interface Stream { t: string; item: string; val: string | number; res: string }
interface Device { id: string; name: string; dev: string; proto: string; ep: string; loc: string; status: string; last: string; today: number; err: number; lat: number; auto: number; spark: number[]; tags: Tag[]; stream: Stream[] }
const IF_DEVICES: Device[] = [
  { id: 'IF-CMM-01', name: 'CMM 3차원 측정기', dev: 'ZEISS CONTURA', proto: 'OPC-UA', ep: 'opc.tcp://192.168.10.21:4840', loc: '품질실', status: '연결', last: '2초 전', today: 1240, err: 0, lat: 45, auto: 100, spark: [18, 22, 20, 24, 19, 26, 23, 28, 25, 27], tags: [{ tag: 'PRG_OD_X', item: '외경(O.D)', unit: 'mm', spec: '25.00±0.05' }, { tag: 'PRG_ID_X', item: '내경(I.D)', unit: 'mm', spec: '8.00±0.01' }, { tag: 'PRG_FLAT', item: '평면도', unit: 'mm', spec: '≤0.05' }], stream: [{ t: '15:42:03', item: '외경(O.D)', val: 25.01, res: 'OK' }, { t: '15:41:48', item: '내경(I.D)', val: 8.004, res: 'OK' }, { t: '15:41:30', item: '평면도', val: 0.031, res: 'OK' }, { t: '15:41:05', item: '외경(O.D)', val: 25.06, res: 'NG' }, { t: '15:40:42', item: '내경(I.D)', val: 7.998, res: 'OK' }] },
  { id: 'IF-VIS-02', name: '비전 외관검사기', dev: 'COGNEX In-Sight', proto: 'MQTT', ep: 'mqtt://192.168.10.45:1883', loc: '2라인 #4', status: '연결', last: '1초 전', today: 8650, err: 3, lat: 12, auto: 100, spark: [120, 135, 128, 142, 138, 150, 145, 155, 148, 160], tags: [{ tag: 'VIS_DEFECT', item: '표면 결함', unit: '판정', spec: '결함 無' }, { tag: 'VIS_DIM', item: '외형 치수', unit: 'mm', spec: '규격 내' }], stream: [{ t: '15:42:05', item: '표면 결함', val: 'PASS', res: 'OK' }, { t: '15:42:04', item: '표면 결함', val: 'PASS', res: 'OK' }, { t: '15:42:02', item: '외형 치수', val: 'OK', res: 'OK' }, { t: '15:42:00', item: '표면 결함', val: 'SCRATCH', res: 'NG' }, { t: '15:41:58', item: '표면 결함', val: 'PASS', res: 'OK' }] },
  { id: 'IF-CNC-03', name: 'CNC 인프로세스 게이지', dev: 'FANUC PLC', proto: 'Modbus-TCP', ep: '192.168.10.33:502', loc: '1라인 #3', status: '지연', last: '38초 전', today: 420, err: 1, lat: 1850, auto: 95, spark: [9, 11, 8, 12, 7, 10, 6, 9, 5, 7], tags: [{ tag: 'DR4001', item: '외경 Ø', unit: 'mm', spec: '25.00±0.05' }, { tag: 'DR4002', item: '전장(L)', unit: 'mm', spec: '80.0±0.2' }], stream: [{ t: '15:41:25', item: '외경 Ø', val: 25.04, res: 'OK' }, { t: '15:40:52', item: '전장(L)', val: 80.31, res: 'NG' }, { t: '15:40:18', item: '외경 Ø', val: 25.02, res: 'OK' }, { t: '15:39:40', item: '외경 Ø', val: 25.03, res: 'OK' }] },
  { id: 'IF-TRQ-04', name: '토크 측정 시스템', dev: 'KISTLER ComoNeo', proto: 'OPC-UA', ep: 'opc.tcp://192.168.10.51:4840', loc: '1라인 #5', status: '연결', last: '4초 전', today: 2310, err: 0, lat: 60, auto: 100, spark: [40, 44, 42, 48, 45, 50, 47, 52, 49, 51], tags: [{ tag: 'TRQ_FINAL', item: '체결 토크', unit: 'N·m', spec: '12.0±1.5' }, { tag: 'TRQ_ANGLE', item: '회전각', unit: '°', spec: '90±10' }], stream: [{ t: '15:42:01', item: '체결 토크', val: 12.3, res: 'OK' }, { t: '15:41:46', item: '회전각', val: 88, res: 'OK' }, { t: '15:41:30', item: '체결 토크', val: 11.8, res: 'OK' }, { t: '15:41:12', item: '체결 토크', val: 12.1, res: 'OK' }] },
  { id: 'IF-GAGE-05', name: '디지털 캘리퍼 게이트웨이', dev: 'Mitutoyo U-WAVE', proto: 'RS-232', ep: 'COM3 · 9600bps', loc: '3라인 #2', status: '단절', last: '12분 전', today: 86, err: 14, lat: 0, auto: 0, spark: [5, 4, 6, 3, 4, 2, 1, 0, 0, 0], tags: [{ tag: 'CAL_DIA', item: '축경 Ø', unit: 'mm', spec: '40.00±0.03' }], stream: [{ t: '15:30:14', item: '축경 Ø', val: 40.01, res: 'OK' }, { t: '15:29:50', item: '축경 Ø', val: 40.02, res: 'OK' }] },
  { id: 'IF-MCT-06', name: '머시닝센터 (MTConnect)', dev: 'DMG MORI', proto: 'MTConnect', ep: 'http://192.168.10.60:5000', loc: '1라인 #6', status: '연결', last: '3초 전', today: 540, err: 0, lat: 80, auto: 100, spark: [12, 14, 13, 16, 15, 18, 16, 19, 17, 20], tags: [{ tag: 'PROBE_Z', item: '높이(Z)', unit: 'mm', spec: '15.0±0.1' }, { tag: 'PROBE_BORE', item: '보어경', unit: 'mm', spec: '12.0±0.02' }], stream: [{ t: '15:42:00', item: '높이(Z)', val: 15.02, res: 'OK' }, { t: '15:41:33', item: '보어경', val: 12.0, res: 'OK' }, { t: '15:41:02', item: '높이(Z)', val: 14.99, res: 'OK' }] },
];
const latColor = (l: number, st: string) => (st === '단절' ? C.ink3 : l >= 1000 ? C.err : l >= 300 ? C.warn : C.ok);

/** 설비·계측 데이터 인터페이스 — 와이어프레임 qual-pqc-interface.jsx 정본. */
export default function QualPqcInterfaceScreen() {
  const [sel, setSel] = useState('IF-CMM-01');
  const cur = IF_DEVICES.find((d) => d.id === sel) || IF_DEVICES[0];

  const connected = IF_DEVICES.filter((d) => d.status === '연결').length;
  const down = IF_DEVICES.filter((d) => d.status !== '연결').length;
  const todaySum = IF_DEVICES.reduce((s, d) => s + d.today, 0);
  const errSum = IF_DEVICES.reduce((s, d) => s + d.err, 0);
  const autoRate = Math.round(IF_DEVICES.reduce((s, d) => s + d.auto, 0) / IF_DEVICES.length);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">설비·계측 데이터 인터페이스</h1>
          <p className="mt-0.5 text-xs text-ink3">품질 관리 / 공정검사(PQC) / 설비·계측 데이터 인터페이스</p>
        </div>
        <ActionBar actions={[{ icon: 'plus', label: '인터페이스 등록', variant: 'primary' }, 'refresh', 'download']} />
      </div>

      <KpiGrid cols={5} items={[
        ['연결 인터페이스', `${connected}/${IF_DEVICES.length}`, '', C.ok],
        ['단절·지연', '' + down, '건', C.err],
        ['금일 자동수집', todaySum.toLocaleString(), '건', C.ink],
        ['수집 오류', '' + errSum, '건', C.warn],
        ['자동판정 비율', '' + autoRate, '%', C.blue],
      ]} />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        {/* 목록 */}
        <Card title="인터페이스 연결 현황" bodyClassName="p-0" action={<span className="inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: C.err }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: C.err }} />LIVE</span>}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {[['인터페이스 / 설비', 'text-left'], ['프로토콜', 'text-center'], ['지연(ms)', 'text-center'], ['금일 수집', 'text-right'], ['수집 추이', 'text-center'], ['상태', 'text-center']].map(([h, al]) => (
                  <th key={h} className={`border-b border-border bg-panel-alt px-2.5 py-2 text-[10px] font-bold whitespace-nowrap text-ink2 ${al}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {IF_DEVICES.map((d, i) => {
                const on = d.id === sel;
                return (
                  <tr key={d.id} onClick={() => setSel(d.id)} className="cursor-pointer" style={{ background: on ? C.tealSoft : i % 2 ? C.panelAlt : '#fff' }}>
                    <td className="border-b border-border px-2.5 py-2.5" style={{ borderLeft: on ? `3px solid ${C.teal}` : '3px solid transparent' }}>
                      <div className="font-bold" style={{ color: on ? C.teal : C.ink }}>{d.name}</div>
                      <div className="mt-px font-mono text-[9px] text-ink3">{d.dev} · {d.loc}</div>
                    </td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold" style={{ color: PROTO_C[d.proto], border: `1px solid ${PROTO_C[d.proto]}44` }}>{d.proto}</span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center font-mono font-bold" style={{ color: latColor(d.lat, d.status) }}>{d.status === '단절' ? '—' : d.lat}</td>
                    <td className="border-b border-border px-2.5 py-2.5 text-right font-mono font-bold text-ink">{d.today.toLocaleString()}{d.err > 0 && <span className="text-[8.5px] font-bold" style={{ color: C.err }}> ⚠{d.err}</span>}</td>
                    <td className="border-b border-border px-2.5 py-1 text-center"><span className="inline-block align-middle"><Sparkline data={d.spark} w={54} h={20} color={d.status === '단절' ? C.ink3 : IF_ST[d.status] === 'ok' ? C.teal : C.warn} /></span></td>
                    <td className="border-b border-border px-2.5 py-2.5 text-center"><Pill tone={IF_ST[d.status]} solid={d.status === '단절'}>{d.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* 상세 */}
        <Card title="인터페이스 상세" bodyClassName="p-0" action={<Pill tone={IF_ST[cur.status]} solid={cur.status === '단절'}>{cur.status}</Pill>}>
          <div className="border-b border-border px-4 py-3.5" style={{ background: C.panelAlt }}>
            <div className="flex items-center gap-2">
              <span className="text-[14.5px] font-extrabold text-ink">{cur.name}</span>
              <span className="rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold" style={{ color: PROTO_C[cur.proto], border: `1px solid ${PROTO_C[cur.proto]}44` }}>{cur.proto}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-ink3">{cur.ep}</div>
          </div>

          <div className="flex border-b border-border px-4 py-3">
            {([['설비', cur.dev], ['위치', cur.loc], ['지연', cur.status === '단절' ? '—' : cur.lat + 'ms'], ['최종 수신', cur.last]] as const).map(([k, v], i, a) => (
              <div key={k} className="flex-1 text-center" style={{ borderRight: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div className={`truncate text-[10.5px] font-extrabold ${i >= 2 ? 'font-mono' : ''}`} style={{ color: k === '지연' ? latColor(cur.lat, cur.status) : C.ink }}>{v}</div>
                <div className="mt-0.5 text-[8.5px] text-ink3">{k}</div>
              </div>
            ))}
          </div>

          <div className="border-b border-border px-4 py-3">
            <div className="mb-2.5 text-[10.5px] font-bold text-ink3">태그 ↔ 검사항목 매핑 ({cur.tags.length})</div>
            <div className="flex flex-col gap-1">
              {cur.tags.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: C.panelAlt }}>
                  <span className="min-w-[72px] font-mono text-[9px] font-bold" style={{ color: C.blue }}>{t.tag}</span>
                  <span className="text-[8.5px] text-ink3">→</span>
                  <span className="text-[10.5px] font-bold text-ink">{t.item}</span>
                  <span className="ml-auto font-mono text-[9px] text-ink3">{t.spec}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 pb-1.5 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-ink3">실시간 수집 데이터</span>
              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold" style={{ color: cur.status === '단절' ? C.ink3 : C.err }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: cur.status === '단절' ? C.ink3 : C.err }} />{cur.status === '단절' ? '수신 중단' : '수신중'}</span>
            </div>
            <div className="flex flex-col overflow-hidden rounded-lg border border-border">
              {cur.stream.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-1.5" style={{ background: s.res === 'NG' ? '#fdf1ef' : i % 2 ? C.panelAlt : '#fff', borderBottom: i < cur.stream.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span className="min-w-[52px] font-mono text-[9px] text-ink3">{s.t}</span>
                  <span className="flex-1 text-[10.5px] font-semibold text-ink2">{s.item}</span>
                  <span className="font-mono text-[11px] font-extrabold" style={{ color: s.res === 'NG' ? C.err : C.ink }}>{s.val}</span>
                  <Pill tone={s.res === 'NG' ? 'err' : 'ok'} solid={s.res === 'NG'}>{s.res}</Pill>
                </div>
              ))}
            </div>
          </div>

          {cur.status !== '연결' ? (
            <div className="mx-4 mb-3.5 mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2" style={{ background: cur.status === '단절' ? '#fdf1ef' : '#fef6ec', border: `1px solid ${cur.status === '단절' ? C.err : C.warn}` }}>
              <span className="text-[12px]">⚠</span>
              <span className="text-[10px] font-bold" style={{ color: cur.status === '단절' ? C.err : '#b5731f' }}>{cur.status === '단절' ? '연결 단절 — 수동 입력으로 대체 중 · 통신 점검 필요' : '응답 지연 — 게이지 폴링 주기 확인 필요'}</span>
            </div>
          ) : <div className="h-3.5" />}
        </Card>
      </div>
    </div>
  );
}
