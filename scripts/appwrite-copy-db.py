#!/usr/bin/env python3
"""
Appwrite DB 복제 도구 — 스키마(컬렉션/속성/인덱스) + 문서를 복사한다.
같은 프로젝트의 다른 데이터베이스, 또는 다른 프로젝트로 복제할 수 있다.
(운영 → 개발 DB 구축 등. 표준 라이브러리만 사용, 의존성 없음.)

  사용:
    python scripts/appwrite-copy-db.py schema   # DB+컬렉션+속성+인덱스 생성(멱등)
    python scripts/appwrite-copy-db.py data     # 문서 복사(멱등: 있으면 update)
    python scripts/appwrite-copy-db.py verify   # 원본 vs 대상 문서 수 대조

  필요 env (셸/‌.env 로 주입 — ★비밀키를 코드에 넣지 말 것):
    APPWRITE_ENDPOINT     예: https://appwrite.widdyax.com/v1
    SRC_PROJECT_ID, SRC_API_KEY, SRC_DB(기본 workfit)     # 원본
    DST_PROJECT_ID(기본=SRC), DST_API_KEY(기본=SRC), DST_DB, DST_NAME
      · 같은 프로젝트의 새 DB로 복제: DST_PROJECT_ID 생략, DST_DB 만 지정
      · 다른 프로젝트로 복제: DST_PROJECT_ID + 그 프로젝트의 DST_API_KEY 지정
    API 키 스코프: databases/collections/attributes/indexes/documents read+write

  주의:
    · 속성 생성은 비동기 → 각 컬렉션 후 available 대기 후 인덱스/문서 진행.
    · 드물게 속성이 'processing' 에 stuck 되면(서버 과부하 등) 해당 컬렉션을
      콘솔/삭제 후 재생성하면 해소됨.
    · 지원 속성: string / string[] / integer / boolean / enum / float
      (관계·datetime 등은 필요 시 create_attr 에 추가).
"""
import os, sys, json, time, urllib.request, urllib.parse

MODE = sys.argv[1] if len(sys.argv) > 1 else "verify"
EP = os.environ.get("APPWRITE_ENDPOINT") or os.environ.get("VITE_APPWRITE_ENDPOINT")
SRC_PJ = os.environ["SRC_PROJECT_ID"]; SRC_KEY = os.environ["SRC_API_KEY"]
SRC_DB = os.environ.get("SRC_DB", "workfit")
DST_PJ = os.environ.get("DST_PROJECT_ID", SRC_PJ)
DST_KEY = os.environ.get("DST_API_KEY", SRC_KEY)
DST_DB = os.environ["DST_DB"]; DST_NAME = os.environ.get("DST_NAME", DST_DB)
assert EP, "APPWRITE_ENDPOINT 필요"
H_SRC = {"X-Appwrite-Project": SRC_PJ, "X-Appwrite-Key": SRC_KEY, "Content-Type": "application/json"}
H_DST = {"X-Appwrite-Project": DST_PJ, "X-Appwrite-Key": DST_KEY, "Content-Type": "application/json"}


def req(method, path, body=None, side="dst"):
    H = H_SRC if side == "src" else H_DST
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(4):
        r = urllib.request.Request(EP + path, data=data, headers=H, method=method)
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception as e:
            last = e; time.sleep(2 * (attempt + 1))
    raise last


def q(m, v): return urllib.parse.quote(json.dumps({"method": m, "values": v}))


def src_collections():
    _, d = req("GET", f"/databases/{SRC_DB}/collections?queries[]={q('limit',[100])}", side="src")
    return d.get("collections", [])


def list_docs(db, cid, side):
    out, off = [], 0
    while True:
        _, d = req("GET", f"/databases/{db}/collections/{cid}/documents"
                   f"?queries[]={q('limit',[100])}&queries[]={q('offset',[off])}", side=side)
        docs = d.get("documents", []); out += docs
        if len(docs) < 100: break
        off += 100
    return out


