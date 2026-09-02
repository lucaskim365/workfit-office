using System;
using System.Collections.Generic;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("CapsSync.Tests")]

namespace CapsSync
{
    // CAPS(Access .mdb) 근태를 **실시간으로** 그룹웨어 인제스트 엔드포인트에 push 하는 상주 에이전트.
    // DB는 그 자리에 그대로 두고(복사·이동 없음) 읽기 전용으로만 직접 연다.
    //
    //   흐름: N초마다 살아있는 .mdb 를 SELECT → 바뀐 행만 추림 → HMAC 서명 POST
    //
    // 실행 모드 (config 의 "Mode", 명령행 인자로 덮어쓸 수 있음)
    //   watch : 상주하며 DB를 폴링. 출퇴근이 찍히면 폴링 주기 안에 전송된다. (기본)
    //   once  : 한 번 훑고 종료. 수동 점검·복구용.
    //   check : 아무것도 보내지 않고 설정과 DB 연결 상태만 출력. → CapsSync.exe --check
    //
    // nOutput 은 이벤트 로그가 아니라 사람×날짜 1행짜리 집계 테이블이다. 그래서 우리는 이벤트가
    // 아니라 "행의 현재 상태"를 읽어 보낸다 — 폴링 사이에 몇 번을 찍든 다음 폴링이 정확한 최종
    // 상태를 읽으므로 놓칠 이벤트라는 게 없다.
    //
    // 유실 방지가 세 겹이다.
    //   1) 폴링이 한 번 실패해도 다음 회차가 같은 상태를 다시 읽는다(+ FullSyncMinutes 전수 훑기).
    //   2) 전송이 실패하면 상태(지문)를 커밋하지 않아 다음 회차가 같은 행을 다시 보낸다.
    //   3) 서버가 결정적 ID 로 멱등 upsert 하므로 몇 번을 더 보내도 결과가 같다.
    //
    // CAPS 와의 경합: Access 는 다중 사용자 접속을 전제로 만들어졌고 우리는 읽기 전용 클라이언트
    // 하나로 붙는다(Mode=Read). 다만 엔진이 읽기로 열 때도 잠금 파일(.ldb)에 슬롯을 쓰므로
    // **DB 폴더에 쓰기 권한이 필요하다** — 읽기 전용 공유로는 열리지 않는다.
    internal static class Program
    {
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
        private static Config _cfg;
        private static SyncState _state;

        // 마지막 동기화 결과 — 요약 txt 와 진단에 쓴다.
        private static string _lastOutcome = "(아직 없음)";
        private static DateTime? _lastSentAt;
        private static int _consecutiveFailures;

        // 조용한 폴링은 로그를 남기지 않는 대신, 전수 동기화 때 이 숫자를 한 줄로 요약한다.
        private static int _pollsSinceReport;
        private static int _changesSinceReport;

        private static int Main(string[] args)
        {
            var cli = CommandLine.Parse(args);
            if (cli.ShowHelp)
            {
                Console.WriteLine(CommandLine.HelpText);
                return 0;
            }

            try
            {
                _cfg = Config.Load(FindConfigPath());
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("설정을 읽지 못했습니다: " + ex.Message);
                return 2;
            }

            string mode = cli.Mode ?? _cfg.Mode;

            try
            {
                if (string.Equals(mode, "check", StringComparison.OrdinalIgnoreCase)) return RunCheck();

                _state = cli.Resync ? new SyncState() : SyncState.Load(_cfg.StatePath);
                if (cli.Resync) Log("--resync: 상태 캐시를 비웠다 → 창 전체를 다시 보낸다");

                if (string.Equals(mode, "once", StringComparison.OrdinalIgnoreCase)) return RunOnce();
                if (string.Equals(mode, "watch", StringComparison.OrdinalIgnoreCase)) return RunWatch();

                Console.Error.WriteLine($"알 수 없는 Mode: '{mode}' (watch | once | check)");
                return 2;
            }
            catch (Exception ex)
            {
                Log("!!! 실패: " + ex);
                return 1;
            }
        }

        // ---------- 모드: once (한 번 훑고 종료) ----------

        private static int RunOnce()
        {
            Log("=== CapsSync 시작 (once) ===");
            Log("DB: " + _cfg.MdbPath);
            try
            {
                Sync(_cfg.WindowDays, isFullSweep: true, trigger: "수동 실행");
                Log("=== 성공 ===");
                return 0;
            }
            catch (Exception ex)
            {
                Log("!!! 실패: " + ex);
                return 1; // 작업 스케줄러가 실패를 감지할 수 있도록 0이 아닌 코드
            }
        }

        // ---------- 모드: watch (상주 실시간 폴링) ----------

