# 法务内测版一键启动
# 依赖：.env 中已配置 DATABASE_URL + REDIS_URL（Neon + Upstash）
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== Ad Compliance Hub 法务内测版 ==="
Write-Host "文档: docs/legal-pilot/内测说明.md"
Write-Host "入口: http://localhost:3000/review/  (用户端)"
Write-Host "管理: http://localhost:3000/admin-ui/"
Write-Host ""

& "$PSScriptRoot\start-cloud-demo.ps1"
