# S3 첨부파일 미리보기(Inline) 및 다운로드(Attachment) 분리 설계서

본 문서는 결재문서 첨부파일 클릭 시 브라우저 내에서 즉시 열기(Inline)와 파일 다운로드(Attachment)를 분리하여 처리하기 위한 설계 계획서입니다. 

---

## 1. 개요 및 배경
* **현상**: 현재 첨부파일을 다운로드하거나 클릭하면 브라우저 새 창에서 열리지 않고 바로 로컬 파일로 저장(강제 다운로드)됩니다.
* **원인**: 파일 서버(S3/Garage)가 파일을 응답할 때 헤더에 `Content-Disposition: attachment;`를 고정하여 전달하기 때문입니다.
* **목표**: 
  * **파일명 클릭 시**: PDF나 이미지 등 브라우저가 지원하는 포맷은 새 탭에서 즉시 열어 보여줍니다. (`inline` 헤더 지침)
  * **다운로드 클릭 시**: 포맷과 무관하게 로컬 디스크에 파일로 즉시 저장합니다. (`attachment` 헤더 지침)

---

## 2. 해결 방안 (S3 Response Header Overriding)
S3 호환 오브젝트 스토리지(Garage 등)는 GET용 presigned URL을 생성할 때, **해당 URL에 바인딩할 응답 헤더를 동적으로 재정의(Response Header Overriding)**할 수 있는 기능을 제공합니다.

기안자/결재자의 요청 동작에 맞춰 서로 다른 임시 서명 URL을 발급받아 대응하도록 설계합니다.

### A. 미리보기용 URL (파일명 클릭 시)
* **헤더 설정**: `ResponseContentDisposition = inline`
* **동작**: 브라우저가 새 탭에서 해당 URL을 요청할 때 응답 헤더가 `inline`으로 전송되어, 화면에 바로 리소스를 표시합니다.

### B. 강제 다운로드용 URL (다운로드 클릭 시)
* **헤더 설정**: `ResponseContentDisposition = attachment; filename="원파일명.ext"`
* **동작**: 브라우저가 해당 URL을 요청할 때 응답 헤더가 `attachment`로 전송되어, 화면에 표시하지 않고 다운로드 창을 실행합니다.

---

## 3. 상세 설계 및 구현 방안

### A. 서명 API (백엔드) 규격 확장
서명 발급용 백엔드 API (`https://file.widdyax.com/api/sign`)에 다운로드용 서명 `op: 'get'` 처리와 `disposition` 파라미터를 추가합니다.

#### API 요청 페이로드 예시
```json
// 1. 미리보기(Inline)용 요청
{
  "op": "get",
  "path": "approvals/1786496711049_워크핏 개발 일정 계획서.pdf",
  "disposition": "inline"
}

// 2. 다운로드(Attachment)용 요청
{
  "op": "get",
  "path": "approvals/1786496711049_워크핏 개발 일정 계획서.pdf",
  "disposition": "attachment"
}
```

#### API 내부 로직 (AWS SDK Node.js 기준 예시)
```javascript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const command = new GetObjectCommand({
  Bucket: BUCKET_NAME,
  Key: path,
  // disposition 파라미터에 따라 헤더 오버라이딩 적용
  ResponseContentDisposition: disposition === "inline" 
    ? "inline" 
    : `attachment; filename="${encodeURIComponent(filename)}"`
});

const getUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1시간 유효
```

### B. 프론트엔드 연동 (`storage.ts` 및 `ApprovalDocumentView.tsx`)
1. **[storage.ts](file:///c:/WorkFit/전자결재시스템/workfit-office/src/shared/lib/storage.ts) 확장**:
   * `StorageAdapter` 인터페이스에 실시간 다운로드 서명을 생성해 주는 `getSignUrl(path, disposition)` 메서드를 정의하고 구현합니다.
2. **[ApprovalDocumentView.tsx](file:///c:/WorkFit/전자결재시스템/workfit-office/src/modules/gw/approval/ApprovalDocumentView.tsx) 수정**:
   * 첨부파일의 `<a>` 태그 클릭과 `(다운로드)` 버튼 클릭 시점에 각각 백엔드로부터 실시간 발급받은 URL로 라우팅을 리다이렉트합니다.
   * 실시간 서명 발급을 통해 링크 보안 만료 문제를 방지하고, CORS 제한 없이 안전하게 다운로드가 동작합니다.

---

## 4. 이점
* S3 버킷을 Public으로 개방하지 않고 **비공개(Private) 상태로 완벽히 차단**해 두면서도, 결재 권한이 있는 사용자에게만 다운로드 목적(열람용 `inline` / 소장용 `attachment`)에 맞춘 안전한 단기 임시 링크를 제공할 수 있어 보안 규정이 엄격한 사내 그룹웨어 시스템에 최적화됩니다.
