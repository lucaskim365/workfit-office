import { qIt, type PmQuote, type QuoteDraft } from './quote';

/**
 * 데모 전용 테스트 값 (데모 qDemo 5039) — 프관/돈/2027/명성ENG 정부지원사업 지원 견적서 20261106_워크핏주식회사.xlsx.
 * 기대값: 합계 368,981,000 · 매입 205,661,000 · ① 399,581,000 · ③ 199,790,500 · ⑦ 169,190,500.
 * 품목 · 세부 내역 · 비고 글자는 원본 파일 그대로 (데모 파일에서 뽑아 넣음). 화면의 [테스트 값 채우기]는 개발 서버에서만 보임.
 */
export const MYUNGSUNG_QUOTE = (): PmQuote => ({ date:'2026-11-06', no:'Workfit-SF20261106-001', to:'명성ENG', ref:'유진호 지사장님', mgr:'AX사업본부 AX영업팀 홍형표 팀장', valid:'견적일로부터 1개월', pay:'현금결제 조건', proj:'명성이앤지 스마트공장 구축 지원사업 MES 구축 견적의 건', remarks: '',
  items: [qIt('sw', {"name":"MES\n(소프트웨어 개발)","desc":"■ 웹기반 클라우드형 MES\n ▪ 대시보드 (공장현황 모니터링) 및 현황 조회\n ▪ 기준정보관리 (품목관리, 외주관리, 설비정보 등)\n ▪ 수주관리 (명세서 등록, 관리번호 발급, 수주 현황 관리 및 조회)\n ▪ 생산관리 (생산계획 , 생산지시, 작업시작/완료 관리)\n ▪ 품질관리 (품질기준 관리, 3차원 측정 결과 관리, 부적합 관리 등)\n ▪ 외주 관리 (외주 발주, 출고/입고 관리, 이력관리)\n ▪ 도면관리 (수주도면 관리, 도면 PDF 조회)\n ▪ 설비관리 (설비현황 · 설비알람조치 · 설비임계치관리)\n ▪ 바코드/PDA (바코드 라벨 발행, 작업 시작/완료, 외주 출/입고 등)  \n ▪ 시스템관리  ▪ 사용자 요구사항에 따른 커스터마이징 포함","qty":1,"unit":"식","price":132000000,"cat":"MES개발비","note":"MES  신규개발\n(기능개선 포함)"}),
      qIt('sw', {"name":"미들웨어 전처리","desc":"■ 설비데이터 전처리(미들웨어)\n ▪ 설비데이터 Read 기준\n ▪ LS Modbus TCP/IP 기준","qty":1,"unit":"식","price":5000000,"cat":"전처리"}),
      qIt('sw', {"name":"스마트팩토리\n진행경비","desc":"■ 업무수행과제\n ▪ 사업신청서 작성   ▪ 사업계획서 작성\n ▪ 스마트공장 신청 및 접수   ▪ 기술성평가 수검\n ▪ 현장점검 수검   ▪ 원가계산 자료 작성 및 제출\n ▪ 과제협약   ▪ 착수계 작성 및 사업 일정표 작성\n ▪ 각종 회의록 작성   ▪ 일일 / 주간 / 월간 업무수행일지 작성\n ▪ 중간점검보고서 작성   ▪ 완료점검보고서 작성\n ▪ 사업감리 수행   ▪ 지방비 공고 확인 및 지원 신청서 작성 등","qty":1,"unit":"set","price":15000000,"cat":"경비"}),
      qIt('hw', {"name":"3차원 측정기\n(1대 기준)","desc":"■ 3차원 측정 장비\n ▪ 상세사양 명성ENG에서 제공 필요","qty":1,"unit":"set","price":160000000,"cat":"설비","cost":160000000}),
      qIt('hw', {"name":"PDA","desc":"■ 포인트모바일 Model : PM95\n ▪ 크기 : (L x W x D) : 164.8 x 78 x 17.6 mm  ▪ 무게 : 283 g\n ▪ 배터리 : 기본 배터리: 4,950 mAh\n ▪ 디스플레이 : 6” (1080 x 2160 픽셀)  ▪  FHD+LED 백라이트 \n ▪ 주간 시인성 (500 nits, typical)  ▪  멀티 터치 정전식 스크린  \n ▪ Corning Gorilla Glass\n ▪ 운영체제 : Android 13 (Android 18까지 업그레이드 가능)\n ▪ CPU : Octa-core @2.4GHz  ▪ 메모리 : 6 GB/64GN (UFS)\n ▪ 무선 데이터","qty":2,"unit":"set","price":1200000,"cat":"디바이스","cost":500000}),
      qIt('hw', {"name":"라벨프린터","desc":"■ ZT-231\n ▪ 해상도 : 203 dpi(1밀리미터당 8도트)\n ▪ 메모리 : 256MB SDRAM 메모리\n ▪ 프린트 속도 : 12 ips(203 dpi)\n ▪ 최대 프린트 길이 : 203dpi: 157인치/3988밀리미터\n ▪ 통신 : 10/100 이더넷\n ▪ 현장 납품 및 설치 조건","qty":2,"unit":"set","price":1200000,"cat":"디바이스","cost":1200000}),
      qIt('hw', {"name":"키오스크","desc":"■ 모니터 21.5\" 1920*1080  Intel UHD Graphics\n■ 하프 미니PC   모델 : 6235ANHMW \n ▪ 12th Intel®Alder-lake-N :  N100 (Quad-Core 0.7GHz)\n ▪ 250cd/m²   ▪ DDR4 8G  ▪  M.2 NVMe SSD 128G \n ▪ 저항막(압력식) 터치   \n ▪ VGA*1/RS232C*2/HDMI*1 * DC 12V*1/USB*4/LAN*1 \n ▪ Win11 IoT Enterprise Entry ","qty":2,"unit":"set","price":2400000,"cat":"디바이스","cost":2400000}),
      qIt('hw', {"name":"엣지PC","desc":"■ OPC-UA Edge PC(설비데이터 클라우드 연계)\n ▪ CPU : intel Core i7-13700(내장 UHD 탑재)\n ▪ OS : Windows 11Pro\n ▪ 메인보드 : Asus Prime B660M-k D4 인텍앤컴퍼니\n ▪ RAM : DDR4-3200 16GB * 2 \n ▪ HDD : SSD 1TB","qty":1,"unit":"set","price":2760000,"cat":"디바이스","cost":1750000}),
      qIt('hw', {"name":"현황판TV\n 및 현황판PC","desc":"■ 현황판TV  \n ▪ 삼성전자 : LH65(발주시 모델명 계속변경)\n ▪ 상업용디스플레이  ▪ 65인치(164cm)  ▪ 실내용  \n ▪ 디스플레이모듈  ▪ 4K UHD 기본 벽걸이 ▪ 기본스텐드 포함\n■ 현황판PC \n ▪ 프로미니 260 G9 7305 \n ▪ 4GB RAM ▪ 256GB SSD  ▪ HDD 미포함  ▪ 운영체제 미포함\n ▪ 내장그래픽 ▪ DisplayPort ▪ HDMI ▪ 시리얼포트 ▪ USB-C\n ▪ LAN ▪ USB3.2 ▪ USB3.1 ▪ USB3.0 ▪ USB2.0 ▪ USB-A \n ▪ ODD미포함 ▪ 블루투스 ▪ 무선랜 ▪ Pro Mini ▪ 미니타워\n ▪ 현장 설치 + 랙마운트","qty":2,"unit":"set","price":2880000,"cat":"디바이스","cost":2300000}),
      qIt('hw', {"name":"디지매틱 캘리퍼스","desc":"■ 디지매틱 캘리퍼스 \n ▪ 캘리퍼스\n ▪ U-WAVE 송신기\n ▪ U-WAVE 수신기\n ▪ 연결 유닛","qty":2,"unit":"set","price":925500,"cat":"디바이스","cost":925500}),
      qIt('hw', {"name":"설비 I/F\n(기공설비 10대)","desc":"■ 기공설비 10대 설비 I/F\n(1) 자재\n ▪ PANEL 600*800*250 1LOT\n ▪ MCCB & CP : EBS32fb 5A 1EA, LCP 32FM 1EA\n ▪ PLC : XBM-DN32H, XTB-40H & CABLE, XBI-C41B, Ethernet module\n ▪ POWER SUPPLY & HUB 5A 1EA\n ▪ Fanuc S/W : MT-LINK, CNC Set-Up\n ▪ OPC Server : DXP OPC Server\n(2) 인건비/기타\n ▪ 제작 인건비  ▪ 설치 인건비  ▪ PROGRAM  ▪ 기타 경비","qty":1,"unit":"set","price":28450000,"cat":"PLC","cost":22000000}),
      qIt('hw', {"name":"네트워크 공사","desc":"■ 명성이엔지(인천공장) 공장동 설비인터페이스구축 공사\n(1) 통신자재\n ▪ UTP CABLE CAT6 4P 노랑색(부속자재포함) : 720M\n ▪ 전선보호관 후렉시블 16mm(350m), 난연CD배관 22mm(200m)\n ▪ 전선관 부속자재 : 전선관의 15%\n ▪ 기타 잡자재 : 케이블타이 외 8종\n ▪ 튜브 작업 : CAT.6 네임작업 24EA\n ▪ 마스터 PLC : 장착 및 타공작업\n(2) 노무비\n ▪ 통신케이블공 5인, 통신내선공 2인","qty":1,"unit":"set","price":6200000,"cat":"네트워크","cost":4900000}),
      qIt('etc', {"name":"교육비","desc":"  ▪ 스마트공장 의무 교육","qty":1,"unit":"set","price":1000000,"cat":"기타(임치·정산·교육)"}),
      qIt('etc', {"name":"기술임치비용","desc":"  ▪ MES 프로그램 기술임치(2년)","qty":1,"unit":"set","price":450000,"cat":"기타(임치·정산·교육)"}),
      qIt('etc', {"name":"회계법인정산수수료","desc":"  ▪ 회계정산 수수료 (사업비 4억 미만 기준)","qty":1,"unit":"set","price":910000,"cat":"기타(임치·정산·교육)"})] });
/** 원본 엑셀: ① × 50% (최대 2억) → 전국 부처협업형 기준 */
export function fillMyungsung(E: QuoteDraft, ruleId: string): QuoteDraft {
  return { ...E, name: E.name || '테스트 견적 (명성ENG 값)', kind: '정부지원', q: MYUNGSUNG_QUOTE(), f: { rule: ruleId, man: 18000000, cloudMonthly: 350000, cloudM: 36, local: null } };
}
