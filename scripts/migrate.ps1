param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql://aairp:aairp@localhost:5432/aairp"
  Write-Host "DATABASE_URL not set; using default local Docker URL"
}

$env:DATABASE_URL = $DatabaseUrl
Set-Location $Root

Write-Host "AAIRP database migrate (E0-S2)"
Write-Host "DATABASE_URL=$DatabaseUrl"
Write-Host ""

pnpm --filter @aairp/infrastructure migrate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Migrate complete."
