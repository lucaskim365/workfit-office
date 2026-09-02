using System;
using System.IO;
using System.Linq;
using Xunit;
using CapsSync;

namespace CapsSync.Tests
{
    // 실제 CAPS mdb 를 읽어 정제 결과가 맞는지 검증하는 통합 테스트.
    // 비번은 코드에 박지 않고 환경변수로 주입한다:
    //   CAPS_TEST_PWD  = mdb 비밀번호            (없으면 전체 스킵)
    //   CAPS_TEST_MDB  = mdb 경로  (기본: repo 의 ACCESS.mdb.txt)
    //   CAPS_TEST_PROVIDER = OLEDB provider (기본: Microsoft.ACE.OLEDB.16.0)
    [Trait("Category", "Integration")]
    public class IntegrationTests
    {
        private static (string tmp, string pwd, string provider) Prepare()
        {
            string pwd = Environment.GetEnvironmentVariable("CAPS_TEST_PWD");
            Skip.If(string.IsNullOrEmpty(pwd), "CAPS_TEST_PWD 미설정 → 통합 테스트 스킵 (실행하려면 환경변수 설정)");

            string src = Environment.GetEnvironmentVariable("CAPS_TEST_MDB")
                         ?? @"C:\work\db_decryption\ACCESS.mdb";
            Skip.IfNot(File.Exists(src), "테스트 mdb 파일 없음: " + src);

            string provider = Environment.GetEnvironmentVariable("CAPS_TEST_PROVIDER")
                              ?? "Microsoft.ACE.OLEDB.16.0";

            // 확장자 무관하게 읽히도록 임시 .mdb 로 복사 (원본은 .txt)
            string tmp = Path.Combine(Path.GetTempPath(), "capstest_" + Guid.NewGuid().ToString("N") + ".mdb");
            File.Copy(src, tmp, overwrite: true);
            return (tmp, pwd, provider);
        }

        [SkippableFact]
        public void Counts_MatchKnownDataset()
        {
            var (tmp, pwd, provider) = Prepare();
            try
            {
                using (var conn = Program.OpenReadOnly(tmp, provider, pwd))
                {
                    Assert.Equal(1612, Program.ReadAttendance(conn, "20000101").Count);
                    Assert.Equal(14, Program.ReadEmployees(conn).Count);
                    Assert.Equal(8, Program.ReadHolidays(conn).Count);
                }
            }
            finally { File.Delete(tmp); }
        }

        [SkippableFact]
        public void KnownAttendanceRecord_NormalizesCorrectly()
        {
            var (tmp, pwd, provider) = Prepare();
            try
            {
                using (var conn = Program.OpenReadOnly(tmp, provider, pwd))
                {
                    var att = Program.ReadAttendance(conn, "20000101");
                    // 실데이터: empId=1 의 2026-02-25 → in 08:05, decision 2 = normal
                    // (직원 실명은 개인정보라 단언에 넣지 않는다 — empId 가 안정 키다)
                    var rec = att.Single(a => a.empId == 1 && a.date == "2026-02-25");
                    Assert.Equal("normal", rec.status);
                    Assert.StartsWith("2026-02-25T08:05:00", rec.inAt);
                    Assert.Equal(1925, rec.raw.inTime); // 원본 보존 확인
                }
            }
            finally { File.Delete(tmp); }
        }

        [SkippableFact]
        public void NoUnknownStatus_AllDecisionCodesMapped()
        {
            var (tmp, pwd, provider) = Prepare();
            try
            {
                using (var conn = Program.OpenReadOnly(tmp, provider, pwd))
                {
                    var att = Program.ReadAttendance(conn, "20000101");
                    var unknown = att.Where(a => a.status == "unknown").ToList();
                    Assert.True(unknown.Count == 0,
                        "unknown status 발견 — 매핑 안 된 decision 코드: " +
                        string.Join(",", unknown.Select(a => a.raw.decision).Distinct()));
                }
            }
            finally { File.Delete(tmp); }
        }

        [SkippableFact]
        public void Employees_HaveStableIdAndName()
        {
            var (tmp, pwd, provider) = Prepare();
            try
            {
                using (var conn = Program.OpenReadOnly(tmp, provider, pwd))
                {
                    var emps = Program.ReadEmployees(conn);
                    // 실명 대신 "안정 키가 있고 이름이 채워져 있다"를 검증한다(개인정보 회피).
                    Assert.Contains(emps, e => e.empId == 1 && !string.IsNullOrWhiteSpace(e.name));
                    Assert.All(emps, e => Assert.True(e.empId > 0)); // fpid/id 채워짐
                    Assert.All(emps, e => Assert.False(string.IsNullOrWhiteSpace(e.name)));
                }
            }
            finally { File.Delete(tmp); }
        }

        [SkippableFact]
        public void Holidays_AreRecurringMonthDay()
        {
            var (tmp, pwd, provider) = Prepare();
            try
            {
                using (var conn = Program.OpenReadOnly(tmp, provider, pwd))
                {
                    var hols = Program.ReadHolidays(conn);
                    Assert.All(hols, h => Assert.True(h.recurring && h.monthDay != null && h.date == null));
                    Assert.Contains(hols, h => h.monthDay == "08-15" && h.name == "광복절");
                }
            }
            finally { File.Delete(tmp); }
        }
    }
}
