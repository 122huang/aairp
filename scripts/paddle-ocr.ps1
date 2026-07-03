param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ImagePath
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $Root ".venv-paddle\Scripts\python.exe"
$script = Join-Path $Root "scripts\paddle_ocr_extract.py"

if (-not (Test-Path $py)) {
  Write-Error "PaddleOCR not installed. Run: .\scripts\setup-paddle-ocr.ps1"
}
if (-not (Test-Path $ImagePath)) {
  Write-Error "File not found: $ImagePath"
}

$env:FLAGS_use_mkldnn = '0'
$env:PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK = 'True'

Write-Host "PaddleOCR 识别中（长图可能需 2-5 分钟，首次会下载模型）..."
& $py $script (Resolve-Path $ImagePath).Path
