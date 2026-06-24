import type { AlarmMaster } from '@/domain/alarmMaster/schema';

/**
 * 알람·에러 코드 마스터 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 equip-alarm.jsx 의 인라인 CODES 이관 — type별 1 도큐먼트)
 */
export const ALARM_MASTER_SEED: AlarmMaster[] = [
  {
    type: 'CMP',
    codes: [
      { code: 'AL-1021', name: '슬러리 공급 압력 저하', sev: '경고', part: '슬러리 공급부', il: false, auto: '수동', cnt: 12, cause: '슬러리 탱크 잔량 부족 또는 공급 펌프 토출 압력 저하', fix: ['슬러리 탱크 잔량 확인 및 보충', '공급 펌프 토출 압력 점검 (정상 0.2~0.4 MPa)', '공급 라인 막힘·누설 점검'], chk: '슬러리 공급 압력', mtba: '18일', last: '06-08 11:24' },
      { code: 'AL-1044', name: '헤드 진공 이상', sev: '중대', part: '헤드 캐리어', il: true, auto: '수동', cnt: 4, cause: '진공 라인 누설 또는 진공 펌프 성능 저하로 웨이퍼 흡착 불량', fix: ['진공 라인 O-Ring 상태 점검·교체', '진공 펌프 성능 점검', '재기동 후 흡착 테스트'], chk: '헤드 진공 누설', mtba: '42일', last: '05-21 09:10' },
      { code: 'AL-1102', name: '패드 수명 초과', sev: '주의', part: '연마 플래튼', il: false, auto: '수동', cnt: 8, cause: '연마 패드 누적 사용량이 교체 기준 초과', fix: ['연마 패드 교체 작업 실시', '교체 후 컨디셔닝 수행', '패드 카운터 리셋'], chk: '연마 패드 마모도', mtba: '25일', last: '06-02 14:40' },
      { code: 'AL-1150', name: 'End-point 미검출', sev: '중대', part: 'End-point 검출 유닛', il: true, auto: '수동', cnt: 3, cause: '검출 센서 오염 또는 광학계 정렬 불량', fix: ['센서 렌즈 청소', '광학계 캘리브레이션', '검출 신호 확인 후 재기동'], chk: 'End-point 신호', mtba: '55일', last: '05-30 16:02' },
    ],
  },
  {
    type: 'Etch',
    codes: [
      { code: 'AL-2010', name: 'RF 반사파 과다', sev: '중대', part: 'RF 제너레이터', il: true, auto: '수동', cnt: 9, cause: '매칭 네트워크 부정합으로 반사파 증가', fix: ['매칭 네트워크 자동 튜닝 수행', '매칭 커패시터 점검', 'RF 케이블·커넥터 점검'], chk: 'RF 매칭 상태', mtba: '20일', last: '06-09 14:08' },
      { code: 'AL-2033', name: '챔버 압력 이상', sev: '경고', part: '챔버 A/B', il: false, auto: '자동', cnt: 14, cause: 'APC 밸브 응답 지연 또는 진공 펌프 배기 능력 저하', fix: ['APC 밸브 동작 점검', '진공 펌프 배기 성능 확인', '압력 센서 캘리브레이션'], chk: '챔버 압력', mtba: '15일', last: '06-10 13:51' },
      { code: 'AL-2077', name: '가스 라인 누설', sev: '중대', part: '가스 박스', il: true, auto: '수동', cnt: 2, cause: '가스 라인 피팅 풀림 또는 O-Ring 경화', fix: ['He 리크 테스트 실시', '누설 부위 피팅 재체결', 'O-Ring 교체'], chk: '가스 누설 점검', mtba: '60일', last: '05-12 10:30' },
      { code: 'AL-2099', name: '온도 인터록', sev: '주의', part: '냉각 유닛', il: false, auto: '자동', cnt: 6, cause: '냉각수 유량 저하로 온도 상승', fix: ['냉각수 유량 확인', '칠러 동작 점검', '필터 청소'], chk: '냉각수 유량', mtba: '30일', last: '06-04 08:20' },
    ],
  },
  {
    type: 'Photo',
    codes: [
      { code: 'AL-3005', name: '스테이지 정렬 실패', sev: '중대', part: '웨이퍼 스테이지', il: true, auto: '수동', cnt: 5, cause: '스테이지 구동계 오차 또는 얼라인먼트 마크 인식 실패', fix: ['얼라인먼트 재수행', '스테이지 캘리브레이션', '마크 검사 광학계 점검'], chk: '스테이지 정렬', mtba: '38일', last: '05-28 11:15' },
      { code: 'AL-3041', name: '광원 출력 저하', sev: '경고', part: '광원 유닛', il: false, auto: '수동', cnt: 7, cause: '광원 램프 누적 사용으로 출력 감소', fix: ['램프 수명 카운터 확인', '램프 교체', '출력 캘리브레이션'], chk: '광원 출력', mtba: '28일', last: '06-10 14:05' },
      { code: 'AL-3088', name: '환경 온도 편차', sev: '주의', part: '챔버 환경', il: false, auto: '자동', cnt: 11, cause: '항온항습 설비 제어 편차', fix: ['항온항습 설비 점검', '온도 센서 확인', '공조 밸브 점검'], chk: '온습도 환경', mtba: '22일', last: '06-10 13:08' },
      { code: 'AL-3120', name: '레티클 로드 오류', sev: '중대', part: '레티클 스테이지', il: true, auto: '수동', cnt: 3, cause: '레티클 핸들러 동작 불량', fix: ['핸들러 리셋', '레티클 재투입', '핸들러 구동부 점검'], chk: '레티클 로드', mtba: '50일', last: '05-19 15:40' },
    ],
  },
  {
    type: 'Depo',
    codes: [
      { code: 'AL-4012', name: '히터 온도 이탈', sev: '중대', part: '히터 컨트롤러', il: true, auto: '수동', cnt: 6, cause: '히터 단선 또는 열전대 측정 오차', fix: ['히터 저항 점검', '열전대 교체', '온도 제어 파라미터 확인'], chk: '히터 온도 편차', mtba: '35일', last: '06-06 12:30' },
      { code: 'AL-4050', name: 'MFC 유량 이상', sev: '경고', part: '가스 박스', il: false, auto: '자동', cnt: 10, cause: 'MFC 드리프트 또는 막힘', fix: ['MFC 캘리브레이션', 'MFC 막힘 점검', '필요 시 MFC 교체'], chk: '가스 유량(MFC)', mtba: '24일', last: '06-08 09:50' },
      { code: 'AL-4081', name: '챔버 누설', sev: '중대', part: '프로세스 챔버', il: true, auto: '수동', cnt: 3, cause: '챔버 도어 씰 또는 라인 누설', fix: ['챔버 리크 점검', '도어 씰 교체', '진공 라인 점검'], chk: '챔버 누설률', mtba: '48일', last: '05-25 13:22' },
      { code: 'AL-4110', name: '가스 잔압 경고', sev: '주의', part: '가스 캐비닛', il: false, auto: '자동', cnt: 8, cause: '공정 가스 실린더 잔량 부족', fix: ['가스 실린더 잔량 확인', '실린더 교체 준비', '잔압 알람 기준 확인'], chk: '가스 잔압', mtba: '20일', last: '06-07 10:05' },
    ],
  },
  {
    type: 'Implant',
    codes: [
      { code: 'AL-5008', name: '빔 전류 불안정', sev: '중대', part: '이온 소스', il: true, auto: '수동', cnt: 7, cause: '이온 소스 필라멘트 열화 또는 소스 가스 불안정', fix: ['이온 소스 상태 점검', '필라멘트 교체', '소스 가스 유량 확인'], chk: '빔 전류 안정도', mtba: '30일', last: '06-05 16:18' },
      { code: 'AL-5044', name: '진공도 저하', sev: '경고', part: '엔드 스테이션', il: false, auto: '자동', cnt: 9, cause: '진공 펌프 성능 저하 또는 게이지 오차', fix: ['진공 펌프 점검', '진공 게이지 캘리브레이션', '누설 점검'], chk: '진공도 확인', mtba: '26일', last: '06-10 13:51' },
      { code: 'AL-5070', name: '고전압 방전', sev: '중대', part: '가속관', il: true, auto: '수동', cnt: 4, cause: '가속관 절연 열화로 방전 발생', fix: ['절연부 점검', '가속관 청소', '재기동 후 고전압 테스트'], chk: '고전압 절연', mtba: '44일', last: '05-22 14:30' },
      { code: 'AL-5101', name: '소스 수명 임박', sev: '주의', part: '이온 소스', il: false, auto: '자동', cnt: 6, cause: '이온 소스 누적 사용량이 교체 기준 근접', fix: ['이온 소스 교체 준비', '수명 카운터 확인', '예비 소스 재고 확인'], chk: '이온 소스 수명', mtba: '28일', last: '06-03 11:40' },
    ],
  },
  {
    type: 'Thermal',
    codes: [
      { code: 'AL-6003', name: '튜브 과승온', sev: '중대', part: '퍼니스 튜브', il: true, auto: '수동', cnt: 5, cause: '히터 제어 이상 또는 열전대 단선으로 과승온', fix: ['히터 전원 차단', '열전대 점검·교체', '온도 제어기 점검 후 재기동'], chk: '튜브 온도 프로파일', mtba: '40일', last: '06-10 14:22' },
      { code: 'AL-6029', name: '보트 구동 이상', sev: '경고', part: '보트 엘리베이터', il: false, auto: '수동', cnt: 8, cause: '엘리베이터 구동부 마모 또는 이물', fix: ['구동부 점검·윤활', '이상음 확인', '벨트·기어 점검'], chk: '보트 구동 상태', mtba: '25일', last: '06-08 10:12' },
      { code: 'AL-6055', name: '가스 압력 저하', sev: '주의', part: '가스 패널', il: false, auto: '자동', cnt: 7, cause: '퍼지 가스 공급 압력 저하', fix: ['가스 패널 압력 확인', '레귤레이터 점검', '공급 라인 점검'], chk: '가스 퍼지 압력', mtba: '22일', last: '06-06 09:30' },
      { code: 'AL-6090', name: '튜브 균열 감지', sev: '중대', part: '석영 튜브', il: true, auto: '수동', cnt: 2, cause: '석영 튜브 열충격으로 미세 균열 발생', fix: ['석영 튜브 교체', '튜브 취급 절차 점검', '승온 속도 재설정'], chk: '석영 튜브 균열', mtba: '70일', last: '05-08 13:00' },
    ],
  },
  {
    type: 'Clean',
    codes: [
      { code: 'AL-7011', name: '케미컬 농도 이탈', sev: '경고', part: '케미컬 배스', il: false, auto: '자동', cnt: 11, cause: '케미컬 노후 또는 보충량 오차로 농도 이탈', fix: ['케미컬 농도 측정', '케미컬 보충·교체', '농도 제어 파라미터 확인'], chk: '케미컬 농도', mtba: '20일', last: '06-09 13:40' },
      { code: 'AL-7034', name: 'DI수 비저항 저하', sev: '중대', part: '린스 모듈', il: true, auto: '수동', cnt: 3, cause: 'DI 공급 설비 이상으로 비저항 저하', fix: ['DI 공급 설비 점검', '비저항 측정기 확인', 'DI 라인 플러싱'], chk: 'DI수 비저항', mtba: '50일', last: '05-27 11:20' },
      { code: 'AL-7060', name: '배스 온도 이상', sev: '주의', part: '케미컬 배스', il: false, auto: '자동', cnt: 9, cause: '배스 히터 또는 온도 센서 이상', fix: ['배스 히터 점검', '온도 센서 확인', '온도 제어기 점검'], chk: '배스 온도', mtba: '24일', last: '06-07 15:10' },
      { code: 'AL-7088', name: '필터 차압 초과', sev: '경고', part: '린스 모듈', il: false, auto: '수동', cnt: 8, cause: '필터 막힘으로 차압 상승', fix: ['필터 차압 확인', '필터 교체', '교체 주기 재검토'], chk: '필터 차압', mtba: '26일', last: '06-05 10:40' },
    ],
  },
];
