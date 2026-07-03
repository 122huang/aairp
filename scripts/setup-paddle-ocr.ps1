# Install Python (user scope) + PaddleOCR venv for AAIRP local OCR
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$venvPython = Join-Path $Root ".venv-paddle\Scripts\python.exe"
if (Test-Path $venvPython) {
  Write-Host "PaddleOCR venv already exists: $venvPython"
  & $venvPython -c "from paddleocr import PaddleOCR; print('PaddleOCR OK')"
  exit 0
}

Write-Host "Installing Python 3.12 (user scope) if needed..."
winget install Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements 2>$null

$py = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
if (-not (Test-Path $py)) {
  Write-Error "Python not found at $py"
}

Write-Host "Creating venv .venv-paddle ..."
& $py -m venv .venv-paddle
& $venvPython -m pip install --upgrade pip
& .\.venv-paddle\Scripts\pip.exe install paddlepaddle paddleocr pillow numpy

Write-Host ""
Write-Host "Done. Test with:"
Write-Host "  .\scripts\paddle-ocr.ps1 `"path\to\image.jpg`""
