param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-Endpoint {
  param([string]$Name, [string]$Url, [string]$ExpectedStatus = "200")
  Write-Host "==> $Name"
  $status = curl.exe -s -o NUL -w "%{http_code}" $Url
  if ($status -ne $ExpectedStatus) {
    Write-Error "$Name failed: HTTP $status (expected $ExpectedStatus)"
  }
  Write-Host "    OK ($status)"
}

Write-Host "AAIRP live smoke test against $BaseUrl"
Write-Host "(Start API first: .\scripts\start-dev.ps1)"
Write-Host ""

Test-Endpoint "GET /health" "$BaseUrl/health"
Test-Endpoint "GET /ready" "$BaseUrl/ready"

Write-Host "==> POST /demo/review REJECT (sg-health-reject-cure)"
& "$Root\scripts\demo-review.ps1" -Case sg-health-reject-cure -BaseUrl $BaseUrl
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "==> POST /demo/review PASS (sg-food-pass-disclosed)"
$casePath = Join-Path $Root "demo\dataset\SG\food\sg-food-pass-disclosed.json"
$caseJson = Get-Content $casePath -Raw | ConvertFrom-Json
$body = $caseJson.upload | ConvertTo-Json -Depth 10 -Compress
$response = curl.exe -s -w "`nHTTP_STATUS:%{http_code}" `
  -X POST "$BaseUrl/demo/review" `
  -H "Accept: application/json" `
  -H "Content-Type: application/json" `
  -d $body
$parts = $response -split "HTTP_STATUS:"
$status = $parts[-1].Trim()
$content = $parts[0..($parts.Length - 2)] -join "HTTP_STATUS:"
if ($status -ne "200") {
  Write-Error "PASS case failed: HTTP $status"
}
$parsed = $content | ConvertFrom-Json
if ($parsed.final_decision -ne "PASS") {
  Write-Error "Expected PASS, got $($parsed.final_decision)"
}
Write-Host "    OK (PASS)"

Write-Host ""
Write-Host "Live smoke tests passed."
