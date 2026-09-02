# CapsSync end-to-end mock test (ASCII-only so it parses under Windows PowerShell 5.1).
#
# Runs the built CapsSync.exe against a real .mdb, with a local mock endpoint standing in
# for Vercel /api/ingest. Verifies the FULL chain: copy -> read -> normalize -> HMAC sign
# -> HTTP POST -> response handling. The mock re-computes the HMAC to prove the signature.
#
# Usage (from repo root, after `dotnet build -c Release`):
#   powershell -ExecutionPolicy Bypass -File CapsSync\tools\e2e-mock-test.ps1 `
#       -Mdb C:\work\db_decryption\ACCESS.mdb -Password <mdb 비밀번호>
#
param(
  [string]$Exe      = "$PSScriptRoot\..\bin\Release\net48\CapsSync.exe",
  [string]$Mdb      = "C:\work\db_decryption\ACCESS.mdb",
  [string]$Password = $env:CAPS_TEST_PWD,
  [string]$Provider = "Microsoft.ACE.OLEDB.16.0",
  [int]$Port        = 5005,
  [string]$Secret   = "e2e-test-secret-abcdef123456"
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrEmpty($Password)) { throw "Password required (-Password or `$env:CAPS_TEST_PWD)" }
if (-not (Test-Path $Exe)) { throw "exe not found: $Exe  (run: dotnet build -c Release)" }
if (-not (Test-Path $Mdb)) { throw "mdb not found: $Mdb" }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("capse2e_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work -Force | Out-Null
try {
  Copy-Item $Exe $work
  Copy-Item ($Exe + ".config") $work -ErrorAction SilentlyContinue
  [System.IO.File]::WriteAllText("$work\secret.txt", $Secret)

  # Mode=once: the agent's default is "watch" (resident), which would never exit and hang this test.
  # A fresh $work dir means no state.json, so the first run sends the whole window (1612 rows).
  $cfg = @{
    MdbPath = $Mdb; MdbPassword = $Password; OleDbProvider = $Provider
    Mode = "once"
    SendEnabled = $true; IngestUrl = "http://127.0.0.1:$Port/ingest"
    SecretFilePath = "$work\secret.txt"; WindowDays = 3650
    TempDir = "$work\tmp"; LogPath = "$work\capssync.log"
    HttpTimeoutSeconds = 30; MaxRetries = 1
  } | ConvertTo-Json
  Set-Content -Path "$work\config.json" -Value $cfg -Encoding UTF8

  $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "$work\$([System.IO.Path]::GetFileName($Exe))"
  $psi.Arguments = "--once"      # belt and braces: never let this test start the resident watcher
  $psi.WorkingDirectory = $work
  $psi.UseShellExecute = $false
  $proc = [System.Diagnostics.Process]::Start($psi)

  $client = $listener.AcceptTcpClient()
  $stream = $client.GetStream(); $stream.ReadTimeout = 15000

  $hb = New-Object System.Collections.Generic.List[byte]; $one = New-Object byte[] 1
  while ($true) {
    $n = $stream.Read($one, 0, 1); if ($n -le 0) { break }
    $hb.Add($one[0]); $c = $hb.Count
    if ($c -ge 4 -and $hb[$c-4] -eq 13 -and $hb[$c-3] -eq 10 -and $hb[$c-2] -eq 13 -and $hb[$c-1] -eq 10) { break }
  }
  $headerText = [System.Text.Encoding]::ASCII.GetString($hb.ToArray())
  if ($headerText -match "(?im)^Expect:\s*100-continue") {
    $cont = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 100 Continue`r`n`r`n")
    $stream.Write($cont, 0, $cont.Length); $stream.Flush()
  }
  $contentLength = 0; $ts = $null; $sig = $null
  foreach ($line in ($headerText -split "`r`n")) {
    if ($line -match '^(?i)Content-Length:\s*(\d+)') { $contentLength = [int]$Matches[1] }
    if ($line -match '^(?i)X-Caps-Timestamp:\s*(.+)$') { $ts = $Matches[1].Trim() }
    if ($line -match '^(?i)X-Caps-Signature:\s*(.+)$') { $sig = $Matches[1].Trim() }
  }
  $body = New-Object byte[] $contentLength; $rd = 0
  while ($rd -lt $contentLength) { $r = $stream.Read($body, $rd, $contentLength - $rd); if ($r -le 0) { break }; $rd += $r }
  $bodyStr = [System.Text.Encoding]::UTF8.GetString($body, 0, $rd)

  $h = New-Object System.Security.Cryptography.HMACSHA256
  $h.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
  $mac = $h.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$ts.$bodyStr"))
  $expected = ($mac | ForEach-Object { $_.ToString("x2") }) -join ""
  $sigOk = ($expected -eq $sig)

  $respBytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"upserted":{"note":"mock"}}')
  $resp = "HTTP/1.1 200 OK`r`nContent-Type: application/json`r`nContent-Length: $($respBytes.Length)`r`nConnection: close`r`n`r`n"
  $rh = [System.Text.Encoding]::ASCII.GetBytes($resp)
  $stream.Write($rh, 0, $rh.Length); $stream.Write($respBytes, 0, $respBytes.Length); $stream.Flush()
  $client.Close(); $listener.Stop()

  $j = $bodyStr | ConvertFrom-Json
  Write-Output "===== MOCK RECEIVED ====="
  Write-Output ("body bytes    : {0}" -f $rd)
  Write-Output ("HMAC verify   : {0}" -f $(if ($sigOk) { "PASS" } else { "FAIL exp=$expected got=$sig" }))
  Write-Output ("payload counts: attendance={0} employees={1} holidays={2}" -f $j.attendance.Count, $j.employees.Count, $j.holidays.Count)
  $proc.WaitForExit(30000) | Out-Null
  Write-Output ("exe exit code : {0}" -f $proc.ExitCode)
  if (-not $sigOk -or $proc.ExitCode -ne 0) { exit 1 }
  Write-Output "E2E OK"
}
finally { Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue }