# 本地原图 OCR（法务内测）— 绕过浏览器，直读文件 + Google Vision
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ImagePath,
  [string]$Category = 'sa.rice_cooker',
  [string]$Country = 'SG',
  [switch]$Review,
  [string]$Out
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path $ImagePath)) {
  Write-Error "文件不存在: $ImagePath"
}

$args = @("$PSScriptRoot\ocr-local-file.mjs", (Resolve-Path $ImagePath).Path, '--category', $Category, '--country', $Country)
if ($Review) { $args += '--review' }
if ($Out) { $args += '--out'; $args += $Out }

node @args