def create_attr(cid, a):
    key, req_, arr = a["key"], a.get("required", False), a.get("array", False)
    t, fmt, dflt = a["type"], a.get("format"), a.get("default", None)
    base = {"key": key, "required": req_, "array": arr}
    def wd(b):
        if (not req_) and (not arr) and dflt is not None: b["default"] = dflt
        return b
    if fmt == "enum":
        return req("POST", f"/databases/{DST_DB}/collections/{cid}/attributes/enum", wd({**base, "elements": a.get("elements", [])}))
    if t == "string":
        return req("POST", f"/databases/{DST_DB}/collections/{cid}/attributes/string", wd({**base, "size": a.get("size", 255)}))
    if t == "integer":
        b = {**base}
        if a.get("min") is not None: b["min"] = a["min"]
        if a.get("max") is not None: b["max"] = a["max"]
        return req("POST", f"/databases/{DST_DB}/collections/{cid}/attributes/integer", wd(b))
    if t == "double":
        return req("POST", f"/databases/{DST_DB}/collections/{cid}/attributes/float", wd({**base}))
    if t == "boolean":
        return req("POST", f"/databases/{DST_DB}/collections/{cid}/attributes/boolean", wd({**base}))
    return 400, {"error": f"unsupported {t}/{fmt}"}


def wait_attrs(cid, timeout=120):
    for _ in range(timeout):
        _, coll = req("GET", f"/databases/{DST_DB}/collections/{cid}")
        st = [x.get("status") for x in coll.get("attributes", [])]
        if st and all(s == "available" for s in st): return True
        if any(s in ("stuck", "failed") for s in st): return False
        time.sleep(1)
    return False


def do_schema():
    s, d = req("POST", "/databases", {"databaseId": DST_DB, "name": DST_NAME})
    print("DB:", "OK" if s < 300 else ("이미존재" if s == 409 else d))
    cols = src_collections(); print(f"컬렉션 {len(cols)}개")
    for c in cols:
        cid = c["$id"]
        _, full = req("GET", f"/databases/{SRC_DB}/collections/{cid}", side="src")
        s, r = req("POST", f"/databases/{DST_DB}/collections",
                   {"collectionId": cid, "name": c.get("name", cid), "permissions": c.get("$permissions", []),
                    "documentSecurity": c.get("documentSecurity", False), "enabled": c.get("enabled", True)})
        tag = "OK" if s < 300 else ("존재" if s == 409 else f"ERR{s}")
        made = 0
        for a in full.get("attributes", []):
            sa, ra = create_attr(cid, a)
            if sa < 300: made += 1
            elif sa != 409: print(f"   attr ERR {cid}.{a['key']}: {sa} {ra.get('message','')[:60]}")
        wait_attrs(cid)
        idx = 0
        for i in full.get("indexes", []):
            si, _ = req("POST", f"/databases/{DST_DB}/collections/{cid}/indexes",
                        {"key": i["key"], "type": i["type"], "attributes": i["attributes"], "orders": i.get("orders", [])})
            if si < 300: idx += 1
        print(f"  {cid}: coll={tag} attrs={made}/{len(full.get('attributes',[]))} idx={idx}/{len(full.get('indexes',[]))}")


def do_data():
    total = 0
    for c in src_collections():
        cid = c["$id"]; docs = list_docs(SRC_DB, cid, "src"); n = 0
        for doc in docs:
            body = {k: v for k, v in doc.items() if not k.startswith("$")}
            s, r = req("POST", f"/databases/{DST_DB}/collections/{cid}/documents", {"documentId": doc["$id"], "data": body})
            if s < 300: n += 1
            elif s == 409:
                req("PATCH", f"/databases/{DST_DB}/collections/{cid}/documents/{doc['$id']}", {"data": body}); n += 1
            else: print(f"   doc ERR {cid}/{doc['$id']}: {s} {r.get('message','')[:70]}")
        total += n; print(f"  {cid}: {n}/{len(docs)}")
    print("총 복사 문서:", total)


def do_verify():
    bad = ts = td = 0
    for c in src_collections():
        cid = c["$id"]
        _, sd = req("GET", f"/databases/{SRC_DB}/collections/{cid}/documents?queries[]={q('limit',[1])}", side="src")
        _, dd = req("GET", f"/databases/{DST_DB}/collections/{cid}/documents?queries[]={q('limit',[1])}")
        s = sd.get("total", 0); d = dd.get("total", -1); ts += s; td += max(d, 0)
        if s != d: bad += 1; print(f"  ❌ {cid}: src={s} dst={d}")
    print(f"불일치 {bad} · 총 문서 src={ts} dst={td} → {'✅ 일치' if bad == 0 and ts == td else '⚠️'}")


print(f"MODE={MODE}  {SRC_PJ}/{SRC_DB} → {DST_PJ}/{DST_DB}")
{"schema": do_schema, "data": do_data, "verify": do_verify}.get(MODE, do_verify)()
