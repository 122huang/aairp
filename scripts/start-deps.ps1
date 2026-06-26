# Start PostgreSQL and Redis for local AAIRP development.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "Starting AAIRP dependencies (PostgreSQL + Redis)..."
docker compose up -d

Write-Host "Waiting for healthy containers..."
$deadline = (Get-Date).AddMinutes(2)
while ((Get-Date) -lt $deadline) {
  $raw = docker compose ps --format json
  if (-not $raw) {
    Start-Sleep -Seconds 2
    continue
  }
  $ps = @($raw | ConvertFrom-Json)
  $allHealthy = $true
  foreach ($svc in $ps) {
    if ($svc.Health -and $svc.Health -ne "healthy") {
      $allHealthy = $false
      break
    }
  }
  if ($allHealthy) {
    Write-Host "Dependencies are ready."
    Write-Host "Use .env.example values: DATABASE_URL / REDIS_URL"
    exit 0
  }
  Start-Sleep -Seconds 2
}

Write-Host "Timed out waiting for dependencies. Check: docker compose ps"
exit 1
