$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "KOS demo import (requires DATABASE_URL + migrated schema)"

if (-not $env:DATABASE_URL) {
  Write-Host "DATABASE_URL not set — using default postgresql://aairp:aairp@localhost:5432/aairp"
  $env:DATABASE_URL = "postgresql://aairp:aairp@localhost:5432/aairp"
}

pnpm kos:import-demo
if ($LASTEXITCODE -ne 0) {
  Write-Error "kos:import-demo failed (exit $LASTEXITCODE)"
}

Write-Host "Demo knowledge import complete."
