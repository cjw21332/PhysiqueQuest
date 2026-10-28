$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot '.env'
$line = Get-Content -LiteralPath $configPath | Where-Object { $_ -match '^POSE_ANALYSIS_API_KEY=' } | Select-Object -First 1
if (-not $line) { throw 'Set POSE_ANALYSIS_API_KEY in pose-service/.env first.' }
$env:POSE_ANALYSIS_API_KEY = $line.Substring('POSE_ANALYSIS_API_KEY='.Length)
if ($env:POSE_ANALYSIS_API_KEY.Length -lt 32) { throw 'The pose service key must be at least 32 characters.' }
Push-Location $PSScriptRoot
try { & (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log }
finally { Pop-Location; Remove-Item Env:POSE_ANALYSIS_API_KEY -ErrorAction SilentlyContinue }