        private static int RunWatch()
        {
            // 같은 DB를 두 프로세스가 동시에 폴링하면 같은 행을 두 번 보내고 상태 파일이 서로 덮어쓴다.
            // 이름에 경로를 섞어, 서로 다른 DB를 보는 인스턴스는 공존할 수 있게 한다.
            //
            // Global\ 커널 객체 생성에는 권한(SeCreateGlobalPrivilege)이 필요해 표준 사용자면 막힌다.
            // 그 경우 Local\ 로 물러선다 — 세션이 하나뿐인 배포 PC에선 중복 실행을 막기에 충분하다.
            string tag = SyncState.Fingerprint(_cfg.MdbPath.ToUpperInvariant());
            bool createdNew;
            Mutex single;
            try { single = new Mutex(true, "Global\\CapsSync_" + tag, out createdNew); }
            catch (UnauthorizedAccessException) { single = new Mutex(true, "Local\\CapsSync_" + tag, out createdNew); }

            using (single)
            {
                if (!createdNew)
                {
                    Log("이미 같은 DB를 폴링하는 CapsSync 가 실행 중이다 → 이 인스턴스는 종료");
                    return 0;
                }

                Log("=== CapsSync 시작 (watch — 실시간 폴링) ===");
                Log("DB          : " + _cfg.MdbPath + " (원본을 직접 읽기 전용으로 연다)");
                Log("전송         : " + (_cfg.SendEnabled ? _cfg.IngestUrl : "(드라이런 — SendEnabled=false)"));
                Log($"주기         : 폴링 {_cfg.PollSeconds}초 / 전수동기화 {_cfg.FullSyncMinutes}분");
                Log($"창           : 폴링 {_cfg.WatchWindowDays}일 / 전수 {_cfg.WindowDays}일");

                var stop = new ManualResetEventSlim(false);
                Console.CancelKeyPress += (s, e) => { e.Cancel = true; Log("중지 요청(Ctrl+C) — 정리 중"); stop.Set(); };

                // 시작 즉시 한 번 전수 동기화 — 에이전트가 꺼져 있던 동안의 변경을 여기서 따라잡는다.
                DateTime lastFullSweep = DateTime.UtcNow;
                DateTime lastPoll = DateTime.UtcNow;
                SafeSync(_cfg.WindowDays, true, "기동 직후 전수 동기화");

                var pollEvery = TimeSpan.FromSeconds(Math.Max(1, _cfg.PollSeconds));
                var fullEvery = TimeSpan.FromMinutes(Math.Max(1, _cfg.FullSyncMinutes));

                while (!stop.Wait(250)) // 250ms 단위로 깨어나며, 중지 요청이면 즉시 빠져나간다
                {
                    DateTime now = DateTime.UtcNow;

                    if (now - lastFullSweep >= fullEvery)
                    {
                        lastFullSweep = now;
                        lastPoll = now;
                        SafeSync(_cfg.WindowDays, true, "주기 전수 동기화");
                    }
                    else if (now - lastPoll >= pollEvery)
                    {
                        lastPoll = now;
                        // 폴링은 최근 며칠만 훑는다 — 출퇴근은 항상 오늘 날짜 행이라 이걸로 충분하고,
                        // 그보다 오래된 행이 수정돼도 전수 동기화가 늦어도 FullSyncMinutes 안에 잡는다.
                        SafeSync(_cfg.WatchWindowDays, false, "폴링");
                    }
                }

                Log("=== 종료 ===");
                return 0;
            }
        }

        // 상주 프로세스는 한 번의 실패로 죽으면 안 된다. 로그만 남기고 다음 회차를 계속 돈다.
        //
        // 몇 초마다 도는 루프라 실패도 초 단위로 반복된다. 그대로 찍으면 로그가 에러로만 가득 차
        // 정작 원인을 못 보므로, 처음 3회와 그 뒤 20회마다만 남긴다.
        private static void SafeSync(int windowDays, bool isFullSweep, string trigger)
        {
            try
            {
                Sync(windowDays, isFullSweep, trigger);
                if (_consecutiveFailures > 0) Log($"동기화 복구됨 ({_consecutiveFailures}회 실패 후)");
                _consecutiveFailures = 0;
            }
            catch (Exception ex)
            {
                _consecutiveFailures++;
                _lastOutcome = "실패: " + ex.Message;
                if (_consecutiveFailures <= 3 || _consecutiveFailures % 20 == 0)
                {
                    Log($"동기화 실패({_consecutiveFailures}회 연속): {ex.Message}");
                    if (_consecutiveFailures == 1) Log(ex.ToString()); // 스택은 첫 회만
                }
                try { WriteSummary(null, _lastOutcome, trigger); } catch { }
            }
        }

        // ---------- 동기화 본체 ----------

