using System;
using System.Collections.Generic;
using System.IO;
using Xunit;
using CapsSync;

namespace CapsSync.Tests
{
    // 실시간 감시의 핵심 = "바뀐 행만 골라내기". DB·네트워크 없이 순수 로직만 검증한다.
    public class SyncStateTests
    {
        private static Attendance Att(int empId, string date, string inAt = "2026-08-11T08:12:00+09:00",
                                      string status = "normal", int overMin = 0, string name = "홍길동")
        {
            return new Attendance
            {
                empId = empId, name = name, date = date, inAt = inAt, outAt = null,
                basicMin = 540, overMin = overMin, nightMin = 0, lateMin = 0, totalMin = 540,
                status = status,
                raw = new AttendanceRaw { decision = 1, inTime = 492, outTime = -1 },
            };
        }

        private static Employee Emp(int id, string name, bool active = true)
        {
            return new Employee { empId = id, name = name, active = active, retireDate = active ? null : "2026-01-31" };
        }

        private static Holiday Hol(string monthDay, string name)
        {
            return new Holiday { recurring = true, monthDay = monthDay, date = null, name = name };
        }

        private static List<Employee> NoEmp() { return new List<Employee>(); }
        private static List<Holiday> NoHol() { return new List<Holiday>(); }

        // ---- 키: 서버 문서 ID 규칙(계약 §4)과 같아야 한다 ----

        [Fact]
        public void AttendanceKey_MatchesServerDocIdRule()
        {
            Assert.Equal("7_20260811", SyncState.AttendanceKey(Att(7, "2026-08-11")));
        }

        [Fact]
        public void HolidayKey_Recurring_UsesMdPrefix()
        {
            Assert.Equal("md_0815", SyncState.HolidayKey(Hol("08-15", "광복절")));
        }

        [Fact]
        public void HolidayKey_SpecificDate_UsesYmd()
        {
            var h = new Holiday { recurring = false, monthDay = null, date = "2026-08-15", name = "광복절" };
            Assert.Equal("20260815", SyncState.HolidayKey(h));
        }

        // ---- Diff: 첫 실행은 전부, 커밋 후 같은 값은 아무것도 ----

        [Fact]
        public void Diff_EmptyState_ReturnsEverything()
        {
            var state = new SyncState();
            var delta = state.Diff(
                new List<Attendance> { Att(1, "2026-08-11"), Att(2, "2026-08-11") },
                new List<Employee> { Emp(1, "홍길동") },
                new List<Holiday> { Hol("08-15", "광복절") });

            Assert.Equal(2, delta.AttendanceRows.Count);
            Assert.Single(delta.EmployeeRows);
            Assert.Single(delta.HolidayRows);
            Assert.False(delta.IsEmpty);
        }

        [Fact]
        public void Diff_AfterCommit_UnchangedRowsAreSkipped()
        {
            var state = new SyncState();
            var rows = new List<Attendance> { Att(1, "2026-08-11") };

            state.Commit(state.Diff(rows, NoEmp(), NoHol()), DateTime.Now);

            var again = state.Diff(rows, NoEmp(), NoHol());
            Assert.True(again.IsEmpty);
        }

        [Fact]
        public void Diff_ChangedField_ResendsThatRow()
        {
            var state = new SyncState();
            state.Commit(state.Diff(new List<Attendance> { Att(1, "2026-08-11") }, NoEmp(), NoHol()), DateTime.Now);

            // 퇴근 펀치가 찍혀 outAt·연장이 채워진 상황
            var updated = Att(1, "2026-08-11", overMin: 15);
            updated.outAt = "2026-08-11T18:15:00+09:00";

            var delta = state.Diff(new List<Attendance> { updated }, NoEmp(), NoHol());
            Assert.Single(delta.AttendanceRows);
            Assert.Equal("2026-08-11T18:15:00+09:00", delta.AttendanceRows[0].outAt);
        }

        [Fact]
        public void Diff_NewDay_IsSentWhileOldDaysAreNot()
        {
            var state = new SyncState();
            var day1 = new List<Attendance> { Att(1, "2026-08-11") };
            state.Commit(state.Diff(day1, NoEmp(), NoHol()), DateTime.Now);

            var day2 = new List<Attendance> { Att(1, "2026-08-11"), Att(1, "2026-08-12") };
            var delta = state.Diff(day2, NoEmp(), NoHol());

            Assert.Single(delta.AttendanceRows);
            Assert.Equal("2026-08-12", delta.AttendanceRows[0].date);
        }

        [Fact]
        public void Diff_EmployeeRename_IsResent()
        {
            var state = new SyncState();
            state.Commit(state.Diff(new List<Attendance>(), new List<Employee> { Emp(1, "홍길동") }, NoHol()), DateTime.Now);

            var delta = state.Diff(new List<Attendance>(), new List<Employee> { Emp(1, "홍길순") }, NoHol());
            Assert.Single(delta.EmployeeRows);
        }

        [Fact]
        public void Diff_HolidayWithNoUsableId_IsSkipped()
        {
            // recurring=false 인데 date 도 없으면 서버가 문서 ID를 만들 수 없다 → 보내지 않는다.
            var broken = new Holiday { recurring = false, monthDay = null, date = null, name = "?" };
            var delta = new SyncState().Diff(new List<Attendance>(), NoEmp(), new List<Holiday> { broken });
            Assert.Empty(delta.HolidayRows);
        }

        // ---- 전송 실패 시 커밋하지 않으면 다음 회차가 다시 보낸다(유실 없음) ----

