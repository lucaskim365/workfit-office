import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalDocSchema, type ApprovalDoc } from '@/domain/approvalDoc/schema';
import {
  canUploadPoReply,
  canViewPurchaseOrder,
  filterPurchaseOrders,
  groupPoFilesByDoc,
  isArchivedPurchaseOrder,
  isPurchaseOrderForm,
  poFileIdOf,
  poPdfFileName,
  poReplySchema,
  type PoArchiveQuery,
  type PoViewer,
} from './schema';

const poFile = (docId: string, uploadedAt: string, id?: string) =>
  poReplySchema.parse({
    ...(id ? { id } : {}), docId, docNo: docId, name: `${docId}.pdf`, url: 'https://files/x', storagePath: 'chat/poArchive/x',
    size: 1, contentType: 'application/pdf', uploadedBy: 'U011', uploadedAt,
  });

test('첨부 문서 ID — 따로 받은 ID가 없으면(예전 1건 방식) 결재 문서 ID', () => {
  assert.equal(poFileIdOf(poFile('DOC1', '2026-10-01T00:00:00.000Z')), 'DOC1');
  assert.equal(poFileIdOf(poFile('DOC1', '2026-10-01T00:00:00.000Z', 'tax1abc')), 'tax1abc');
});

test('세금계산서 여러 건 — 결재 문서별로 묶고 올린 순서대로 늘어놓는다(예전 1건과 새 건이 섞여도)', () => {
  const byDoc = groupPoFilesByDoc([
    poFile('A', '2026-10-03T00:00:00.000Z', 'tax3'),
    poFile('B', '2026-10-02T00:00:00.000Z'),
    poFile('A', '2026-10-01T00:00:00.000Z'),
  ]);
  assert.deepEqual(byDoc.get('A')?.map(poFileIdOf), ['A', 'tax3']);
  assert.deepEqual(byDoc.get('B')?.map(poFileIdOf), ['B']);
  assert.equal(byDoc.has('C'), false);
});

const doc = (id: string, over: Partial<ApprovalDoc> = {}): ApprovalDoc =>
  approvalDocSchema.parse({
    id, docNo: id, docType: 'PO', title: id, drafterId: 'U011', drafterDept: '구매팀', drafterDeptId: 'D1',
    status: '완료', completedAt: '2026-10-10T03:00:00.000Z', ...over,
  });
const viewer = (over: Partial<PoViewer> = {}): PoViewer => ({ userId: 'U099', deptId: 'D9', deptName: '개발팀', isManager: false, ...over });
const noDept = () => '';
const all: PoArchiveQuery = { keyword: '', from: '', to: '', reply: 'all', tax: 'all' };

test('서식 code 나 이름에 "발주"가 들어 있으면 발주서 서식이다', () => {
  assert.equal(isPurchaseOrderForm({ code: 'PO', name: '발주서' }), true);
  assert.equal(isPurchaseOrderForm({ code: '발주', name: 'Purchase' }), true);
  assert.equal(isPurchaseOrderForm({ code: '기안', name: '기안서' }), false);
});

test('결재 완료된 발주서만 보관함에 들어간다', () => {
  const codes = new Set(['PO']);
  assert.equal(isArchivedPurchaseOrder(doc('A'), codes), true);
  assert.equal(isArchivedPurchaseOrder(doc('B', { status: '진행중' }), codes), false);
  assert.equal(isArchivedPurchaseOrder(doc('C', { status: '취소완료' }), codes), false);
  assert.equal(isArchivedPurchaseOrder(doc('D', { docType: '기안' }), codes), false);
  // 서식 목록을 못 읽어도 docType 자체에 '발주'가 있으면 들어간다
  assert.equal(isArchivedPurchaseOrder(doc('E', { docType: '발주서' }), new Set()), true);
});

test('관여자는 비공개 문서도 보고, 그 밖의 사람은 비공개를 못 본다', () => {
  const secret = doc('A', { visibility: '비공개' });
  assert.equal(canViewPurchaseOrder(secret, viewer({ userId: 'U011' }), noDept), true);
  assert.equal(canViewPurchaseOrder(secret, viewer({ isManager: true }), noDept), false);
  const withStep = doc('B', { visibility: '비공개', steps: [{ seq: 1, kind: '결재', approverId: 'U099', decision: '승인' } as never] });
  assert.equal(canViewPurchaseOrder(withStep, viewer(), noDept), true);
});

test('공개 문서는 같은 부서와 문서 관리자가 본다', () => {
  const d = doc('A');
  assert.equal(canViewPurchaseOrder(d, viewer(), noDept), false);
  assert.equal(canViewPurchaseOrder(d, viewer({ deptId: 'D1', deptName: '구매팀' }), noDept), true);
  assert.equal(canViewPurchaseOrder(d, viewer({ isManager: true }), noDept), true);
  // 대외비는 관여자만
  assert.equal(canViewPurchaseOrder(doc('B', { securityLevel: '대외비' }), viewer({ isManager: true }), noDept), false);
});

test('회신 문서는 기안자와 문서 관리자만 올린다', () => {
  const d = doc('A');
  assert.equal(canUploadPoReply(d, viewer({ userId: 'U011' })), true);
  assert.equal(canUploadPoReply(d, viewer({ isManager: true })), true);
  assert.equal(canUploadPoReply(d, viewer()), false);
});

test('검색어·완료일·회신 여부로 거르고 완료일 최신순으로 늘어놓는다', () => {
  const rows = [
    doc('A', { title: '대성반도체 웨이퍼 발주', completedAt: '2026-10-01T03:00:00.000Z' }),
    doc('B', { title: '한울정밀 가공 발주', completedAt: '2026-10-15T03:00:00.000Z' }),
    doc('C', { title: '대성반도체 소모품 발주', completedAt: '2026-09-20T03:00:00.000Z' }),
  ];
  const replied = (id: string) => id === 'A';
  const noTax = () => false;
  assert.deepEqual(filterPurchaseOrders(rows, all, replied, noTax).map((d) => d.id), ['B', 'A', 'C']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, keyword: '대성 발주' }, replied, noTax).map((d) => d.id), ['A', 'C']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, from: '2026-10-01', to: '2026-10-10' }, replied, noTax).map((d) => d.id), ['A']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, reply: 'pending' }, replied, noTax).map((d) => d.id), ['B', 'C']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, reply: 'replied' }, replied, noTax).map((d) => d.id), ['A']);
});

test('매입 세금계산서 발행 여부로 거르고, 회신 여부와 함께 걸 수 있다', () => {
  const rows = [
    doc('A', { completedAt: '2026-10-03T03:00:00.000Z' }),
    doc('B', { completedAt: '2026-10-02T03:00:00.000Z' }),
    doc('C', { completedAt: '2026-10-01T03:00:00.000Z' }),
  ];
  const replied = (id: string) => id !== 'C';
  const issued = (id: string) => id === 'B';
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, tax: 'issued' }, replied, issued).map((d) => d.id), ['B']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, tax: 'unissued' }, replied, issued).map((d) => d.id), ['A', 'C']);
  assert.deepEqual(filterPurchaseOrders(rows, { ...all, reply: 'replied', tax: 'unissued' }, replied, issued).map((d) => d.id), ['A']);
});

test('PDF 파일명에서 파일명에 못 쓰는 글자를 뺀다', () => {
  assert.equal(poPdfFileName({ docNo: 'AP-261010-001', title: '웨이퍼/소모품 발주' }), '[AP-261010-001] 웨이퍼_소모품 발주.pdf');
});
