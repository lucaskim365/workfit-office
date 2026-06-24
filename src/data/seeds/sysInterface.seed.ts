import type { SysInterface } from '@/domain/sysInterface/schema';

/**
 * 외부 인터페이스 시드 — Firebase 미설정 시 폴백 + 초기 업로드(seed) 소스.
 * (와이어프레임 sys-screens-2.InterfaceMgmtContent 의 인라인 IFACES 이관)
 */
export const SYS_INTERFACE_SEED: SysInterface[] = [
  { id: 'IF-ERP-001', name: 'ERP 생산실적 송신', target: 'ERP', dir: '송신', cycle: '5분', last: '14:25:02', status: '정상', addr: 'https://erp.workfit.co.kr/api/prod', method: 'REST API', remark: '생산 실적 확정 시 ERP로 전송. 야간 배치(02:00) 정합성 재검증 수행.' },
  { id: 'IF-ERP-002', name: 'ERP 작업지시 수신', target: 'ERP', dir: '수신', cycle: '10분', last: '14:20:10', status: '정상', addr: 'https://erp.workfit.co.kr/api/wo', method: 'REST API', remark: 'ERP 작업지시 수신 후 Run Sheet 발행.' },
  { id: 'IF-PLC-014', name: 'CMP02 설비 데이터', target: 'PLC', dir: '수신', cycle: '실시간', last: '14:25:08', status: '정상', addr: 'opc.tcp://10.20.5.14:4840', method: 'OPC UA', remark: 'CMP02 설비 가동 데이터 실시간 수집.' },
  { id: 'IF-PLC-022', name: 'ETCH01 설비 데이터', target: 'PLC', dir: '수신', cycle: '실시간', last: '14:18:44', status: '지연', addr: 'opc.tcp://10.20.5.22:4840', method: 'OPC UA', remark: 'ETCH01 설비 데이터 수집 — 응답 지연 점검 필요.' },
  { id: 'IF-WMS-003', name: 'WMS 자재 입출고', target: 'WMS', dir: '양방향', cycle: '15분', last: '14:12:30', status: '정상', addr: 'https://wms.workfit.co.kr/api', method: 'REST API', remark: '자재 입출고 연동.' },
  { id: 'IF-MES-009', name: '검사장비 결과 수신', target: 'EQ', dir: '수신', cycle: '실시간', last: '13:50:21', status: '오류', addr: 'tcp://10.20.6.9:9100', method: 'Socket', remark: '검사장비 결과 수신 — 연결 오류.' },
];