        [Fact]
        public void Diff_WithoutCommit_ResendsSameRows()
        {
            var state = new SyncState();
            var rows = new List<Attendance> { Att(1, "2026-08-11") };

            var first = state.Diff(rows, NoEmp(), NoHol());
            Assert.Single(first.AttendanceRows);

            // 전송이 실패했다고 가정 → Commit 하지 않음
            var second = state.Diff(rows, NoEmp(), NoHol());
            Assert.Single(second.AttendanceRows);
        }

        // ---- Prune: 창 밖 지문은 버린다 ----

        [Fact]
        public void Prune_DropsKeysOlderThanCutoff_KeepsRest()
        {
            var state = new SyncState();
            state.Commit(state.Diff(
                new List<Attendance> { Att(1, "2026-06-01"), Att(1, "2026-08-11") },
                NoEmp(), NoHol()), DateTime.Now);

            int removed = state.Prune("20260701");

            Assert.Equal(1, removed);
            Assert.False(state.AttendanceSeen.ContainsKey("1_20260601"));
            Assert.True(state.AttendanceSeen.ContainsKey("1_20260811"));
        }

        [Fact]
        public void Prune_DoesNotTouchMalformedKeys()
        {
            var state = new SyncState();
            state.AttendanceSeen["weird"] = "abc";
            state.Prune("20260701");
            Assert.True(state.AttendanceSeen.ContainsKey("weird"));
        }

        // ---- 저장/불러오기 ----

        [Fact]
        public void SaveLoad_RoundTrips_AndStaysQuietAfterwards()
        {
            string path = Path.Combine(Path.GetTempPath(), "capsstate_" + Guid.NewGuid().ToString("N") + ".json");
            try
            {
                var rows = new List<Attendance> { Att(1, "2026-08-11") };
                var state = new SyncState();
                state.Commit(state.Diff(rows, NoEmp(), new List<Holiday> { Hol("08-15", "광복절") }), DateTime.Now);
                state.Save(path);

                var reloaded = SyncState.Load(path);
                Assert.Equal(state.AttendanceSeen.Count, reloaded.AttendanceSeen.Count);
                Assert.NotNull(reloaded.LastSentAt);
                // 재기동해도 이미 보낸 행을 다시 보내지 않는다
                Assert.True(reloaded.Diff(rows, NoEmp(), new List<Holiday> { Hol("08-15", "광복절") }).IsEmpty);
            }
            finally { if (File.Exists(path)) File.Delete(path); }
        }

        [Fact]
        public void Load_MissingFile_IsEmptyState()
        {
            var state = SyncState.Load(Path.Combine(Path.GetTempPath(), "no_such_" + Guid.NewGuid().ToString("N") + ".json"));
            Assert.Empty(state.AttendanceSeen);
        }

        [Fact]
        public void Load_CorruptFile_FallsBackToEmptyState()
        {
            // 깨진 상태 파일은 "아무것도 안 보냈다"로 취급 → 다음 전송이 창 전체를 재전송(멱등이라 안전)
            string path = Path.Combine(Path.GetTempPath(), "capsbad_" + Guid.NewGuid().ToString("N") + ".json");
            try
            {
                File.WriteAllText(path, "{ not json at all ");
                Assert.Empty(SyncState.Load(path).AttendanceSeen);
            }
            finally { if (File.Exists(path)) File.Delete(path); }
        }

        // ---- 지문 ----

        [Fact]
        public void Fingerprint_IsStable_And16Hex()
        {
            string a = SyncState.Fingerprint("hello");
            Assert.Equal(a, SyncState.Fingerprint("hello"));
            Assert.Equal(16, a.Length);
            Assert.Matches("^[0-9a-f]{16}$", a);
            Assert.NotEqual(a, SyncState.Fingerprint("hellp"));
        }

        [Fact]
        public void FingerprintOf_DistinguishesNullFromEmpty()
        {
            var withNull = Att(1, "2026-08-11", inAt: null);
            var withEmpty = Att(1, "2026-08-11", inAt: "");
            Assert.NotEqual(SyncState.FingerprintOf(withNull), SyncState.FingerprintOf(withEmpty));
        }
    }

    // 명령행 파싱 — 배포 스크립트가 --watch/--once/--check 를 넘긴다.
    public class CommandLineTests
    {
        [Theory]
        [InlineData("--watch", "watch")]
        [InlineData("--once", "once")]
        [InlineData("--check", "check")]
        [InlineData("--verify", "check")]
        [InlineData("/once", "once")]
        [InlineData("once", "once")]
        public void Parse_RecognizesModeFlags(string arg, string expected)
        {
            Assert.Equal(expected, CommandLine.Parse(new[] { arg }).Mode);
        }

        [Fact]
        public void Parse_NoArgs_LeavesModeToConfig()
        {
            var cli = CommandLine.Parse(new string[0]);
            Assert.Null(cli.Mode);
            Assert.False(cli.Resync);
            Assert.False(cli.ShowHelp);
        }

        [Fact]
        public void Parse_ResyncAndHelp()
        {
            var cli = CommandLine.Parse(new[] { "--once", "--resync" });
            Assert.Equal("once", cli.Mode);
            Assert.True(cli.Resync);
            Assert.True(CommandLine.Parse(new[] { "--help" }).ShowHelp);
        }

        [Fact]
        public void Parse_UnknownFlag_IsIgnored()
        {
            Assert.Null(CommandLine.Parse(new[] { "--nonsense" }).Mode);
        }
    }
}
