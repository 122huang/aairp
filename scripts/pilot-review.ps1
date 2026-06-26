param(
  [Parameter(Mandatory = $false)]
  [string]$Case,
  [switch]$All,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutputJson
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IndexPath = Join-Path $Root "pilot\index.json"

if (-not (Test-Path $IndexPath)) {
  Write-Error "Pilot index not found: $IndexPath"
}

if (-not $All -and -not $Case) {
  Write-Error "Specify -Case <case_id> or -All"
}

$index = Get-Content $IndexPath -Raw | ConvertFrom-Json
$cases = if ($All) { $index.cases } else { @($index.cases | Where-Object { $_.case_id -eq $Case }) }

if ($cases.Count -eq 0) {
  Write-Error "Case not found in pilot index: $Case"
}

$failures = 0
$results = @()

foreach ($entry in $cases) {
  $casePath = Join-Path $Root ("pilot\" + $entry.path)
  if (-not (Test-Path $casePath)) {
    Write-Error "Case file not found: $casePath"
  }

  $caseJson = Get-Content $casePath -Raw | ConvertFrom-Json
  $body = $caseJson.upload | ConvertTo-Json -Depth 10 -Compress

  Write-Host ""
  Write-Host "=== POST /demo/review — $($entry.case_id) ($($caseJson.pilot_id), $($caseJson.country_id)/$($caseJson.category_id), human=$($caseJson.ground_truth.human_decision)) ==="

  $response = curl.exe -s -w "`nHTTP_STATUS:%{http_code}" `
    -X POST "$BaseUrl/demo/review" `
    -H "Accept: application/json" `
    -H "Content-Type: application/json" `
    -d $body

  $parts = $response -split "HTTP_STATUS:"
  $status = $parts[-1].Trim()
  $content = $parts[0..($parts.Length - 2)] -join "HTTP_STATUS:"

  if ($status -ne "200") {
    Write-Host "Status: $status"
    Write-Host $content
    $failures++
    $results += [pscustomobject]@{
      case_id = $entry.case_id
      pilot_id = $caseJson.pilot_id
      track = "L2"
      country_id = $caseJson.country_id
      category_id = $caseJson.category_id
      human_decision = $caseJson.ground_truth.human_decision
      ai_decision = $null
      agreement = "API_ERROR"
      http_status = $status
      ran_at = (Get-Date).ToUniversalTime().ToString("o")
    }
    continue
  }

  $parsed = $content | ConvertFrom-Json
  $ai = $parsed.final_decision
  $human = $caseJson.ground_truth.human_decision
  $agreement = if ($ai -eq $human) { "AGREE" } else { "DISAGREE_DECISION" }

  Write-Host "Status: $status"
  Write-Host "final_decision: $ai (human: $human) => $agreement"
  Write-Host "confidence: $($parsed.confidence)"

  $results += [pscustomobject]@{
    case_id = $entry.case_id
    pilot_id = $caseJson.pilot_id
    track = "L2"
    country_id = $caseJson.country_id
    category_id = $caseJson.category_id
    ad_text = $caseJson.upload.content.text
    human_decision = $human
    ai_decision = $ai
    agreement = $agreement
    confidence = $parsed.confidence
    issue_type = $caseJson.ground_truth.issue_type
    severity = $caseJson.ground_truth.severity
    http_status = $status
    ran_at = (Get-Date).ToUniversalTime().ToString("o")
  }
}

if ($OutputJson) {
  $outPath = if ([System.IO.Path]::IsPathRooted($OutputJson)) { $OutputJson } else { Join-Path $Root $OutputJson }
  $outDir = Split-Path -Parent $outPath
  if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }
  $payload = @{
    track = "L2"
    base_url = $BaseUrl
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    total = $results.Count
    agree = @($results | Where-Object { $_.agreement -eq "AGREE" }).Count
    disagree = @($results | Where-Object { $_.agreement -eq "DISAGREE_DECISION" }).Count
    errors = @($results | Where-Object { $_.agreement -eq "API_ERROR" }).Count
    results = $results
  }
  $payload | ConvertTo-Json -Depth 10 | Set-Content -Path $outPath -Encoding UTF8
  Write-Host ""
  Write-Host "Wrote L2 results: $outPath"
}

if ($failures -gt 0) {
  exit 1
}
