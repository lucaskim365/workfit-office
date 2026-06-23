import { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { ActionBar } from '@/shared/ui/ActionBar';
import { Toggle } from '@/shared/ui/Toggle';

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold text-ink">{label}</div>
        {desc && <div className="mt-0.5 text-[10.5px] text-ink3">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FakeSelect({ value, w }: { value: string; w?: number }) {
  return (
    <span style={w ? { minWidth: w } : undefined} className="inline-flex min-w-[110px] items-center justify-between gap-3.5 rounded-md border border-border-hi bg-panel px-3 py-1.5 text-[11.5px] font-semibold text-ink">
      {value} <span className="text-[8px] text-ink3">▾</span>
    </span>
  );
}

/** 환경 설정 — 알림/바코드/시스템/백업 설정. 와이어프레임 sys-screens-2.EnvSettingContent 정본. */
export default function EnvScreen() {
  const [t, setT] = useState({ alarmPopup: true, spc: true, lotLabel: false, dark: true, mask: true });
  const set = (k: keyof typeof t) => (v: boolean) => setT((s) => ({ ...s, [k]: v }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">환경 설정</h1>
          <p className="mt-0.5 text-xs text-ink3">시스템 관리 / 환경 설정</p>
        </div>
        <ActionBar actions={[{ preset: 'save', label: '저장', variant: 'primary' }]} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <Card title="알림 기준">
          <Row label="설비 알람 팝업" desc="ERROR 등급 발생 시 즉시 팝업"><Toggle on={t.alarmPopup} onChange={set('alarmPopup')} /></Row>
          <Row label="SPC 룰 위반 알림" desc="관리 한계 이탈 시 담당자 통보"><Toggle on={t.spc} onChange={set('spc')} /></Row>
          <Row label="가동률 임계 경보" desc="설정값 미만 시 경보"><FakeSelect value="80% 미만" w={120} /></Row>
          <Row label="알림 채널" desc="이메일 · SMS · 사내 메신저"><FakeSelect value="이메일 + 메신저" w={150} /></Row>
        </Card>

        <Card title="바코드 / 라벨 출력">
          <Row label="바코드 형식"><FakeSelect value="QR Code" /></Row>
          <Row label="라벨 규격"><FakeSelect value="100 × 50 mm" /></Row>
          <Row label="출력 방식" desc="기본 프린터 / 미리보기 후 출력"><FakeSelect value="미리보기 후 출력" w={150} /></Row>
          <Row label="LOT 라벨 자동 발행" desc="작업 완료 시 자동 출력"><Toggle on={t.lotLabel} onChange={set('lotLabel')} /></Row>
        </Card>

        <Card title="시스템 일반">
          <Row label="세션 자동 만료" desc="미사용 시 로그아웃까지"><FakeSelect value="30분" w={100} /></Row>
          <Row label="대시보드 자동 갱신"><FakeSelect value="30초" w={100} /></Row>
          <Row label="기본 언어"><FakeSelect value="한국어" w={100} /></Row>
          <Row label="다크 모드 허용" desc="사용자별 테마 선택 허용"><Toggle on={t.dark} onChange={set('dark')} /></Row>
        </Card>

        <Card title="데이터 / 백업">
          <Row label="로그 보관 기간"><FakeSelect value="365일" w={100} /></Row>
          <Row label="자동 백업 주기"><FakeSelect value="매일 02:00" w={120} /></Row>
          <Row label="엑셀 다운로드 행 제한"><FakeSelect value="50,000행" w={120} /></Row>
          <Row label="민감정보 마스킹" desc="사업자번호·연락처 마스킹"><Toggle on={t.mask} onChange={set('mask')} /></Row>
        </Card>
      </div>
    </div>
  );
}
