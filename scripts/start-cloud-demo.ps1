# One-click: load .env → fix Neon PK if needed → migrate → seed → start API
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

. "$PSScriptRoot\load-env.ps1"

Write-Host "DATABASE_URL host: $($env:DATABASE_URL -replace '^postgresql://[^@]+@([^/]+).*','$1')"
Write-Host "REDIS_URL host:    $($env:REDIS_URL -replace '^rediss?://[^@]+@([^:/]+).*','$1')"
$paddlePy = Join-Path $Root ".venv-paddle\Scripts\python.exe"
$paddleOn = (Test-Path $paddlePy) -and ($env:PADDLE_OCR_ENABLED -ne '0') -and ($env:OCR_PROVIDER -eq 'paddle' -or $env:PADDLE_OCR_ENABLED -eq '1')
if ($paddleOn) {
  Write-Host "OCR stage 1:     PaddleOCR local (.venv-paddle)"
} elseif (-not [string]::IsNullOrWhiteSpace($env:GOOGLE_VISION_API_KEY)) {
  Write-Host "OCR stage 1:     Google Vision configured"
} else {
  Write-Host "OCR stage 1:     browser Tesseract (run scripts/setup-paddle-ocr.ps1 for better CN OCR)" -ForegroundColor Yellow
}
if (-not [string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)) {
  $model = if ($env:OCR_LLM_MODEL) { $env:OCR_LLM_MODEL } else { 'deepseek-v4-flash (default)' }
  Write-Host "OCR stage 2 LLM: DeepSeek text cleanup · model $model (vision: Anthropic/OpenAI optional)"
} elseif (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_API_KEY)) {
  $model = if ($env:OCR_LLM_MODEL) { $env:OCR_LLM_MODEL } else { 'claude-3-5-sonnet-20241022 (default)' }
  Write-Host "OCR stage 2 LLM: Anthropic configured · model $model"
} elseif (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
  $model = if ($env:OCR_LLM_MODEL) { $env:OCR_LLM_MODEL } else { 'gpt-4o-mini (default)' }
  Write-Host "OCR stage 2 LLM: OpenAI configured · model $model"
} else {
  Write-Host "OCR stage 2 LLM: not configured — set DEEPSEEK_API_KEY (recommended)" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[1/4] Fix Neon migration PK (if needed)..."
node "$PSScriptRoot\fix-neon-db.mjs"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "[2/4] Database migrate..."
pnpm migrate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "[3/4] Seed RC1 demo cases..."
pnpm seed:rc1-cases
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "[4/4] Free port 3000 (if occupied)..."
function Stop-PortListener([int]$Port) {
  $stopped = @()
  try {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique |
      ForEach-Object {
        if ($_ -gt 0 -and $stopped -notcontains $_) {
          Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
          $stopped += $_
        }
      }
  } catch {
    netstat -ano | Select-String ":$Port\s+.*LISTENING" | ForEach-Object {
      $procId = ($_.ToString() -split '\s+')[-1]
      if ($procId -match '^\d+$' -and $stopped -notcontains [int]$procId) {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        $stopped += [int]$procId
      }
    }
  }
  if ($stopped.Count -gt 0) {
    Write-Host "Stopped process(es) on port ${Port}: $($stopped -join ', ')"
  }
}
Stop-PortListener -Port 3000
Start-Sleep -Seconds 2
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "WARN: port 3000 still in use — close the old API window or run:" -ForegroundColor Yellow
  Write-Host "  Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id `$_.OwningProcess -Force }" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Review UI: http://localhost:3000/review/"
Write-Host "Admin UI:  http://localhost:3000/admin-ui/"
Write-Host "Press Ctrl+C to stop API"
Write-Host ""

pnpm dev:api