        // 읽기 → 직전에 보낸 값과 비교 → 바뀐 행만 전송.
        // isFullSweep 이면 바뀐 행이 없어도 빈 페이로드를 보낸다(하트비트) — 서버 `syncMeta.lastRunAt` 이
        // 계속 갱신돼야 웹에서 "에이전트가 살아있는지"를 구분할 수 있다.
        private static void Sync(int windowDays, bool isFullSweep, string trigger)
        {
            string cutoff = DateTime.Today.AddDays(-windowDays).ToString("yyyyMMdd");
            List<Attendance> attendance;
            List<Employee> employees;
            List<Holiday> holidays;

            // 살아있는 원본을 읽기 전용으로 직접 연다(사본을 뜨지 않는다).
            // 연결은 매 회차 열고 **확실히 닫는다**(풀링 꺼짐 — OpenReadOnly 주석 참고).
            // 폴링 사이에는 우리 잠금이 남지 않아, CAPS가 압축/복구 같은 배타 작업을 할 틈이 생긴다.
            using (var conn = OpenReadOnly(_cfg.MdbPath, _cfg.OleDbProvider, _cfg.MdbPassword))
            {
                attendance = ReadAttendance(conn, cutoff);
                employees = ReadEmployees(conn);
                holidays = ReadHolidays(conn);
            }

            SyncDelta delta = _state.Diff(attendance, employees, holidays);
            _pollsSinceReport++;

            // 조용한 폴링은 로그를 남기지 않는다. 몇 초마다 "변경 없음"을 찍으면 하루 수만 줄이 되어
            // 정작 봐야 할 줄이 묻힌다. 대신 전수 동기화 때 그동안의 횟수를 한 줄로 요약한다.
            if (delta.IsEmpty && !isFullSweep) return;
            if (!delta.IsEmpty) _changesSinceReport++;

            var payload = new Payload
            {
                source = "caps",
                generatedAt = DateTimeOffset.Now.ToString("yyyy-MM-ddTHH:mm:sszzz"),
                windowStart = FormatDate(cutoff),
                attendance = delta.AttendanceRows,
                employees = delta.EmployeeRows,
                holidays = delta.HolidayRows,
            };

            string what = delta.IsEmpty ? "하트비트(변경 없음)" : "변경분 " + delta;
            Log($"[{trigger}] 읽음 {attendance.Count}건 → {what}");
            if (isFullSweep && _pollsSinceReport > 1)
            {
                Log($"  (직전 구간: 폴링 {_pollsSinceReport}회 / 변경 감지 {_changesSinceReport}회)");
                _pollsSinceReport = 0;
                _changesSinceReport = 0;
            }

            if (_cfg.SendEnabled)
            {
                PostWithRetry(payload); // 실패하면 예외 → 아래 커밋에 도달하지 않는다
                _lastOutcome = "전송 성공 — " + what;
                _lastSentAt = DateTime.Now;
            }
            else
            {
                string body = Json.Serialize(payload);
                string outPath = _cfg.LastPayloadPath;
                EnsureParentDir(outPath);
                File.WriteAllText(outPath, body, new UTF8Encoding(false));
                _lastOutcome = "드라이런 (전송 안 함)";
                Log($"[드라이런] SendEnabled=false → 전송 생략. 페이로드 저장: {outPath} ({body.Length} bytes)");
            }

            // 여기까지 왔으면 이번 회차는 성공이다. 지문을 커밋해 다음 회차부터는 조용해진다.
            // 전송이 실패하면 위에서 예외로 빠져나가 커밋되지 않으므로, 다음 회차가 같은 행을 다시 보낸다.
            // (드라이런도 커밋한다 — 전용 상태 파일을 쓰므로 실제 전송 상태는 오염되지 않는다. Config.Load 참고)
            _state.Commit(delta, DateTime.Now);
            if (isFullSweep) _state.Prune(cutoff);
            _state.Save(_cfg.StatePath);

            WriteSummary(payload, _lastOutcome, trigger);
        }

        // ---------- 모드: check (설정·연결 점검) ----------

        // 아무것도 보내지 않고 "지금 설정이 어디를 보고 있는지"를 사람이 읽는 형태로 출력한다.
        // 배포 PC에서 경로·비번·엔드포인트가 맞는지 확인하는 용도.
        private static int RunCheck()
        {
            var sb = new StringBuilder();
            bool ok = true;
            sb.AppendLine("===== CapsSync 설정 점검 =====");
            sb.AppendLine("config.json  : " + FindConfigPath());
            sb.AppendLine();

            sb.AppendLine("[DB — 실제로 읽는 위치]");
            sb.AppendLine("  MdbPath    : " + _cfg.MdbPath);
            var fi = new FileInfo(_cfg.MdbPath);
            if (fi.Exists)
            {
                sb.AppendLine($"  파일        : 있음 ({fi.Length / 1024.0 / 1024.0:F1} MB)");
                sb.AppendLine($"  마지막 수정  : {fi.LastWriteTime:yyyy-MM-dd HH:mm:ss} ({Ago(fi.LastWriteTime)})");
            }
            else
            {
                ok = false;
                sb.AppendLine("  파일        : ★ 없음 — 경로를 확인할 것");
            }

            string lockFile = Path.Combine(Path.GetDirectoryName(_cfg.MdbPath) ?? ".",
                                           Path.GetFileNameWithoutExtension(_cfg.MdbPath) + ".ldb");
            sb.AppendLine("  잠금 파일    : " + (File.Exists(lockFile)
                ? lockFile + " 있음 → CAPS가 DB를 열어둔 상태(정상)"
                : "없음 → 지금 CAPS가 DB를 열고 있지 않음"));
            sb.AppendLine($"  Provider   : {_cfg.OleDbProvider} (이 프로세스는 {(Environment.Is64BitProcess ? "x64" : "x86")})");
            sb.AppendLine("  비밀번호     : " + (string.IsNullOrEmpty(_cfg.MdbPassword)
                ? "(비어 있음)" : $"설정됨({_cfg.MdbPassword.Length}자)"));

            if (fi.Exists)
            {
                try
                {
                    // 실제 운영과 똑같이 살아있는 원본을 직접 연다 — 여기서 성공해야 상주 모드도 된다.
                    using (var conn = OpenReadOnly(_cfg.MdbPath, _cfg.OleDbProvider, _cfg.MdbPassword))
                    {
                        var att = ReadAttendance(conn, DateTime.Today.AddDays(-_cfg.WindowDays).ToString("yyyyMMdd"));
                        var emp = ReadEmployees(conn);
                        var hol = ReadHolidays(conn);
                        sb.AppendLine($"  열기 시험    : 성공 — 최근 {_cfg.WindowDays}일 근태 {att.Count}건 / 직원 {emp.Count}명 / 공휴일 {hol.Count}건");
                        var newest = att.OrderByDescending(a => a.date).FirstOrDefault();
                        if (newest != null)
                            sb.AppendLine($"  최신 기록    : {newest.date} {newest.name} {Clock(newest.inAt)}~{Clock(newest.outAt)}");
                    }
                }
                catch (Exception ex)
                {
                    ok = false;
                    sb.AppendLine("  열기 시험    : ★ 실패 — " + ex.Message);
                    // 압도적으로 흔한 원인이 이것이라 먼저 짚어 준다.
                    sb.AppendLine("               흔한 원인: DB 폴더에 쓰기 권한이 없어 잠금 파일(.ldb)을 못 만듦.");
                    sb.AppendLine("               읽기 전용 공유로는 열리지 않는다 — 폴더에 쓰기 권한을 주거나 CAPS PC에서 직접 실행할 것.");
                }
            }

            sb.AppendLine();
            sb.AppendLine("[전송]");
            sb.AppendLine("  SendEnabled: " + (_cfg.SendEnabled ? "true (실제 전송)" : "false (드라이런 — 파일로만 저장)"));
            sb.AppendLine("  IngestUrl  : " + (string.IsNullOrWhiteSpace(_cfg.IngestUrl) ? "(비어 있음)" : _cfg.IngestUrl));
            if (File.Exists(_cfg.SecretFilePath))
            {
                int len = File.ReadAllText(_cfg.SecretFilePath).Trim().Length;
                sb.AppendLine($"  secret.txt : {_cfg.SecretFilePath} ({len}자)");
                if (len < 24) sb.AppendLine("               ★ 너무 짧다 — 32자 이상 무작위 값 권장");
            }
            else
            {
                if (_cfg.SendEnabled) ok = false;
                sb.AppendLine($"  secret.txt : {(_cfg.SendEnabled ? "★ " : "")}없음 ({_cfg.SecretFilePath})");
            }

            sb.AppendLine();
            sb.AppendLine("[실시간 폴링]");
            sb.AppendLine("  Mode       : " + _cfg.Mode);
            sb.AppendLine($"  폴링 주기    : {_cfg.PollSeconds}초  (= 펀치 후 최대 이만큼 뒤에 전송)");
            sb.AppendLine($"  전수동기화   : {_cfg.FullSyncMinutes}분");
            sb.AppendLine($"  창          : 폴링 {_cfg.WatchWindowDays}일 / 전수 {_cfg.WindowDays}일");
            var st = SyncState.Load(_cfg.StatePath);
            sb.AppendLine("  상태 캐시    : " + (File.Exists(_cfg.StatePath)
                ? $"{_cfg.StatePath} (근태 {st.AttendanceSeen.Count}건 기억 중, 마지막 전송 {st.LastSentAt ?? "-"})"
                : _cfg.StatePath + " (아직 없음 — 첫 실행이 창 전체를 보낸다)"));

            sb.AppendLine();
            sb.AppendLine("[로그·산출물]");
            sb.AppendLine("  LogPath    : " + _cfg.LogPath);
            sb.AppendLine("  요약 txt    : " + _cfg.SummaryPath);
            sb.AppendLine();
            sb.AppendLine(ok ? "판정: 이상 없음" : "판정: ★ 표시된 항목을 고칠 것");

            Console.WriteLine(sb.ToString());
            return ok ? 0 : 1;
        }

