/**
 * 워드 모듈 계산 공개 API(화면 부품 없음) — 문서 데이터·.docx 저장·불러오기·그림.
 * 도메인·데이터 코드는 이것만 불러온다(React·Tiptap 화면 부품 WordEditor 를 끌어오지 않게). 화면 코드는 `@/lib/word`
 */
export { emptyWordDoc, parseWordDoc, wordDocText, A4, A4_CONTENT_WIDTH, type WordNode, type WordMark } from './model';
export { exportDocx, downloadDocx, hexColor, halfPoints, type DocxExportOptions } from './docxWrite';
export { importDocx, DocxError, type DocxImport } from './docxRead';
export { fromDataUrl, toDataUrl, imageSize, sniffImage, loadImage, type ImageType, type ImageBytes } from './image';
