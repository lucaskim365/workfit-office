import { Card } from '@/shared/ui/Card';
import { Pill } from '@/shared/ui/Pill';
import { RHead, RParam, MKpis, RTable, FField, FSel, FInput, type RCol } from '../_report';

const cols: RCol[] = [{ label: '일시', mono: true }, { label: '사용자' }, { label: '대상 메뉴' }, { label: '작업' }, { label: '변경 내용' }, { label: '결과', align: 'center' }];
const raw: string[][] = [
  ['2026-06-21 09:14', '김승기', '품질 기준정보', '검사 기준 수정', 'MX-200 선폭 UCL 변경', '성공'],
  ['2026-06-21 08:52', '이서연', '생산실적', '실적 삭제', 'WO-260620-112 실적 취소', '성공'],
  ['2026-06-20 17:30', 'admin', '사용자 관리', '권한 변경', '박준호 → 생산관리자', '성공'],
  ['2026-06-20 14:08', '최민재', '재고 조정', '수량 조정', 'WF-300-B -15 조정', '승인대기'],
  ['2026-06-20 11:22', '김승기', '메뉴 관리', '메뉴 추가', '자재관리 8개 화면 추가', '성공'],
];
const rows = raw.map((r) => [r[0], r[1], r[2], r[3], r[4], <Pill key="p" tone={r[5] === '성공' ? 'ok' : 'warn'}>{r[5]}</Pill>]);

/** 감사추적 로그 — 와이어프레임 report-trace.jsx 정본. */
export default function ReportAuditScreen() {
  return (
    <div className="flex flex-col gap-3.5">
      <RHead title="감사추적 로그" sub="추적·규제 리포트 / 감사추적 (Audit Trail)" type="R3" />
      <RParam period="2026-06-20 ~ 06-21"><FField label="사용자"><FSel /></FField><FField label="대상"><FSel /></FField><FField label="검색"><FInput ph="변경 내용" w={140} /></FField></RParam>
      <MKpis items={[['총 변경 건', '1,284', '건'], ['데이터 수정', '342', '건'], ['권한 변경', '18', '건'], ['승인 대기', '6', '건', 'teal']]} />
      <Card title="시스템 변경 이력 (데이터·권한·설정)" bodyClassName="p-0" action={<span className="text-[10.5px] text-ink3">최신순 · 변경 전/후 값 보존</span>}>
        <RTable cols={cols} rows={rows} rowKey={1} />
      </Card>
    </div>
  );
}