        private static string Ago(DateTime when)
        {
            TimeSpan d = DateTime.Now - when;
            if (d.TotalSeconds < 0) return "미래 시각";
            if (d.TotalMinutes < 1) return $"{(int)d.TotalSeconds}초 전";
            if (d.TotalHours < 1) return $"{(int)d.TotalMinutes}분 전";
            if (d.TotalDays < 1) return $"{(int)d.TotalHours}시간 전";
            return $"{(int)d.TotalDays}일 전";
        }

        // ---------- 읽기 ----------

        // 살아있는 CAPS DB를 **읽기 전용**으로 연다. `Mode=Read` 라 쓰기 자체가 불가능하고
        // (UPDATE를 시도해도 엔진이 거부한다), CAPS가 같은 파일을 열어둔 채로도 붙는다
        // — Access의 정상적인 다중 사용자 접속이다.
        //
        // `OLE DB Services=-4` 로 **세션 풀링을 끈다.** 기본값(풀링 켜짐)이면 Dispose 해도 물리적
        // 연결이 유휴 60초쯤 풀에 남는데, 우리는 그보다 자주 폴링하므로 결과적으로 잠금 파일
        // (`ACCESS.ldb`)의 슬롯을 24시간 붙들게 된다. 그러면 CAPS가 **배타 접근**을 필요로 할 때
        // (압축/복구, 백업, 단독 모드 열기) "데이터베이스가 사용 중입니다"로 실패할 수 있다.
        // 풀링을 끄면 폴링과 폴링 사이에는 우리 잠금이 완전히 사라져 그런 작업이 끼어들 수 있다.
        // 대신 매번 연결을 새로 여는 비용(로컬 기준 수십 ms)이 드는데, 폴링 주기에 비하면 무시할 수준.
        //
        // 주의: Access 엔진은 읽기로 열 때도 `ACCESS.ldb` 에 자기 슬롯을 쓴다.
        // 따라서 **DB 폴더에 쓰기 권한이 필요하다.** 읽기 전용 공유로는 열리지 않는다(--check 로 확인).
        internal static OleDbConnection OpenReadOnly(string mdbPath, string provider, string password)
        {
            string cs = $"Provider={provider};Data Source={mdbPath};Mode=Read;" +
                        $"Jet OLEDB:Database Password={password};OLE DB Services=-4;";
            var conn = new OleDbConnection(cs);
            conn.Open();
            return conn;
        }

