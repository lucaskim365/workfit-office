import { Card } from '@/shared/ui/Card';
import { C, RTypeBadge, MKpis } from '../_report';

type Item = [name: string, type: string, desc: string, cycle: string];
const CAT: { g: string; c: string; items: Item[] }[] = [
  { g: '생산 리포트', c: C.blue, items: [
    ['일일 생산 실적 보고서', 'R1', '교대·라인별 생산/가동/정지 일일 정형 보고', '매일 06:00'],
    ['생산계획 대비 실적', 'R3', '계획 수량 대비 실적·달성률·차이', '일·주·월'],
    ['작업지시 진척 현황', 'R3', 'WO별 진행/완료/지연 집계', '실시간'],
    ['라인/공정별 생산량 집계', 'R3', '기간×라인 교차 피벗', '주·월'],
    ['제품별 생산 추이', 'R5', '일/주/월 시계열 + 기간 비교', '월'],
  ] },
  { g: '품질 리포트', c: C.teal, items: [
    ['검사 합격률(IQC/PQC/OQC)', 'R2', '검사 단계별 합격/불합격 대시보드', '일·월'],
    ['불량 유형 파레토', 'R5', '불량 코드별 발생 순위·누적', '주·월'],
    ['공정능력(Cp/Cpk) 요약', 'R2', '관리 특성별 Cpk 분포', '월'],
    ['협력사 품질 스코어카드', 'R3', '입고 불량률·납기 등급', '월·분기'],
    ['출하 성적서(COA)', 'R1', '로트별 시험성적 정형 출력', '출하 시'],
  ] },
  { g: '설비 리포트', c: '#7a3f97', items: [
    ['OEE 종합 리포트', 'R2', '가용성×성능×품질 분해', '일·월'],
    ['가동률·비가동 분석', 'R2', '설비별 가동/정지 사유 집계', '주·월'],
    ['MTBF/MTTR 신뢰성', 'R5', '고장 간격·수리 시간 추이', '월'],
    ['보전 실적·비용', 'R3', 'PM/BM 건수·정비 비용', '월'],
  ] },
  { g: '자재·재고 리포트', c: '#a9740a', items: [
    ['자재 수불부', 'R1', '기초·입고·출고·기말 정형 명세', '월'],
    ['재고 현황·자산 평가', 'R3', '품목별 수량×단가 평가액', '일·월'],
    ['재고 회전율·장기재고', 'R5', '회전일수·체화 구간', '월'],
    ['안전재고·발주 현황', 'R3', '미달/발주점 도달 품목', '실시간'],
    ['외주 자재 수불', 'R3', '외주처별 지급·투입·잔여', '월'],
  ] },
  { g: '원가·효율 리포트', c: '#2f57b0', items: [
    ['제조원가 집계', 'R3', '자재+노무+경비 원가 요소', '월'],
    ['수율(Yield)·Loss 분석', 'R2', '투입 대비 양품·손실', '일·월'],
    ['공정 리드타임 분석', 'R5', '공정별 소요·대기 시간', '주·월'],
    ['에너지·유틸리티 사용', 'R5', '설비/라인별 사용량 추이', '월'],
  ] },
  { g: '추적·규제 리포트', c: '#0e7a70', items: [
    ['로트 추적 계보', 'R4', '정·역방향 Lot 연결 트리', '필요 시'],
    ['제품 이력 카드(DHR)', 'R4', '단위 제품 생산·검사 전 이력', '필요 시'],
    ['감사추적 로그', 'R3', '변경 이력·사용자 추적', '상시'],
    ['고객 클레임(VOC)·8D', 'R1', '접수·조치·재발방지 보고', '발생 시'],
  ] },
  { g: '경영 대시보드', c: C.navy, items: [
    ['종합 KPI 대시보드', 'R2', '생산성·품질·설비·납기 통합', '실시간'],
    ['기간 비교 트렌드', 'R5', '전월/전년 대비 추이', '월'],
    ['부서/라인 스코어카드', 'R3', '조직 단위 목표 대비 성과', '월'],
  ] },
];
const FAV = ['종합 KPI 대시보드', '일일 생산 실적 보고서', '검사 합격률(IQC/PQC/OQC)', 'OEE 종합 리포트'];

/** 리포트 카탈로그(홈) — 와이어프레임 report-home.jsx 정본. */
export default function ReportCatalogScreen() {
  const flat = CAT.flatMap((g) => g.items.map((it) => ({ it, c: g.c })));
  return (
    <div className="flex flex-col gap-4">
      {/* hero */}
      <div className="relative overflow-hidden rounded-[14px] px-[26px] py-6 text-white" style={{ background: `linear-gradient(135deg, ${C.navyDeep}, ${C.navy} 60%, #26406e)` }}>
        <div className="absolute -right-10 -top-10 h-[200px] w-[200px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(23,168,154,.32), transparent 68%)' }} />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.14em]" style={{ color: '#8fb6f0' }}>REPORT CATALOG</div>
            <div className="mt-1.5 text-2xl font-extrabold tracking-tight">리포트 카탈로그</div>
            <div className="mt-1 text-[12.5px]" style={{ color: '#c8d4ec' }}>7개 분류 · 30개 리포트를 한 곳에서 검색·실행·구독</div>
          </div>
          <div className="relative min-w-[280px]">
            <input placeholder="리포트 검색 (예: OEE, 수불, 파레토)" className="h-[42px] w-full rounded-[10px] border-none bg-white/95 pl-10 pr-4 text-[13px] text-ink outline-none" />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink3">⌕</span>
          </div>
        </div>
      </div>

      <MKpis items={[['전체 리포트', '30', '종'], ['정기 예약', '11', '건', 'teal'], ['내 구독', '4', '건'], ['금월 실행', '1,284', '회']]} />

      {/* favorites */}
      <Card title="★ 즐겨찾는 리포트" action={<span className="text-[10.5px] text-ink3">최근 실행 순</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FAV.map((name) => {
            const f = flat.find((x) => x.it[0] === name)!;
            return (
              <div key={name} className="flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-panel p-3.5">
                <div className="flex items-center justify-between">
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-lg text-sm" style={{ background: f.c + '1a', color: f.c }}>▦</span>
                  <span className="text-sm" style={{ color: '#f5b301' }}>★</span>
                </div>
                <div className="text-xs font-bold leading-tight text-ink">{name}</div>
                <RTypeBadge type={f.it[1]} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* all groups */}
      {CAT.map((grp) => (
        <Card key={grp.g} title={grp.g} action={<span className="text-[10.5px] text-ink3">{grp.items.length}개 리포트</span>}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {grp.items.map((it) => (
              <div key={it[0]} className="flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-panel px-3.5 py-[13px]" style={{ borderLeft: `3px solid ${grp.c}` }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12.5px] font-bold leading-tight text-ink">{it[0]}</span>
                  <span className="shrink-0 text-[13px] text-ink3">☆</span>
                </div>
                <span className="min-h-[30px] text-[10.5px] leading-relaxed text-ink3">{it[2]}</span>
                <div className="mt-0.5 flex items-center justify-between">
                  <RTypeBadge type={it[1]} />
                  <span className="text-[9.5px] font-semibold text-ink3">주기 {it[3]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
