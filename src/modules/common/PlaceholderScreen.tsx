import type { FlatScreen } from '@/shared/types/menu';

interface PlaceholderScreenProps {
  screen?: FlatScreen;
}

/**
 * Phase 0 임시 화면 — 라우팅이 정상 동작함을 보여주는 플레이스홀더.
 * Phase 1부터 각 화면을 와이어프레임 기준 실제 컴포넌트로 대체한다.
 */
export default function PlaceholderScreen({ screen }: PlaceholderScreenProps) {
  if (!screen) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div>
          <div className="text-5xl text-ink3">◌</div>
          <h1 className="mt-3 text-lg font-bold text-ink">화면을 찾을 수 없습니다</h1>
          <p className="mt-1 text-sm text-ink2">요청한 경로에 해당하는 화면이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* 브레드크럼 */}
      <div className="mb-1 text-xs font-medium text-ink3">
        {screen.moduleName} <span className="px-1">/</span> {screen.groupName}
      </div>

      {/* 타이틀 */}
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">
          {screen.icon}
        </span>
        <h1 className="text-xl font-bold text-ink">{screen.name}</h1>
      </div>

      {/* 플레이스홀더 카드 */}
      <div className="mt-5 rounded-xl border border-border bg-panel p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy">
          <span className="inline-block h-2 w-2 rounded-full bg-teal" />
          Phase 0 스캐폴딩 — 라우팅 동작 확인용 화면
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink2">
          이 화면은 와이어프레임(<code className="rounded bg-panel-alt px-1.5 py-0.5 text-[12px] text-navy">mes layout</code>)
          기준의 실제 UI로 Phase 1에서 대체됩니다. 현재는 상단 모듈 내비 → 좌측
          사이드바 → 콘텐츠 라우팅이 정상 연결되는지 검증하는 용도입니다.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink3">경로(URL)</dt>
            <dd className="mt-0.5 font-mono text-[13px] text-ink">{screen.url}</dd>
          </div>
          <div>
            <dt className="text-ink3">화면 ID</dt>
            <dd className="mt-0.5 font-mono text-[13px] text-ink">{screen.id}</dd>
          </div>
          <div>
            <dt className="text-ink3">모듈 / 그룹</dt>
            <dd className="mt-0.5 text-[13px] text-ink">
              {screen.moduleName} / {screen.groupName}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
