$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Step {
  param([string]$Name, [scriptblock]$Action)
  Write-Host ""
  Write-Host "==> $Name"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$Name failed (exit $LASTEXITCODE)"
  }
}

Write-Host "AAIRP offline smoke test (unit + regression eval)"

Invoke-Step "pnpm build" { pnpm build }
Invoke-Step "pnpm test" { pnpm test }
Invoke-Step "benchmark regression" { pnpm eval:benchmark -- --regression }
Invoke-Step "golden benchmark (text)" { pnpm eval:golden -- --no-write }
Invoke-Step "dataset auto eval" { pnpm eval:dataset -- --auto }

Write-Host ""
Write-Host "Offline smoke tests passed."
