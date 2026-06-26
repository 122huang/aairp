param(
  [switch]$SkipLive,
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "AAIRP release gate"
Write-Host ""

& "$Root\scripts\smoke-test.ps1"
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not $SkipLive) {
  Write-Host ""
  Write-Host "Attempting live smoke (requires API + Docker deps)..."
  & "$Root\scripts\smoke-test-live.ps1" -BaseUrl $BaseUrl
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Live smoke failed. If API is not running, retry with: .\scripts\release-gate.ps1 -SkipLive"
    exit 1
  }
} else {
  Write-Host ""
  Write-Host "Skipped live smoke (-SkipLive)."
}

Write-Host ""
Write-Host "Release gate PASSED."
Write-Host "See docs/release-checklist.md for manual sign-off items."
