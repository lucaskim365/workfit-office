import type { SpareScrap } from '@/domain/spareScrap/schema';

/**
 * 예비품 폐기·불용(SpareScrap) 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 spare-scrap 화면 인라인 SCRAP_ROWS 전체 이관)
 */
export const SPARE_SCRAP_SEED: SpareScrap[] = [
  { no: 'DS-2606-007', code: 'SP-PMP-DM', name: '다이어프램 펌프', cat: '기구부품', unit: 'EA', qty: 3, book: 420000, recover: 45000, reason: '장기미사용', idle: 98, reqDate: '06-09', reqBy: '김설비', state: '승인대기', appr: '–' },
  { no: 'DS-2606-006', code: 'SP-RFMN-30', name: 'RF 매칭 네트워크', cat: '전장부품', unit: 'EA', qty: 1, book: 3200000, recover: 280000, reason: '단종(EOL)', idle: 80, reqDate: '06-08', reqBy: '이정비', state: '승인대기', appr: '–' },
  { no: 'DS-2606-005', code: 'SP-GSK-OLD', name: '구형 가스켓 세트', cat: '소모성', unit: 'SET', qty: 40, book: 38000, recover: 0, reason: '사양변경', idle: 140, reqDate: '06-05', reqBy: '김자재', state: '승인완료', appr: '박팀장' },
  { no: 'DS-2606-004', code: 'SP-BRG-OLD', name: '구형 스핀들 베어링', cat: '정밀부품', unit: 'EA', qty: 2, book: 510000, recover: 60000, reason: '단종(EOL)', idle: 210, reqDate: '06-03', reqBy: '김설비', state: '폐기완료', appr: '박팀장' },
  { no: 'DS-2606-003', code: 'SP-VLV-DM', name: '손상 공압 밸브', cat: '기구부품', unit: 'EA', qty: 4, book: 165000, recover: 12000, reason: '손상/파손', idle: 30, reqDate: '06-02', reqBy: '이정비', state: '반려', appr: '박팀장' },
  { no: '–', code: 'SP-SEN-OLD', name: '구형 온도센서', cat: '전장부품', unit: 'EA', qty: 6, book: 72000, recover: 5000, reason: '장기미사용', idle: 175, reqDate: '–', reqBy: '–', state: '불용지정', appr: '–' },
  { no: '–', code: 'SP-CBL-LAN', name: '폐 LAN 하네스', cat: '전장부품', unit: 'EA', qty: 12, book: 28000, recover: 8000, reason: '사양변경', idle: 120, reqDate: '–', reqBy: '–', state: '불용지정', appr: '–' },
];
