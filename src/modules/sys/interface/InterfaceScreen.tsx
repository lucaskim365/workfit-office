import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { Kpi } from '@/shared/ui/Kpi';
import { Pill, type Tone } from '@/shared/ui/Pill';
import { ActionBar, ActionButton } from '@/shared/ui/ActionBar';
import { DetailField } from '@/shared/ui/DetailField';
import { T } from '@/shared/theme/tokens';
import { useSysInterfaces } from '@/features/sysInterface/useSysInterfaces';
import type { SysInterface } from '@/domain/sysInterface/schema';

const TONE: Record<SysInterface['status'], Tone> = { 정상: 'ok', 지연: 'warn', 오류: 'err' };
const TGT_COLOR: Record<SysInterface['target'], string> = { ERP: T.navy, PLC: T.teal, WMS: T.blue, EQ: T.ink2 };

/** 인터페이스 관리 — 외부 연동 모니터링 + 정보 등록. 와이어프레임 sys-screens-2.InterfaceMgmtContent 정본. */
export default function InterfaceScreen() {
  const { data: ifaces = [], isLoading } = useSysInterfaces();
  const [selected, setSelected] = useState('IF-ERP-001');
  const cur = ifaces.find((x) => x.id === selected) ?? ifaces[0];

  if (!cur) {
    return <div className="grid place-items-center py-20 text-[13px] text-ink3">{isLoading ? '불러오는 중…' : '인터페이스가 없습니다.'}</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">인터페이스 관리</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 인터페이스 관리</p>
        </div>
        <ActionBar actions={[{ preset: 'add', label: 'I/F 추가' }, 'save', 'refresh', 'download']} />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card><Kpi label="총 인터페이스" value="32" unit="개" /></Card>
        <Card><Kpi label="정상" value="29" unit="개" tone="teal" /></Card>
        <Card><Kpi label="지연" value="2" unit="개" /></Card>
        <Card><Kpi label="오류" value="1" unit="개" /></Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <Card title="외부 연동 모니터링" action={<span className="text-[10.5px] text-ink3">실시간 · 30초 자동 갱신</span>} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {['인터페이스 ID', '인터페이스명', '대상', '방향', '주기', '상태'].map((h, i) => (
                    <th key={h} className={`border-b border-border bg-panel-alt px-3 py-2.5 text-[10.5px] font-bold whitespace-nowrap text-ink2 ${i >= 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ifaces.map((x) => {
                  const on = x.id === selected;
                  return (
                    <tr key={x.id} onClick={() => setSelected(x.id)} className={`cursor-pointer border-b border-border transition-colors ${on ? 'bg-teal-soft' : 'hover:bg-panel-alt'}`}>
                      <td className={`px-3 py-2.5 font-mono text-[11px] font-bold whitespace-nowrap ${on ? 'text-teal' : 'text-ink'}`} style={on ? { boxShadow: 'inset 3px 0 0 0 var(--color-teal)' } : undefined}>{x.id}</td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-ink">{x.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span style={{ background: TGT_COLOR[x.target] }} className="rounded-md px-2 py-0.5 text-[10.5px] font-bold text-white">{x.target}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-ink2">{x.dir}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap text-ink2">{x.cycle}</td>
                      <td className="px-3 py-2.5 text-center"><Pill tone={TONE[x.status]} solid={x.status === '오류'}>{x.status}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title={<span>인터페이스 정보 등록 <span className="text-teal">· {cur.id}</span></span>}
          action={<Pill tone={cur.status === '오류' ? 'err' : 'ok'}>{cur.status === '오류' ? '오류' : '연결됨'}</Pill>}
        >
          <div className="flex flex-col gap-3">
            <DetailField label="I/F ID" required value={cur.id} mono />
            <DetailField label="I/F 명" required value={cur.name} />
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="대상" select value={cur.target} />
              <DetailField label="방향" select value={cur.dir} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="연동 방식" select value={cur.method} />
              <DetailField label="주기" select value={cur.cycle} />
            </div>
            <DetailField label="연동 주소" required value={cur.addr} mono />
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="포트" value="443" mono />
              <DetailField label="타임아웃" value="30초" />
            </div>
            <DetailField label="인증 방식" select value="API Key (Header)" />
            <DetailField label="비고" multiline value={cur.remark} />
            <div className="flex justify-end gap-2 pt-1">
              <ActionButton icon="refresh" label="연결 테스트" />
              <ActionButton icon="save" label="저장" variant="primary" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
