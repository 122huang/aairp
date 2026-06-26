param(
  [switch]$SkipLive,
  [switch]$SkipL2,
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$ResultsDir = Join-Path $Root "pilot\results"
if (-not (Test-Path $ResultsDir)) {
  New-Item -ItemType Directory -Path $ResultsDir -Force | Out-Null
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SummaryPath = Join-Path $ResultsDir "closeout-$Stamp.txt"

function Write-Summary {
  param([string]$Line)
  Add-Content -Path $SummaryPath -Value $Line
  Write-Host $Line
}

Write-Summary "AAIRP Internal Pilot Closeout — $Stamp"
Write-Summary ""

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

$hasNode = Test-Command "node"
$hasPnpm = Test-Command "pnpm"

Write-Summary "Environment: node=$hasNode pnpm=$hasPnpm"

if (-not $hasNode -or -not $hasPnpm) {
  Write-Summary "BLOCKED: Install Node >= 20 and pnpm, then re-run."
  Write-Summary "Manual path: docs/internal-pilot/checklist.md Phase 0"
  Write-Summary ""
  Write-Summary "You can still complete L2 human labels in pilot/pilot-ad-log.csv without API."
  exit 1
}

Write-Summary ""
Write-Summary "== Phase 1: Release gate (offline) =="
& "$Root\scripts\release-gate.ps1" @$(if ($SkipLive) { "-SkipLive" })
if ($LASTEXITCODE -ne 0) {
  Write-Summary "FAIL: Release gate"
  exit 1
}
Write-Summary "PASS: Release gate"

Write-Summary ""
Write-Summary "== Phase 2: L1 benchmark regression =="
$l1Log = Join-Path $ResultsDir "l1-benchmark-$Stamp.txt"
pnpm eval:benchmark -- --regression 2>&1 | Tee-Object -FilePath $l1Log
if ($LASTEXITCODE -ne 0) {
  Write-Summary "FAIL: L1 benchmark regression (see $l1Log)"
  exit 1
}
Write-Summary "PASS: L1 benchmark regression"
Write-Summary "Log: $l1Log"

if (-not $SkipLive) {
  Write-Summary ""
  Write-Summary "== Phase 3: Live API smoke =="
  $healthStatus = curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/health"
  if ($healthStatus -ne "200") {
    Write-Summary "SKIP: API not reachable at $BaseUrl (health=$healthStatus)"
    Write-Summary "Start: .\scripts\start-dev.ps1 then re-run without -SkipLive"
  } else {
    & "$Root\scripts\demo-review.ps1" -Case sg-health-reject-cure -BaseUrl $BaseUrl
    if ($LASTEXITCODE -ne 0) {
      Write-Summary "FAIL: Live sg-health-reject-cure"
      exit 1
    }
    Write-Summary "PASS: Live sg-health-reject-cure"
  }
} else {
  Write-Summary ""
  Write-Summary "== Phase 3: Live API smoke (skipped -SkipLive) =="
}

if (-not $SkipL2) {
  Write-Summary ""
  Write-Summary "== Phase 4: L2 pilot cases =="
  $l2Json = Join-Path $ResultsDir "l2-run-$Stamp.json"
  $healthStatus = curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/health"
  if ($healthStatus -ne "200") {
    Write-Summary "SKIP: L2 API batch — API not up. Run later:"
    Write-Summary "  .\scripts\pilot-review.ps1 -All -OutputJson pilot\results\l2-run.json"
  } else {
    & "$Root\scripts\pilot-review.ps1" -All -BaseUrl $BaseUrl -OutputJson $l2Json
    if ($LASTEXITCODE -ne 0) {
      Write-Summary "FAIL: L2 pilot batch (see $l2Json)"
      exit 1
    }
    Write-Summary "PASS: L2 pilot batch"
    Write-Summary "Results: $l2Json"
    Write-Summary "Next: copy ai_decision from JSON into pilot/pilot-ad-log.csv"
  }
} else {
  Write-Summary ""
  Write-Summary "== Phase 4: L2 pilot cases (skipped -SkipL2) =="
}

Write-Summary ""
Write-Summary "== Closeout next steps =="
Write-Summary "1. Fill docs/internal-pilot/pilot-report-template.md"
Write-Summary "2. Update pilot/pilot-ad-log.csv with ai_decision + reviewer"
Write-Summary "3. Collect trial-feedback-template.md from 2-3 reviewers"
Write-Summary "4. Sign off per docs/internal-pilot/success-criteria.md"
Write-Summary ""
Write-Summary "Summary file: $SummaryPath"
Write-Summary "DONE (automated phases complete)."
