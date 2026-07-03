# Load key=value lines from .env into the current PowerShell session.
param(
  [string]$EnvFile = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
)

if (-not (Test-Path $EnvFile)) {
  Write-Error ".env not found at $EnvFile — copy .env.example and fill in Neon + Upstash URLs."
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$name" -Value $value
}
