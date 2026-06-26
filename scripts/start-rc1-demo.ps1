# RC1-Demo — one-click start (API + UI at :3000)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

Write-Host "Starting dependencies (PostgreSQL + Redis)..."
& "$PSScriptRoot\start-deps.ps1"

Write-Host "Seeding RC1 case library..."
node "$PSScriptRoot\seed-rc1-case-library.mjs"

Write-Host ""
Write-Host "RC1-Demo UI: http://localhost:3000/demo-ui/"
Write-Host "Press Ctrl+C to stop API"
Write-Host ""

pnpm dev:api
