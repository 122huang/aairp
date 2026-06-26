$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$BaseUrl = if ($env:AAIRP_API_URL) { $env:AAIRP_API_URL.TrimEnd('/') } else { "http://localhost:3000" }

Write-Host "KOS smoke — $BaseUrl/kos/v1/health"

$response = Invoke-WebRequest -Uri "$BaseUrl/kos/v1/health" -Headers @{ Accept = "application/json" } -UseBasicParsing
if ($response.StatusCode -ne 200) {
  Write-Error "Expected 200, got $($response.StatusCode)"
}

$body = $response.Content | ConvertFrom-Json
if ($body.status -ne "ok") {
  Write-Error "Expected status ok, got $($body.status)"
}
if ($body.api_prefix -ne "/kos/v1") {
  Write-Error "Expected api_prefix /kos/v1, got $($body.api_prefix)"
}

Write-Host "KOS search — $BaseUrl/kos/v1/search?type=case&q=cure"

$search = Invoke-WebRequest -Uri "$BaseUrl/kos/v1/search?type=case&q=cure" -Headers @{ Accept = "application/json" } -UseBasicParsing
if ($search.StatusCode -ne 200) {
  Write-Error "Search expected 200, got $($search.StatusCode)"
}

$searchBody = $search.Content | ConvertFrom-Json
if ($null -eq $searchBody.items) {
  Write-Error "Search response missing items array"
}

Write-Host "KOS smoke passed (health + search)."