        internal static List<Attendance> ReadAttendance(OleDbConnection conn, string cutoffYmd)
        {
            // d_date 는 "yyyyMMdd" 문자열 → 사전식 비교가 곧 시간순 비교
            const string sql =
                "SELECT fpid, e_name, d_date, in_time, out_time, basic_time, over_time, " +
                "night_time, late_time, total_time, decision " +
                "FROM nOutput WHERE d_date >= ? ORDER BY d_date, fpid";

            var list = new List<Attendance>();
            using (var cmd = new OleDbCommand(sql, conn))
            {
                cmd.Parameters.Add(new OleDbParameter("cutoff", OleDbType.VarWChar) { Value = cutoffYmd });
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        string ymd = GetStr(r, "d_date");
                        if (string.IsNullOrWhiteSpace(ymd) || ymd.Length != 8) continue;

                        int inRaw = GetInt(r, "in_time", -1);
                        int outRaw = GetInt(r, "out_time", -1);
                        int decision = GetInt(r, "decision", -1);

                        list.Add(new Attendance
                        {
                            empId = GetInt(r, "fpid", 0),
                            name = GetStr(r, "e_name"),
                            date = FormatDate(ymd),
                            inAt = MinutesToIso(ymd, inRaw, false, inRaw),
                            outAt = MinutesToIso(ymd, outRaw, true, inRaw),
                            basicMin = GetInt(r, "basic_time", 0),
                            overMin = GetInt(r, "over_time", 0),
                            nightMin = GetInt(r, "night_time", 0),
                            lateMin = GetInt(r, "late_time", 0),
                            totalMin = GetInt(r, "total_time", 0),
                            status = MapDecision(decision),
                            // 원본 값 보존: 정제 가정이 틀려도 웹/Firestore에서 재해석 가능
                            raw = new AttendanceRaw { decision = decision, inTime = inRaw, outTime = outRaw }
                        });
                    }
                }
            }
            return list;
        }

        internal static List<Employee> ReadEmployees(OleDbConnection conn)
        {
            var list = new List<Employee>();
            using (var cmd = new OleDbCommand("SELECT id, name, retire_date FROM tuser", conn))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    string retire = GetStr(r, "retire_date");
                    list.Add(new Employee
                    {
                        empId = GetInt(r, "id", 0),
                        name = GetStr(r, "name"),
                        active = string.IsNullOrWhiteSpace(retire),
                        retireDate = string.IsNullOrWhiteSpace(retire) ? null : retire
                    });
                }
            }
            return list;
        }

        internal static List<Holiday> ReadHolidays(OleDbConnection conn)
        {
            var list = new List<Holiday>();
            using (var cmd = new OleDbCommand("SELECT d_date, n_name FROM nHoliday", conn))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    var h = ParseHoliday(GetStr(r, "d_date"), GetStr(r, "n_name"));
                    if (h != null) list.Add(h);
                }
            }
            return list;
        }

        // nHoliday.d_date 파싱: 8자리=특정일(yyyyMMdd), 4자리=매년 반복(MMDD), 그 외=null(스킵)
        internal static Holiday ParseHoliday(string rawDate, string name)
        {
            if (string.IsNullOrWhiteSpace(rawDate)) return null;
            string ymd = rawDate.Trim();
            if (ymd.Length == 8)
                return new Holiday { date = FormatDate(ymd), monthDay = null, recurring = false, name = name };
            if (ymd.Length == 4)
                return new Holiday { date = null, monthDay = ymd.Substring(0, 2) + "-" + ymd.Substring(2, 2), recurring = true, name = name };
            return null;
        }

        // ---------- 정제 헬퍼 ----------

        // CAPS 시간값은 "자정 기준 분". 시계시각 = value mod 1440, -1 은 미기록.
        // 가정: in/out 모두 d_date 소속. out 의 시계시각이 in 보다 이르면 야간근무로 보고 +1일.
        //   (이 가정은 raw 값도 함께 보내므로 필요 시 서버에서 재계산 가능)
        internal static string MinutesToIso(string ymd, int minutes, bool isOut, int inMinutes)
        {
            if (minutes < 0) return null; // -1 = 미기록
            DateTime baseDate = DateTime.ParseExact(ymd, "yyyyMMdd", CultureInfo.InvariantCulture);
            int clock = ((minutes % 1440) + 1440) % 1440;
            DateTime dt = baseDate.Date.AddMinutes(clock);

            if (isOut && inMinutes >= 0)
            {
                int inClock = ((inMinutes % 1440) + 1440) % 1440;
                if (clock < inClock) dt = dt.AddDays(1); // 자정 넘긴 퇴근
            }
            // KST(+09:00) 고정
            var kst = new DateTimeOffset(dt, TimeSpan.FromHours(9));
            return kst.ToString("yyyy-MM-ddTHH:mm:sszzz");
        }

        // decision 코드 → 상태.
        // ⚠️ 실데이터 패턴 기반 "추정" 매핑이다. CAPS 관리화면/벤더 문서로 확정 전까지
        //    raw.decision(원본 코드)를 진짜 근거로 삼을 것. (특히 7=휴무 vs 8=결근 구분은 미확정)
        internal static string MapDecision(int d)
        {
            switch (d)
            {
                case 0: case 1: case 2: return "normal";       // 출퇴근 정상(연장 유무 무관)
                case 3: case 4: case 5: return "late";         // 지각(late_time > 0)
                case 6: return "holiday_work";                 // 기본0·연장만·정상펀치 → 휴일근무 추정
                case 7: return "off";                          // 미펀치, 결근과 구분되는 휴무 추정
                case 8: return "absent";                       // 미펀치 → 결근
                case 10: case 11: case 12: return "missing_out"; // 출근O 퇴근X
                case 14: case 15: case 16: return "missing_in";  // 출근X 퇴근O
                default: return "unknown";
            }
        }

        internal static string FormatDate(string ymd)
        {
            return ymd.Substring(0, 4) + "-" + ymd.Substring(4, 2) + "-" + ymd.Substring(6, 2);
        }

        // status 영문 → 한글 라벨
        private static readonly Dictionary<string, string> StatusKo = new Dictionary<string, string>
        {
            { "normal", "정상" }, { "late", "지각" }, { "absent", "결근" }, { "off", "휴무" },
            { "holiday_work", "휴일근무" }, { "missing_out", "퇴근미기록" }, { "missing_in", "출근미기록" }, { "unknown", "미정" }
        };

        private static string Ko(string status)
        {
            return (status != null && StatusKo.ContainsKey(status)) ? StatusKo[status] : status;
        }

        // ISO("2026-08-11T08:12:00+09:00") → "08:12", null → "--:--"
        internal static string Clock(string iso)
        {
            if (string.IsNullOrEmpty(iso)) return "--:--";
            int t = iso.IndexOf('T');
            return (t >= 0 && iso.Length >= t + 6) ? iso.Substring(t + 1, 5) : iso;
        }

        // 사람이 메모장으로 열어 한눈에 확인하는 요약 txt (매 전송마다 덮어씀).
        // 상주 모드에선 이 파일이 곧 "에이전트 상태판"이다 — 마지막 전송이 언제였는지가 제일 중요하다.
        private static void WriteSummary(Payload payload, string outcome, string trigger)
        {
            var sb = new StringBuilder();
            sb.AppendLine("===== CapsSync 실행 요약 =====");
            sb.AppendLine("모드     : " + _cfg.Mode + (_cfg.SendEnabled ? "" : " (드라이런)"));
            sb.AppendLine("갱신시각 : " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            sb.AppendLine("트리거   : " + trigger);
            sb.AppendLine("전송     : " + outcome);
            sb.AppendLine("마지막 성공: " + (_lastSentAt.HasValue
                ? _lastSentAt.Value.ToString("yyyy-MM-dd HH:mm:ss") + $" ({Ago(_lastSentAt.Value)})"
                : "(없음)"));
            if (_consecutiveFailures > 0) sb.AppendLine($"연속 실패 : {_consecutiveFailures}회 — log.txt 확인");
            sb.AppendLine("DB       : " + _cfg.MdbPath);

            if (payload != null)
            {
                sb.AppendLine("윈도우   : " + payload.windowStart + " ~ 오늘");
                sb.AppendLine($"이번 전송 : 근태 {payload.attendance.Count} / 직원 {payload.employees.Count} / 공휴일 {payload.holidays.Count}");
                sb.AppendLine();

                if (payload.attendance.Count > 0)
                {
                    sb.AppendLine("[상태 분포]");
                    var groups = new Dictionary<string, int>();
                    foreach (var a in payload.attendance)
                    {
                        string s = a.status ?? "unknown";
                        groups[s] = (groups.ContainsKey(s) ? groups[s] : 0) + 1;
                    }
                    foreach (var kv in groups.OrderByDescending(k => k.Value))
                        sb.AppendLine($"  {Ko(kv.Key),-8} {kv.Value}건");
                    sb.AppendLine();

                    sb.AppendLine("[이번에 보낸 근태 5건]");
                    foreach (var a in payload.attendance.OrderByDescending(x => x.date).Take(5))
                        sb.AppendLine($"  {a.name} {a.date}  {Clock(a.inAt)}~{Clock(a.outAt)}  {Ko(a.status)}  (기본{a.basicMin}분 연장{a.overMin}분)");
                }
                else
                {
                    sb.AppendLine("(바뀐 행 없음 — 살아있음을 알리는 하트비트만 보냄)");
                }
            }

            string path = _cfg.SummaryPath;
            EnsureParentDir(path);
            File.WriteAllText(path, sb.ToString(), new UTF8Encoding(true)); // BOM → 메모장 한글 정상
        }

        // ---------- 전송 ----------

        private static void PostWithRetry(Payload payload)
        {
            string body = Json.Serialize(payload);
            string secret = ReadSecret(_cfg.SecretFilePath);
            string ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
            string signature = Sign(secret, ts, body);

            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

            Exception last = null;
            for (int attempt = 1; attempt <= Math.Max(1, _cfg.MaxRetries); attempt++)
            {
                try
                {
                    using (var http = new HttpClient { Timeout = TimeSpan.FromSeconds(_cfg.HttpTimeoutSeconds) })
                    using (var req = new HttpRequestMessage(HttpMethod.Post, _cfg.IngestUrl))
                    {
                        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
                        // 커스텀 X- 헤더는 요청 헤더(content 아님)에. 검증 우회로 안전하게 추가.
                        req.Headers.TryAddWithoutValidation("X-Caps-Timestamp", ts);
                        req.Headers.TryAddWithoutValidation("X-Caps-Signature", signature);

                        var resp = http.SendAsync(req).GetAwaiter().GetResult();
                        string respBody = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                        if (resp.IsSuccessStatusCode)
                        {
                            Log($"전송 성공 ({(int)resp.StatusCode}): {Truncate(respBody, 300)}");
                            return;
                        }
                        throw new Exception($"HTTP {(int)resp.StatusCode}: {Truncate(respBody, 300)}");
                    }
                }
                catch (Exception ex)
                {
                    last = ex;
                    Log($"전송 시도 {attempt} 실패: {ex.Message}");
                    if (attempt < _cfg.MaxRetries) Thread.Sleep(TimeSpan.FromSeconds(2 * attempt)); // 백오프
                }
            }
            throw new Exception("전송 최종 실패", last);
        }

        // HMAC-SHA256( secret, timestamp + "." + body ) → 소문자 hex.
        // 서버는 동일 방식으로 재계산해 비교하고, timestamp 신선도(±5분)를 확인해 재전송을 차단한다.
        internal static string Sign(string secret, string timestamp, string body)
        {
            using (var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
            {
                byte[] mac = h.ComputeHash(Encoding.UTF8.GetBytes(timestamp + "." + body));
                var sb = new StringBuilder(mac.Length * 2);
                foreach (byte b in mac) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        private static string ReadSecret(string path)
        {
            if (!File.Exists(path)) throw new FileNotFoundException("secret 파일 없음", path);
            return File.ReadAllText(path).Trim();
        }

        // ---------- 유틸 ----------

        private static string FindConfigPath()
        {
            string dir = AppDomain.CurrentDomain.BaseDirectory;
            string p = Path.Combine(dir, "config.json");
            if (!File.Exists(p)) throw new FileNotFoundException("config.json 없음 (config.example.json 참고)", p);
            return p;
        }

        // 상위 폴더가 없으면 만든다. 폴더 없는 상대 경로면 아무것도 하지 않는다(CreateDirectory("") 방지).
        private static void EnsureParentDir(string path)
        {
            string dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        }

        private static string GetStr(IDataRecord r, string col)
        {
            int i = r.GetOrdinal(col);
            if (r.IsDBNull(i)) return null;
            object v = r.GetValue(i);
            return v == null ? null : v.ToString().Trim();
        }

        private static int GetInt(IDataRecord r, string col, int fallback)
        {
            int i = r.GetOrdinal(col);
            if (r.IsDBNull(i)) return fallback;
            object v = r.GetValue(i);
            if (v == null) return fallback;
            int parsed;
            if (v is int iv) return iv;
            if (int.TryParse(v.ToString().Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed)) return parsed;
            return fallback;
        }

        private static string Truncate(string s, int n) =>
            string.IsNullOrEmpty(s) ? s : (s.Length <= n ? s : s.Substring(0, n) + "…");

        // 기본 로그 = exe 폴더의 log.txt (config LogPath 로 덮어쓸 수 있음). 외부 라이브러리 없음.
        private static readonly string DefaultLogPath =
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log.txt");

        private static readonly object LogGate = new object();

        private static void Log(string msg)
        {
            string line = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + msg;
            Console.WriteLine(line);
            try
            {
                string path = (_cfg != null && !string.IsNullOrWhiteSpace(_cfg.LogPath)) ? _cfg.LogPath : DefaultLogPath;
                // 워처 스레드와 메인 루프가 같이 쓴다 — 한 줄씩 온전히 남도록 직렬화.
                lock (LogGate)
                {
                    RollIfLarge(path);
                    File.AppendAllText(path, line + Environment.NewLine, new UTF8Encoding(false));
                }
            }
            catch { /* 로그 실패는 무시 */ }
        }

        // 로그가 5MB 넘으면 .1 로 한 번 롤 → 무한 증가 방지(라이브러리 불필요)
        private static void RollIfLarge(string path)
        {
            try
            {
                var fi = new FileInfo(path);
                if (fi.Exists && fi.Length > 5_000_000)
                {
                    string dir = Path.GetDirectoryName(path);
                    string old = Path.Combine(string.IsNullOrEmpty(dir) ? "." : dir,
                        Path.GetFileNameWithoutExtension(path) + ".1" + Path.GetExtension(path));
                    if (File.Exists(old)) File.Delete(old);
                    File.Move(path, old);
                }
            }
            catch { }
        }
    }

    // ---------- 명령행 ----------

    internal sealed class CommandLine
    {
        public string Mode;      // null = config 의 Mode 를 따름
        public bool Resync;
        public bool ShowHelp;

        public const string HelpText =
            "CapsSync — CAPS(Access .mdb) 근태 실시간 인제스트 에이전트\n" +
            "\n" +
            "사용법: CapsSync.exe [옵션]\n" +
            "\n" +
            "  (옵션 없음)   config.json 의 Mode 대로 실행 (기본 watch)\n" +
            "  --watch      상주하며 .mdb 변경을 감시해 실시간 전송\n" +
            "  --once       한 번만 훑고 종료 (수동 점검·복구용)\n" +
            "  --check      아무것도 보내지 않고 설정·DB 연결 상태만 출력\n" +
            "  --resync     상태 캐시를 비우고 시작 (창 전체를 다시 전송)\n" +
            "  --help       이 도움말\n" +
            "\n" +
            "DB 위치·전송 대상은 exe 옆 config.json 에서 바꾼다. 확인은 --check.";

        internal static CommandLine Parse(string[] args)
        {
            var cli = new CommandLine();
            foreach (string arg in args ?? new string[0])
            {
                switch (arg.Trim().ToLowerInvariant().TrimStart('-', '/'))
                {
                    case "watch": cli.Mode = "watch"; break;
                    case "once": cli.Mode = "once"; break;
                    case "check": case "verify": cli.Mode = "check"; break;
                    case "resync": cli.Resync = true; break;
                    case "help": case "h": case "?": cli.ShowHelp = true; break;
                }
            }
            return cli;
        }
    }

    // ---------- DTO / 설정 ----------

    internal sealed class Config
    {
        // ── 실제 CAPS DB 위치. 배포 PC에서 여기만 바꾸면 된다(확인: CapsSync.exe --check) ──
        public string MdbPath { get; set; }
        public string MdbPassword { get; set; }
        public string OleDbProvider { get; set; } = "Microsoft.ACE.OLEDB.16.0";

        // watch(상주 실시간) | once(1회) | check(점검)
        public string Mode { get; set; } = "watch";

        public string IngestUrl { get; set; }
        public string SecretFilePath { get; set; }

        // ── 실시간 폴링 ──
        // DB를 다시 읽는 주기. 출퇴근이 찍히고 이 시간 안에 전송된다(= 실시간성).
        public int PollSeconds { get; set; } = 5;
        // 변경이 없어도 이 주기로 창 전체를 다시 훑는다(누락 복구 + 서버에 살아있음 알림).
        public int FullSyncMinutes { get; set; } = 30;
        // 폴링이 훑는 최근 일수. 펀치는 오늘 행이라 짧아도 되고, 짧을수록 폴링이 가볍다.
        public int WatchWindowDays { get; set; } = 3;
        // 전수 동기화가 훑는 일수.
        public int WindowDays { get; set; } = 45;
        // 마지막으로 전송에 성공한 행들의 지문 캐시(비우면 exe 폴더의 state.json).
        public string StatePath { get; set; }

        public string TempDir { get; set; }
        public string LogPath { get; set; }
        public int HttpTimeoutSeconds { get; set; } = 60;
        public int MaxRetries { get; set; } = 3;

        // false 면 읽기·정제까지만 하고 HTTP 전송을 생략(드라이런/일시정지/역할분기용).
        public bool SendEnabled { get; set; } = true;
        // 드라이런일 때 정제 결과 JSON을 저장할 경로(비우면 TempDir\last_payload.json).
        public string LastPayloadPath { get; set; }
        // 사람이 확인하는 요약 txt 경로(비우면 TempDir\last_run_summary.txt).
        public string SummaryPath { get; set; }

        public static Config Load(string path)
        {
            var js = new JavaScriptSerializer();
            var cfg = js.Deserialize<Config>(File.ReadAllText(path));
            if (string.IsNullOrWhiteSpace(cfg.MdbPath)) throw new Exception("config: MdbPath 누락");

            // 비운 경로는 전부 exe 폴더 기준으로 → 폴더 하나에 다 모여서 이동/관리 편함
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            if (string.IsNullOrWhiteSpace(cfg.Mode))            cfg.Mode            = "watch";
            if (string.IsNullOrWhiteSpace(cfg.TempDir))         cfg.TempDir         = exeDir;
            if (string.IsNullOrWhiteSpace(cfg.LogPath))         cfg.LogPath         = Path.Combine(exeDir, "log.txt");
            if (string.IsNullOrWhiteSpace(cfg.SummaryPath))     cfg.SummaryPath     = Path.Combine(exeDir, "last_run_summary.txt");
            if (string.IsNullOrWhiteSpace(cfg.SecretFilePath))  cfg.SecretFilePath  = Path.Combine(exeDir, "secret.txt");
            if (string.IsNullOrWhiteSpace(cfg.StatePath))       cfg.StatePath       = Path.Combine(exeDir, "state.json");
            if (string.IsNullOrWhiteSpace(cfg.LastPayloadPath)) cfg.LastPayloadPath = Path.Combine(cfg.TempDir, "last_payload.json");

            // 드라이런은 **별도 상태 파일**을 쓴다.
            // 같은 파일에 커밋하면 나중에 SendEnabled=true 로 바꿨을 때 "이미 보냈다"고 기억해
            // 아무것도 안 보내는 함정이 되고, 반대로 커밋을 아예 안 하면 상주 모드에서 매 폴링마다
            // "전부 변경됨"으로 보여 로그가 폭주한다. 파일을 나누면 둘 다 피한다.
            if (!cfg.SendEnabled)
            {
                string dir = Path.GetDirectoryName(cfg.StatePath);
                cfg.StatePath = Path.Combine(
                    string.IsNullOrEmpty(dir) ? exeDir : dir,
                    Path.GetFileNameWithoutExtension(cfg.StatePath) + ".dryrun" + Path.GetExtension(cfg.StatePath));
            }

            // 이벤트 창이 전수 창보다 넓으면 "짧게 자주, 넓게 가끔"이라는 구분이 무의미해진다.
            if (cfg.WatchWindowDays > cfg.WindowDays) cfg.WatchWindowDays = cfg.WindowDays;

            if (cfg.SendEnabled && string.IsNullOrWhiteSpace(cfg.IngestUrl))
                throw new Exception("config: IngestUrl 누락 (SendEnabled=true)");
            return cfg;
        }
    }

    internal sealed class Payload
    {
        public string source { get; set; }
        public string generatedAt { get; set; }
        public string windowStart { get; set; }
        public List<Attendance> attendance { get; set; }
        public List<Employee> employees { get; set; }
        public List<Holiday> holidays { get; set; }
    }

    internal sealed class Attendance
    {
        public int empId { get; set; }        // = CAPS tuser.id = nOutput.fpid
        public string name { get; set; }
        public string date { get; set; }       // "2026-08-11"
        public string inAt { get; set; }       // ISO8601 +09:00, null=미기록
        public string outAt { get; set; }
        public int basicMin { get; set; }
        public int overMin { get; set; }
        public int nightMin { get; set; }
        public int lateMin { get; set; }
        public int totalMin { get; set; }
        public string status { get; set; }     // normal|late|absent|missing_out|unknown
        public AttendanceRaw raw { get; set; } // 원본 코드 보존
    }

    internal sealed class AttendanceRaw
    {
        public int decision { get; set; }
        public int inTime { get; set; }
        public int outTime { get; set; }
    }

    internal sealed class Employee
    {
        public int empId { get; set; }
        public string name { get; set; }
        public bool active { get; set; }
        public string retireDate { get; set; }
    }

    internal sealed class Holiday
    {
        public string date { get; set; }       // "yyyy-MM-dd" (특정일) 또는 null
        public string monthDay { get; set; }   // "MM-DD" (매년 반복) 또는 null
        public bool recurring { get; set; }     // true = 매년 반복 고정 공휴일
        public string name { get; set; }
    }
}
