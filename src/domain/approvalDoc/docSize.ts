/*
  결재 문서 크기 한도 — 문서 한 건은 저장소의 칸 하나(payload)에 JSON 글자로 들어간다.
  한도를 넘는 문서를 그대로 보내면 저장소가 영어 오류로 거절하므로, 보내기 전에 알아볼 수 있는 말로 막는다.
  시트 서식 문서는 칸 값·이름 값·기안자가 고친 틀 사본까지 담아 커질 수 있다.
*/

/** 문서 한 건을 담는 칸의 한도(글자 수) — scripts/appwrite-schema.ts 의 approvalDocs.payload 크기와 같아야 한다 */
export const DOC_PAYLOAD_LIMIT = 1_000_000;
/** 작성 중 저장의 한도 — 결재가 진행되며 결재 기록·서명 정보가 붙어 문서가 커지므로 여유를 둔다 */
export const DOC_DRAFT_LIMIT = 950_000;

export const DOC_TOO_LARGE_MESSAGE = '문서가 너무 커서 저장할 수 없습니다. 표의 줄 수나 붙여 넣은 내용을 줄이거나, 긴 내용은 첨부파일로 올려 주세요.';

/** 결재·회수 등 작성이 아닌 처리 중에 한도를 넘었을 때 — 처리하는 사람은 내용을 줄일 수 없다 */
export const DOC_TOO_LARGE_TO_PROCESS_MESSAGE = '문서가 너무 커서 처리할 수 없습니다. 기안자에게 문서 내용을 줄여 다시 올려 달라고 알려 주세요.';

/** 문서가 저장 한도를 넘으면 던진다 — 작성 중 저장(DOC_DRAFT_LIMIT)이면 줄이라는 안내, 그 밖의 처리면 기안자에게 알리라는 안내 */
export function assertDocSize(doc: unknown, limit: number = DOC_PAYLOAD_LIMIT): void {
  if (JSON.stringify(doc).length <= limit) return;
  throw new Error(limit === DOC_DRAFT_LIMIT ? DOC_TOO_LARGE_MESSAGE : DOC_TOO_LARGE_TO_PROCESS_MESSAGE);
}
