import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth/AuthProvider';
import {
  fileStore,
  getDriver,
  getApiBase,
  setStoreConfig,
  type StoredFile,
  type DriverName,
} from '@/data/fileStore/fileStore.repo';

/**
 * 파일 저장소 테스트 페이지 — /dev/file-lab (개발용, 메뉴 트리 밖).
 * 앱 → WebDAV 게이트웨이 → Synology WebDAV 업로드/다운로드를 격리 검증한다.
 * 드라이버·게이트웨이 URL 을 화면에서 지정(배포 환경에서 Vercel env 없이 테스트).
 * (계획서: 파일서버_테스트페이지_개발_계획서.md §4)
 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileLabScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // 런타임 설정(드라이버 + 게이트웨이 URL)
  const [driver, setDriver] = useState<DriverName>(getDriver());
  const [apiUrl, setApiUrl] = useState(getApiBase());
  const [savedTick, setSavedTick] = useState(0); // 설정 저장 시 목록 재로드 트리거

  const auth = user ? { userId: user.id, name: user.name } : undefined;

  // 기존 업로드 목록 로드(nas 드라이버). firebase 는 목록 API 없어 빈 배열.
  useEffect(() => {
    let alive = true;
    fileStore()
      .list({ auth })
      .then((rows) => alive && setItems(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, savedTick]);

  const saveConfig = () => {
    setStoreConfig(driver, apiUrl);
    setErr('');
    setMsg('설정을 저장했습니다.');
    setSavedTick((t) => t + 1);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    setMsg('');
    for (const file of Array.from(files)) {
      setUploading(true);
      setProgress(0);
      try {
        const stored = await fileStore().upload(file, { auth, onProgress: setProgress });
        setItems((prev) => [stored, ...prev]);
        setMsg(`업로드 완료: ${stored.name}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* 헤더 */}
      <div className="flex items-center gap-3 pb-1">
        <button
          onClick={() => navigate(-1)}
          className="grid h-7 w-7 place-items-center rounded-lg text-[16px] text-ink2 hover:bg-panel-alt"
        >
          ←
        </button>
        <h1 className="text-[17px] font-extrabold text-ink">파일 저장소 테스트</h1>
        <span
          className={`ml-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
            driver === 'nas' ? 'bg-teal/15 text-teal' : 'bg-panel-alt text-ink3'
          }`}
        >
          driver: {driver}
        </span>
      </div>

      {/* 설정 */}
      <section className="rounded-2xl border border-border bg-panel p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-teal" />
          <h2 className="text-[13px] font-extrabold text-ink">설정</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-0.5 block text-[10.5px] font-bold text-ink3">드라이버</label>
            <select
              value={driver}
              onChange={(e) => setDriver(e.target.value as DriverName)}
              className="rounded-lg border border-border-hi bg-transparent px-3 py-2 text-[12.5px] text-ink outline-none focus:border-teal"
            >
              <option value="firebase">firebase</option>
              <option value="nas">nas (게이트웨이)</option>
            </select>
          </div>
          <div className="min-w-[280px] flex-1">
            <label className="mb-0.5 block text-[10.5px] font-bold text-ink3">
              게이트웨이 API URL (nas)
            </label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://<gateway-host>/api"
              disabled={driver !== 'nas'}
              className="w-full rounded-lg border border-border-hi bg-transparent px-3 py-2 text-[12.5px] text-ink outline-none focus:border-teal disabled:opacity-40"
            />
          </div>
          <button
            onClick={saveConfig}
            className="rounded-lg border border-border-hi px-4 py-2 text-[12.5px] font-bold text-ink2 hover:bg-panel-alt"
          >
            저장
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink3">
          설정은 이 브라우저(localStorage)에 저장됩니다. nas 는 게이트웨이(fileserver)가 이 URL 에서
          실행 중이어야 합니다.
        </p>
      </section>

      {/* 업로드 */}
      <section className="rounded-2xl border border-border bg-panel p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-teal" />
          <h2 className="text-[13px] font-extrabold text-ink">업로드</h2>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-teal px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {uploading ? '업로드 중…' : '파일 선택'}
        </button>

        {uploading && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-panel-alt">
              <div
                className="h-full rounded-full bg-teal transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-ink3">{progress}%</div>
          </div>
        )}

        {err && <div className="mt-3 text-[12px] font-semibold text-rose-500">{err}</div>}
        {msg && !err && <div className="mt-3 text-[12px] font-semibold text-teal">{msg}</div>}
      </section>

      {/* 목록 */}
      <section className="rounded-2xl border border-border bg-panel p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-teal" />
          <h2 className="text-[13px] font-extrabold text-ink">업로드된 파일 ({items.length})</h2>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-ink3">아직 업로드된 파일이 없습니다.</div>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li
                key={it.id ?? `${it.name}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-panel-alt p-3"
              >
                {it.mime.startsWith('image/') ? (
                  <img src={it.url} alt={it.name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-panel text-[20px]">
                    📎
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{it.name}</div>
                  <div className="text-[11px] text-ink3">
                    {formatBytes(it.size)} · {it.mime}
                  </div>
                </div>
                <a
                  href={it.url}
                  download={it.name}
                  rel="noopener"
                  className="rounded-lg border border-border-hi px-3 py-1.5 text-[11.5px] font-bold text-ink2 hover:bg-panel"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
