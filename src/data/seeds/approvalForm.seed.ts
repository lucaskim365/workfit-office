import type { ApprovalForm, FormField } from '@/domain/approvalForm/schema';

/**
 * 결재서식 시드 — Firebase 미설정 시 폴백 + 초기 seed.
 * 기본 4종(기안·품의·지출결의·휴가)은 system=true(삭제 보호). code 는 기존 docType 값과 동일해
 * 기존 문서·결재선 규칙과 호환. 휴가는 잔여일수 로직 때문에 전용 leave 위젯을 코드에서 렌더한다.
 * 커스텀 예제로 출장신청서(section·2열·기간·선택·금액 필드)를 함께 제공.
 */

const f = (field: Partial<FormField> & Pick<FormField, 'key' | 'label' | 'type'>): FormField => ({
  required: false, options: [], placeholder: '', width: 'full', section: '', isAmountKey: false, visibleIf: null, isTabSelector: false, ...field,
});

export const APPROVAL_FORM_SEED: ApprovalForm[] = [
  // ── [인사] 기본 및 커스텀 ──
  {
    id: '기안', code: '기안', name: '기안서', icon: '📝', docTitle: '기 안 서',
    closing: '위와 같이 기안하오니 재가하여 주시기 바랍니다.', active: true, order: 1, system: false, folderId: null,
    fields: [
      f({ key: 'body', label: '기안내용', type: '장문', required: true, section: '내용' }),
      f({ key: 'note', label: '비고', type: '텍스트', section: '내용' }),
    ],
  },
  {
    id: '휴가', code: '휴가', name: '휴가원', icon: '🌴', docTitle: '휴 가 원',
    closing: '위와 같이 휴가를 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 2, system: false, folderId: 'fld-hr',
    fields: [
      f({ key: 'period', label: '사용기간', type: '기간', required: true, width: 'half' }),
      f({ key: 'leaveType', label: '휴가종류', type: '선택', required: true, width: 'half', options: ['연차', '반차', '병가', '경조사', '기타'] }),
      f({ key: 'contactNumber', label: '긴급 연락처', type: '숫자', required: true, width: 'full' }),
      f({ key: 'body', label: '사유', type: '장문', required: true }),
    ],
  },
  {
    id: '연장근로', code: '연장근로', name: '연장근로 신청서', icon: '⏰', docTitle: '연 장 근 로 신 청 서',
    closing: '위와 같이 연장근로를 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 3, system: false, folderId: 'fld-hr',
    fields: [
      f({ key: 'workDate', label: '근무 일자', type: '날짜', required: true, width: 'half' }),
      f({ key: 'workHours', label: '근무 시간(시간)', type: '숫자', required: true, width: 'half', placeholder: '예: 4' }),
      f({ key: 'body', label: '근무 사유 및 세부 계획', type: '장문', required: true }),
    ],
  },
  {
    id: '외근', code: '외근', name: '외근 신청서', icon: '🏃', docTitle: '외 근 신 청 서',
    closing: '위와 같이 외근을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 4, system: false, folderId: 'fld-hr',
    fields: [
      f({ key: 'period', label: '외근 기간/시간', type: '기간', required: true, width: 'full' }),
      f({ key: 'destination', label: '외근지', type: '텍스트', required: true, width: 'full' }),
      f({ key: 'body', label: '외근 목적 및 업무 내용', type: '장문', required: true }),
    ],
  },

  {
    id: '국내출장', code: '국내출장', name: '국내출장 신청서', icon: '🚗', docTitle: '국 내 출 장 신 청 서',
    closing: '위와 같이 국내출장을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 5, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'destination', label: '출장지', type: '텍스트', required: true, width: 'half', section: '출장 정보', placeholder: '예: 부산 고객사' }),
      f({ key: 'purpose', label: '목적', type: '선택', required: true, width: 'half', section: '출장 정보', options: ['영업', '기술지원', '교육', '회의', '기타'] }),
      f({ key: 'period', label: '출장 기간', type: '기간', required: true, width: 'full', section: '출장 정보' }),
      f({ key: 'companions', label: '동행자', type: '텍스트', width: 'half', section: '출장 정보', placeholder: '없으면 비움' }),
      f({ key: 'amount', label: '예상 경비', type: '금액', required: true, isAmountKey: true, width: 'full', section: '비용 정보' }),
      f({ key: 'body', label: '상세 일정 및 계획', type: '장문', required: true }),
    ],
  },
  {
    id: '해외출장', code: '해외출장', name: '해외출장 신청서', icon: '✈️', docTitle: '해 외 출 장 신 청 서',
    closing: '위와 같이 해외출장을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 6, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'overseasType', label: '해외출장 구분', type: '선택', required: true, width: 'half', options: ['일반 해외출장', '비자 및 여권 발급'] }),
      f({ key: 'destination', label: '출장지', type: '텍스트', required: true, width: 'half', placeholder: '예: 미국 지사' }),
      f({ key: 'purpose', label: '목적', type: '선택', required: true, width: 'half', options: ['영업', '기술지원', '교육', '회의', '기타'] }),
      f({ key: 'period', label: '출장 기간', type: '기간', required: true, width: 'full' }),
      f({ key: 'companions', label: '동행자', type: '텍스트', width: 'half', placeholder: '없으면 비움' }),
      f({ key: 'amount', label: '예상 경비', type: '금액', required: true, isAmountKey: true, width: 'full' }),
      f({ key: 'body', label: '상세 일정 및 계획', type: '장문', required: true }),
    ],
  },
  {
    id: '식대', code: '식대', name: '식대 신청서', icon: '🍲', docTitle: '식 대 신 청 서',
    closing: '위와 같이 식대를 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 8, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'expenseType', label: '식대 구분', type: '선택', required: true, width: 'half', options: ['간식대', '외근식대', '야근식대'] }),
      f({ key: 'amount', label: '청구 금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'useDate', label: '사용 일자', type: '날짜', required: true, width: 'full' }),
      f({ key: 'body', label: '상세 내용 및 사유', type: '장문', required: true }),
    ],
  },
  {
    id: '회식비', code: '회식비', name: '회식비 청구서', icon: '🍻', docTitle: '회 식 비 청 구 서',
    closing: '위와 같이 회식비를 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 9, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'expenseType', label: '회식 구분', type: '선택', required: true, width: 'half', options: ['부서원 회식', '특별회식(전체 회식)'] }),
      f({ key: 'amount', label: '청구 금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'useDate', label: '사용 일자', type: '날짜', required: true, width: 'full' }),
      f({ key: 'body', label: '회식 사유 및 인원 정보', type: '장문', required: true }),
    ],
  },
  {
    id: '회의비', code: '회의비', name: '회의비 청구서', icon: '📝', docTitle: '회 의 비 청 구 서',
    closing: '위와 같이 회의비를 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 10, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'amount', label: '회의비 금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'useDate', label: '사용 일자', type: '날짜', required: true, width: 'half' }),
      f({ key: 'body', label: '회의 내용 및 사유', type: '장문', required: true }),
    ],
  },
  {
    id: '교통비', code: '교통비', name: '교통비 청구서', icon: '🚕', docTitle: '교 통 비 청 구 서',
    closing: '위와 같이 교통비를 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 11, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'expenseType', label: '교통비 구분', type: '선택', required: true, width: 'half', options: ['야근 후 택시비', '외근 교통비', '외근 택시비', '외근 / 야근 주유비'] }),
      f({ key: 'amount', label: '청구 금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'useDate', label: '날짜', type: '날짜', required: true, width: 'full' }),
      f({ key: 'body', label: '이동 경로 및 사유', type: '장문', required: true }),
    ],
  },
  {
    id: '보험', code: '보험', name: '보험 관련 신청서', icon: '🛡️', docTitle: '보 험 관 련 신 청 서',
    closing: '위와 같이 보험 관련 신청을 하오니 재가하여 주시기 바랍니다.', active: true, order: 12, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'insuranceType', label: '보험 종류', type: '선택', required: true, width: 'half', options: ['단체 상해 보험 가입자 변경', '단체 상해 보험 만기 후 재가입', '화재보험', '자동차보험'] }),
      f({ key: 'targetObject', label: '대상(자)/물건', type: '텍스트', required: true, width: 'half', placeholder: '예: 홍길동 / 제1공장 건물' }),
      f({ key: 'vehicleNumber', label: '차량 번호', type: '텍스트', required: false, width: 'full', placeholder: '자동차보험인 경우 필수 입력', visibleIf: 'insuranceType:자동차보험' }),
      f({ key: 'body', label: '세부 변동 및 신청 내용', type: '장문', required: true }),
    ],
  },
  {
    id: '운반비', code: '운반비', name: '운반비 청구서', icon: '📦', docTitle: '운 반 비 청 구 서',
    closing: '위와 같이 운반비를 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 13, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'deliveryType', label: '배송 방식', type: '선택', required: true, width: 'half', options: ['우편 / 택배', '퀵서비스'] }),
      f({ key: 'amount', label: '배송 비용', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'body', label: '발송 물품 목록 및 목적지', type: '장문', required: true }),
    ],
  },
  {
    id: '인장날인', code: '인장날인', name: '인장 날인 요청서', icon: '印', docTitle: '인 장 날 인 요 청 서',
    closing: '위와 같이 인장 날인을 요청하오니 재가하여 주시기 바랍니다.', active: true, order: 14, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'sealType', label: '인장 구분', type: '선택', required: true, width: 'half', options: ['법인인감', '법인인감증명서', '사용인감 및 직인'] }),
      f({ key: 'docCount', label: '날인 부수', type: '숫자', required: true, width: 'half', placeholder: '예: 1' }),
      f({ key: 'receiver', label: '제출처', type: '텍스트', required: true, width: 'full' }),
      f({ key: 'body', label: '날인 문서명 및 사유', type: '장문', required: true }),
    ],
  },
  {
    id: '공문발송', code: '공문발송', name: '공문 발송 신청서', icon: '✉️', docTitle: '공 문 발 송 신 청 서',
    closing: '위와 같이 공문 발송을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 15, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'docCategory', label: '공문 분류', type: '선택', required: true, width: 'half', options: ['일반공문', '법률문서'] }),
      f({ key: 'receiverName', label: '수신처', type: '텍스트', required: true, width: 'half' }),
      f({ key: 'body', label: '공문 주요 골자 및 발송 계획', type: '장문', required: true }),
    ],
  },
  {
    id: '접대비', code: '접대비', name: '접대비 품의서', icon: '🤝', docTitle: '접 대 비 품 의 서',
    closing: '위와 같이 접대비를 품의하오니 재가하여 주시기 바랍니다.', active: true, order: 16, system: false, folderId: 'fld-ga',
    fields: [
      f({ key: 'budgetStatus', label: '예산 구분', type: '선택', required: true, width: 'half', options: ['접대비 예산 한도 내', '접대비 예산 한도 초과시'] }),
      f({ key: 'amount', label: '접대 금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'targetPerson', label: '접대 대상자 정보', type: '텍스트', required: true, width: 'full', placeholder: '예: OO회사 김부장 외 2명' }),
      f({ key: 'body', label: '접대 목적 및 세부 일정', type: '장문', required: true }),
    ],
  },

  // ── [품의] 기본 및 커스텀 ──
  {
    id: '품의', code: '품의', name: '품의서', icon: '🧾', docTitle: '품 의 서',
    closing: '위와 같이 품의하오니 재가하여 주시기 바랍니다.', active: true, order: 13, system: false, folderId: 'fld-req',
    fields: [
      f({ key: 'amount', label: '예산규모', type: '금액', required: true, isAmountKey: true, width: 'full' }),
      f({ key: 'body', label: '집행계획', type: '장문', required: true }),
    ],
  },
  {
    id: '원자재품의', code: '원자재품의', name: '원자재 품의서', icon: '🏗️', docTitle: '원 자 재 품 의 서',
    closing: '위와 같이 원자재 구입을 품의하오니 재가하여 주시기 바랍니다.', active: true, order: 14, system: false, folderId: 'fld-req',
    fields: [
      f({ key: 'amount', label: '구입 총액(부가세 별도)', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'itemSpecs', label: '원자재 품목 및 규격', type: '텍스트', required: true, width: 'half' }),
      f({ key: 'body', label: '원자재 수급 필요성 및 납기 조건', type: '장문', required: true }),
    ],
  },
  {
    id: '외주개발용역', code: '외주개발용역', name: '외주개발/용역비 품의서', icon: '💻', docTitle: '외 주 개 발 용 역 품 의 서',
    closing: '위와 같이 외주용역 계약 체결을 품의하오니 재가하여 주시기 바랍니다.', active: true, order: 15, system: false, folderId: 'fld-req',
    fields: [
      f({ key: 'amount', label: '계약 금액(부가세 별도)', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'vendorName', label: '용역 수행업체', type: '텍스트', required: true, width: 'half' }),
      f({ key: 'body', label: '용역 목적 및 검수 기준', type: '장문', required: true }),
    ],
  },
  {
    id: '소모품신청', code: '소모품신청', name: '소모품 신청서', icon: '✏️', docTitle: '소 모 품 신 청 서',
    closing: '위와 같이 소모품을 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 16, system: false, folderId: 'fld-req',
    fields: [
      f({ key: 'costType', label: '예산 규모 구분', type: '선택', required: true, width: 'half', options: ['10만원 미만', '10만원 이상'] }),
      f({ key: 'itemDetails', label: '소모품 목록 및 수량', type: '텍스트', required: true, width: 'half', placeholder: '예: 복사용지 5BOX' }),
      f({ key: 'body', label: '신청 사유 및 비고', type: '장문', required: true }),
    ],
  },

  // ── [경조사] 커스텀 ──
  {
    id: '경조지원', code: '경조지원', name: '경조 지원 신청서', icon: '🎉', docTitle: '경 조 지 원 신 청 서',
    closing: '위와 같이 경조 지원을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 17, system: false, folderId: 'fld-cond',
    fields: [
      f({ key: 'supportType', label: '지원 항목', type: '선택', required: true, width: 'half', options: ['화환 및 조화 발송', '경조금(축의/부의)'] }),
      f({ key: 'amount', label: '신청 경조 금액', type: '금액', required: false, isAmountKey: true, width: 'half', placeholder: '화환 발송 시 비움' }),
      f({ key: 'targetPerson', label: '대상자(경조 대상)', type: '텍스트', required: true, width: 'full', placeholder: '예: 거래처 OO산업 대표 / 본인 부친상' }),
      f({ key: 'body', label: '경조 사유 및 전달 일시/장소', type: '장문', required: true }),
    ],
  },
];
