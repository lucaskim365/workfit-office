import { useParams } from 'react-router-dom';
import { GW_APP_META } from '@/app/shell/gw-screens';

/**
 * 그룹웨어 미구현 앱 랜딩(Phase 0) — 도크 타일 라우팅이 동작함을 보여준다.
 * 각 앱은 상위 계획서 로드맵에 따라 실화면으로 순차 대체.
 */
export default function GwComingSoon() {
  const { app = '' } = useParams();
  const meta = GW_APP_META[app] ?? { name: '그룹웨어', icon: '▦', desc: '' };
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 text-xs font-medium text-ink3">그룹웨어 <span className="px-1">/</span> {meta.name}</div>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-soft text-teal">{meta.icon}</span>
        <h1 className="text-xl font-bold text-ink">{meta.name}</h1>
      </div>
      <div className="mt-5 grid place-items-center rounded-xl border border-dashed border-border bg-panel px-8 py-16 text-center">
        <div className="text-4xl">{meta.icon}</div>
        <div className="mt-3 text-[15px] font-bold text-ink">준비 중인 기능입니다</div>
        {meta.desc && <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-ink3">{meta.desc}</p>}
        <div className="mt-4 rounded-full bg-amber/10 px-3 py-1 text-[11px] font-bold text-amber">개발 로드맵에 따라 순차 오픈 예정</div>
      </div>
    </div>
  );
}
