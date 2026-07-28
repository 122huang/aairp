# Start AAIRP API after dependencies are running.
# Prerequisites: Node >= 20, pnpm, Docker (for PG/Redis), .env file
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed. Install Node >= 20 and pnpm, then run: pnpm install"
}

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example"
  } else {
    Write-Error ".env not found. Copy .env.example to .env first."
  }
}

# pnpm/tsx do not auto-load .env — inject into this session first.
. "$PSScriptRoot\load-env.ps1"

Write-Host "AAIRP_IMAGE_REVIEW_ENTRY=$(if ($env:AAIRP_IMAGE_REVIEW_ENTRY) { $env:AAIRP_IMAGE_REVIEW_ENTRY } else { 'off (default)' })"
if (-not (Test-Path "apps\review-app\dist\index.html")) {
  Write-Host "WARN: apps/review-app/dist missing — /review/ will serve legacy review-ui (no Image tab)." -ForegroundColor Yellow
  Write-Host "      Run: pnpm build:review-app   then restart API" -ForegroundColor Yellow
}

Write-Host "Starting API (pnpm dev:api)..."
pnpm dev:api
