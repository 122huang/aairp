$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$regression = $args -contains "--regression"
Write-Host "Running AAIRP benchmark evaluation..."
if ($regression) {
  pnpm eval:benchmark -- --regression
} else {
  pnpm eval:benchmark
}
if ($LASTEXITCODE -ne 0) {
  Write-Error "Benchmark evaluation failed"
}
Write-Host "Reports written to reports/"
