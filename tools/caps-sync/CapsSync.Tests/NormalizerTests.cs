using Xunit;
using CapsSync;

namespace CapsSync.Tests
{
    // 순수 변환 로직 단위 테스트 (DB·네트워크 의존성 없음, 빠름)
    public class NormalizerTests
    {
        // ---- MinutesToIso: 분(자정 기준) → ISO(+09:00), mod 1440, -1=미기록, 자정 넘긴 퇴근 +1일 ----

        [Theory]
        [InlineData("20260811", 1932, "2026-08-11T08:12:00+09:00")] // 1932 mod 1440 = 492 = 08:12
        [InlineData("20260811", 2535, "2026-08-11T18:15:00+09:00")] // 2535 mod 1440 = 1095 = 18:15
        [InlineData("20260225", 1925, "2026-02-25T08:05:00+09:00")] // 실데이터 예시
        [InlineData("20260811", 492,  "2026-08-11T08:12:00+09:00")] // 오프셋 없는 값도 동일 시각
        public void MinutesToIso_In_ParsesClock(string ymd, int minutes, string expected)
        {
            Assert.Equal(expected, Program.MinutesToIso(ymd, minutes, isOut: false, inMinutes: minutes));
        }

        [Fact]
        public void MinutesToIso_MinusOne_IsNull()
        {
            Assert.Null(Program.MinutesToIso("20260811", -1, false, -1));
            Assert.Null(Program.MinutesToIso("20260811", -1, true, 485));
        }

        [Fact]
        public void MinutesToIso_Out_SameDay_WhenLaterThanIn()
        {
            // in 08:05(485), out 16:34(994) → 같은 날
            Assert.Equal("2026-02-25T16:34:00+09:00",
                Program.MinutesToIso("20260225", 994, isOut: true, inMinutes: 485));
        }

        [Fact]
        public void MinutesToIso_Out_NextDay_WhenEarlierThanIn()
        {
            // in 23:00(1380), out 01:00(clock 60) → 자정 넘겼으니 +1일
            Assert.Equal("2026-08-12T01:00:00+09:00",
                Program.MinutesToIso("20260811", 1500, isOut: true, inMinutes: 1380));
        }

        // ---- MapDecision: 0~16 → status (추정 매핑, unknown 없어야 정상 데이터) ----

        [Theory]
        [InlineData(0, "normal")]
        [InlineData(1, "normal")]
        [InlineData(2, "normal")]
        [InlineData(3, "late")]
        [InlineData(4, "late")]
        [InlineData(5, "late")]
        [InlineData(6, "holiday_work")]
        [InlineData(7, "off")]
        [InlineData(8, "absent")]
        [InlineData(10, "missing_out")]
        [InlineData(11, "missing_out")]
        [InlineData(12, "missing_out")]
        [InlineData(14, "missing_in")]
        [InlineData(15, "missing_in")]
        [InlineData(16, "missing_in")]
        [InlineData(99, "unknown")]  // 미관측 코드는 unknown
        public void MapDecision_MapsAllKnownCodes(int code, string expected)
        {
            Assert.Equal(expected, Program.MapDecision(code));
        }

        // ---- FormatDate ----

        [Fact]
        public void FormatDate_InsertsHyphens()
        {
            Assert.Equal("2026-08-11", Program.FormatDate("20260811"));
        }

        // ---- ParseHoliday: 4자리 MMDD(반복) / 8자리 yyyyMMdd(특정일) / 그 외 null ----

        [Fact]
        public void ParseHoliday_MMDD_IsRecurring()
        {
            var h = Program.ParseHoliday("0815", "광복절");
            Assert.NotNull(h);
            Assert.True(h.recurring);
            Assert.Equal("08-15", h.monthDay);
            Assert.Null(h.date);
            Assert.Equal("광복절", h.name);
        }

        [Fact]
        public void ParseHoliday_YyyyMMdd_IsSpecificDate()
        {
            var h = Program.ParseHoliday("20260815", "광복절");
            Assert.NotNull(h);
            Assert.False(h.recurring);
            Assert.Equal("2026-08-15", h.date);
            Assert.Null(h.monthDay);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("123")]   // 3자리
        [InlineData("123456")] // 6자리
        public void ParseHoliday_InvalidLength_IsNull(string raw)
        {
            Assert.Null(Program.ParseHoliday(raw, "x"));
        }

        // ---- Sign: HMAC-SHA256(secret, ts + "." + body) 소문자 hex (골든 벡터) ----

        [Fact]
        public void Sign_MatchesGoldenVector()
        {
            // 독립 계산한 기대값 (PowerShell HMACSHA256)
            Assert.Equal("2d57ed31889998823887e9fc930322dff0d921e19e993231a21ba2be53cffaaf",
                Program.Sign("testsecret", "1000", "{}"));
        }

        [Fact]
        public void Sign_IsDeterministic_And64HexChars()
        {
            var a = Program.Sign("s", "1", "body");
            var b = Program.Sign("s", "1", "body");
            Assert.Equal(a, b);
            Assert.Equal(64, a.Length);
            Assert.Matches("^[0-9a-f]{64}$", a);
        }

        [Fact]
        public void Sign_DiffersWhenBodyChanges()
        {
            Assert.NotEqual(Program.Sign("s", "1", "a"), Program.Sign("s", "1", "b"));
        }
    }
}
