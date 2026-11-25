/**
 * 아직 옮기지 않은 화면 자리. 단계 번호는 설계 문서 §5 구현 순서.
 * 화면을 옮길 때마다 PmScreen 에서 해당 보기를 실제 화면으로 바꾸고, 여기 표에서 지운다.
 */
const STAGE_OF: Record<string, number> = {
  'dash/overview': 3, 'dash/site': 3, 'dash/team': 3, 'sched/load': 3, 'dash/hours': 3, 'dash/my': 3, 'dash/plan': 3,
  'doc/insp': 4, 'site/cr': 4, 'doc/audit': 4,
  'risk/issue': 5, 'doc/meet': 5, 'doc/check': 5, 'doc/report': 5,
  'money/site': 6, 'money/pl': 6, 'master/base': 6, 'money/rules': 6, 'money/items': 6, 'master/log': 6,
};

export function PmPlaceholder({ viewId }: { viewId: string }) {
  const stage = STAGE_OF[viewId];
  return (
    <div className="grid min-h-[calc(40vh/var(--font-scale,1))] place-items-center rounded-lg border border-dashed border-border-hi bg-panel-alt px-6 text-center">
      <div>
        <div className="text-[13px] font-bold text-ink2">옮기는 중인 화면입니다</div>
        <p className="mt-1.5 text-[11.5px] text-ink3">
          PM 데모의 이 화면은 {stage ? `${stage}단계` : '다음 단계'}에서 옮깁니다.
        </p>
      </div>
    </div>
  );
}
