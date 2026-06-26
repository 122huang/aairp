param(
  [Parameter(Mandatory = $true)]
  [string]$Case,
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IndexPath = Join-Path $Root "demo\dataset\index.json"

if (-not (Test-Path $IndexPath)) {
  Write-Error "Dataset index not found: $IndexPath"
}

$index = Get-Content $IndexPath -Raw | ConvertFrom-Json
$entry = $index.cases | Where-Object { $_.case_id -eq $Case } | Select-Object -First 1

if (-not $entry) {
  Write-Error "Case not found in dataset index: $Case"
}

$casePath = Join-Path $Root ("demo\dataset\" + ($entry.path -replace '/', '\'))
if (-not (Test-Path $casePath)) {
  Write-Error "Case file not found: $casePath"
}

$caseJson = Get-Content $casePath -Raw | ConvertFrom-Json
$body = $caseJson.upload | ConvertTo-Json -Depth 10 -Compress

Write-Host "POST /demo/review — case: $Case ($($caseJson.intent), $($caseJson.country_id)/$($caseJson.category_id))"

$response = curl.exe -s -w "`nHTTP_STATUS:%{http_code}" `
  -X POST "$BaseUrl/demo/review" `
  -H "Accept: application/json" `
  -H "Content-Type: application/json" `
  -d $body

$parts = $response -split "HTTP_STATUS:"
$status = $parts[-1].Trim()
$content = $parts[0..($parts.Length - 2)] -join "HTTP_STATUS:"

Write-Host "Status: $status"
Write-Host $content

if ($status -ne "200") {
  exit 1
}

$parsed = $content | ConvertFrom-Json
Write-Host ""
Write-Host "final_decision: $($parsed.final_decision)"
Write-Host "confidence: $($parsed.confidence)"
