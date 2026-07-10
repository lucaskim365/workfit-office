import type { ApprovalForm, FormField } from '@/domain/approvalForm/schema';

/**
 * 결재서식 시드 — Firebase 미설정 시 폴백 + 초기 seed.
 * 기본 4종(기안·품의·지출결의·휴가)은 system=true(삭제 보호). code 는 기존 docType 값과 동일해
 * 기존 문서·결재선 규칙과 호환. 휴가는 잔여일수 로직 때문에 전용 leave 위젯을 코드에서 렌더한다.
 * 커스텀 예제로 출장신청서(section·2열·기간·선택·금액 필드)를 함께 제공.
 */

const f = (field: Partial<FormField> & Pick<FormField, 'key' | 'label' | 'type'>): FormField => ({
  required: false, options: [], placeholder: '', width: 'full', section: '', isAmountKey: false, ...field,
});

export const APPROVAL_FORM_SEED: ApprovalForm[] = [
  {
    id: '기안', code: '기안', name: '기안서', icon: '📝', docTitle: '기 안 서',
    closing: '위와 같이 기안하오니 재가하여 주시기 바랍니다.', active: true, order: 1, system: true, folderId: null,
    fields: [
      f({ key: 'body', label: '기안내용', type: '장문', required: true, section: '내용' }),
      f({ key: 'note', label: '비고', type: '텍스트', section: '내용' }),
    ],
  },
  {
    id: '품의', code: '품의', name: '품의서', icon: '🧾', docTitle: '품 의 서',
    closing: '위와 같이 품의하오니 재가하여 주시기 바랍니다.', active: true, order: 2, system: true, folderId: null,
    fields: [
      f({ key: 'amount', label: '예산규모', type: '금액', required: true, isAmountKey: true, width: 'full' }),
      f({ key: 'body', label: '집행계획', type: '장문', required: true }),
    ],
  },
  {
    id: '지출결의', code: '지출결의', name: '지출결의서', icon: '💳', docTitle: '지 출 결 의 서',
    closing: '위와 같이 지출을 청구하오니 재가하여 주시기 바랍니다.', active: true, order: 3, system: true, folderId: null,
    fields: [
      f({ key: 'amount', label: '지출금액', type: '금액', required: true, isAmountKey: true, width: 'half' }),
      f({ key: 'accountSubject', label: '지출계정과목', type: '선택', required: true, width: 'half', options: ['복리후생비', '소모품비', '여비교통비', '접대비', '비품', '임차료', '보험료', '기타'] }),
      f({ key: 'bank', label: '은행', type: '텍스트', required: true, width: 'half', section: '입금정보' }),
      f({ key: 'accountHolder', label: '예금주', type: '텍스트', required: true, width: 'half', section: '입금정보' }),
      f({ key: 'accountNumber', label: '계좌번호', type: '텍스트', required: true, width: 'full', section: '입금정보' }),
    ],
  },
  {
    id: '휴가', code: '휴가', name: '휴가원', icon: '🌴', docTitle: '휴 가 원',
    closing: '위와 같이 휴가를 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 4, system: true, folderId: null,
    fields: [
      f({ key: 'period', label: '사용기간', type: '기간', required: true, width: 'half' }),
      f({ key: 'leaveType', label: '휴가종류', type: '선택', required: true, width: 'half', options: ['연차', '반차', '병가', '경조사', '기타'] }),
      f({ key: 'contactNumber', label: '긴급 연락처', type: '숫자', required: true, width: 'full' }),
      f({ key: 'body', label: '사유', type: '장문', required: true }),
    ],
  },
  // ── 커스텀 예제: 출장신청서 ──
  {
    id: '출장', code: '출장', name: '출장신청서', icon: '✈️', docTitle: '출 장 신 청 서',
    closing: '위와 같이 출장을 신청하오니 재가하여 주시기 바랍니다.', active: true, order: 5, system: false, folderId: null,
    fields: [
      f({ key: 'destination', label: '출장지', type: '텍스트', required: true, width: 'half', section: '출장 정보', placeholder: '예: 부산 고객사' }),
      f({ key: 'purpose', label: '목적', type: '선택', required: true, width: 'half', section: '출장 정보', options: ['영업', '기술지원', '교육', '회의', '기타'] }),
      f({ key: 'period', label: '출장 기간', type: '기간', required: true, width: 'full', section: '출장 정보' }),
      f({ key: 'companions', label: '동행자', type: '텍스트', width: 'half', section: '출장 정보', placeholder: '없으면 비움' }),
      f({ key: 'amount', label: '예상 경비', type: '금액', required: true, isAmountKey: true, width: 'full', section: '비용 정보' }),
      f({ key: 'body', label: '상세 일정 및 계획', type: '장문', required: true }),
    ],
  },
];
