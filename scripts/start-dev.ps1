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

Write-Host "Starting API (pnpm dev:api)..."
pnpm dev:api
