param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutFile = "case-library-export.json"
)

$ErrorActionPreference = "Stop"
Write-Host "GET $BaseUrl/admin/cases/export -> $OutFile"
curl.exe -s "$BaseUrl/admin/cases/export" -o $OutFile
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "Exported to $OutFile"
