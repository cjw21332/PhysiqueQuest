$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root '.tools\phone-start'
$statePath = Join-Path $logDir 'state.json'
$tunnelExe = Join-Path $root '.tools\cloudflared.exe'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Listening([int]$Port) {
  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}
function Wait-Listening([string]$Name, [int]$Port) {
  $deadline = (Get-Date).AddSeconds(100)
  do {
    if (Test-Listening $Port) { return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "$Name did not start on port $Port. Check the logs in $logDir."
}
function Test-Ready([string]$Url) {
  try { if ((Invoke-RestMethod -Uri "$Url/ready" -TimeoutSec 8).status -eq 'ready') { return $true } } catch {}
  # A local DNS resolver can temporarily cache a negative answer for a newly
  # created tunnel. Verify the public route through Cloudflare DNS in that case.
  try {
    $hostname = ([uri]$Url).Host
    if ($hostname -notmatch '^[a-z0-9-]+\.trycloudflare\.com$') { return $false }
    $dns = Invoke-RestMethod -Uri "https://cloudflare-dns.com/dns-query?name=$hostname&type=A" -Headers @{ Accept = 'application/dns-json' } -TimeoutSec 8
    $ip = $dns.Answer | Where-Object { $_.type -eq 1 -and $_.data -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1 -ExpandProperty data
    if (-not $ip) { return $false }
    $reply = & curl.exe --silent --show-error --noproxy '*' --max-time 8 --resolve "${hostname}:443:${ip}" "$Url/ready" 2>$null
    return ($LASTEXITCODE -eq 0 -and ($reply | ConvertFrom-Json).status -eq 'ready')
  } catch { return $false }
}
function Show-Address([string]$Url) {
  Write-Host "`nPhysiqueQuest is ready. Enter this address in the phone app:"
  Write-Host $Url
  Write-Host 'You can use another Wi-Fi network or mobile data. Keep this computer and its internet connection running.'
  Write-Host 'Run the same command again to check or restart these services. A new temporary address may be issued after a restart.'
}
$tunnel = $null; $backend = $null; $coach = $null; $web = $null
function Save-State([string]$Url) {
  $state = @{ url = $Url }
  foreach ($entry in @(@('tunnel', $tunnel), @('backend', $backend), @('coach', $coach), @('web', $web))) {
    if ($entry[1]) {
      $state["$($entry[0])Pid"] = $entry[1].Id
      $state["$($entry[0])Started"] = $entry[1].StartTime.ToUniversalTime().Ticks.ToString()
    }
  }
  $state | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
}

try {
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Node.js and npm are required.' }
  if (-not (Test-Path (Join-Path $root 'backend\.env'))) { throw 'backend\.env is missing. Restore the backend configuration first.' }
  if (-not (Test-Path $tunnelExe)) { throw "The public connection program is missing: $tunnelExe" }

  if (Test-Path $statePath) {
    try { $previous = Get-Content $statePath -Raw | ConvertFrom-Json } catch { $previous = $null }
    if ($previous -and $previous.url -match '^https://[a-z0-9-]+\.trycloudflare\.com$' -and
        (Get-Process -Id $previous.tunnelPid -ErrorAction SilentlyContinue) -and (Test-Ready $previous.url)) {
      foreach ($name in 'web', 'coach', 'backend', 'tunnel') {
        $existing = Get-Process -Id $previous."${name}Pid" -ErrorAction SilentlyContinue
        if ($existing -and -not $previous."${name}Started") {
          $previous | Add-Member -NotePropertyName "${name}Started" -NotePropertyValue $existing.StartTime.ToUniversalTime().Ticks.ToString() -Force
        }
      }
      $previous | ConvertTo-Json | Set-Content -Path $statePath -Encoding UTF8
      Show-Address $previous.url
      exit 0
    }
    if ($previous) {
      foreach ($name in 'web', 'coach', 'backend', 'tunnel') {
        $pidValue = $previous."${name}Pid"
        $started = $previous."${name}Started"
        if ($pidValue -and $started) {
          $owned = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
          if ($owned -and $owned.StartTime.ToUniversalTime().Ticks.ToString() -eq $started) {
            Stop-Process -Id $owned.Id -ErrorAction SilentlyContinue
          }
        }
      }
    }
  }
  foreach ($port in 3200, 4200, 4250) {
    if (Test-Listening $port) { throw "Port $port is already in use. An existing service must be stopped or the previous PhysiqueQuest phone session recovered before starting another." }
  }
  if (-not (Test-Listening 27017)) {
    $mongo = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if (-not $mongo) { throw 'MongoDB is not listening and its Windows service was not found.' }
    try { Start-Service -Name MongoDB } catch { throw 'MongoDB could not be started. Start the MongoDB Windows service, then run this command again.' }
    Wait-Listening 'MongoDB' 27017
  }
  Write-Host 'Database is listening. Preparing backend...'
  Push-Location (Join-Path $root 'backend')
  try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' } } finally { Pop-Location }

  $tunnelOut = Join-Path $logDir 'tunnel.out.log'
  $tunnelErr = Join-Path $logDir 'tunnel.err.log'
  $tunnel = Start-Process -FilePath $tunnelExe -ArgumentList 'tunnel --url http://127.0.0.1:3200 --no-autoupdate' `
    -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
  $deadline = (Get-Date).AddSeconds(60)
  $url = $null
  do {
    $log = if (Test-Path $tunnelErr) { Get-Content $tunnelErr -Raw -ErrorAction SilentlyContinue } else { '' }
    if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0]; break }
    if ($tunnel.HasExited) { throw "The public connection stopped. Check $tunnelErr." }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if (-not $url) { throw "The public address was not created. Check $tunnelErr." }
  Save-State $url

  $env:NODE_ENV = 'development'
  $env:CORS_ALLOWED_ORIGINS = $url
  $env:FRONTEND_URL = $url
  $env:COACH_FRONTEND_URL = $url
  $env:COOKIE_SECURE = 'true'
  $env:COOKIE_SAMESITE = 'lax'
  $env:TRUST_PROXY = '2'
  $env:POSETRACKER_ENABLED = 'true'
  $env:PORT = '4200'
  $backend = Start-Process -FilePath 'node.exe' -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'backend.out.log') -RedirectStandardError (Join-Path $logDir 'backend.err.log') -PassThru
  Save-State $url
  $env:COACH_PORT = '4250'
  $coach = Start-Process -FilePath 'node.exe' -ArgumentList 'dist/coach-main.js' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'coach.out.log') -RedirectStandardError (Join-Path $logDir 'coach.err.log') -PassThru
  Save-State $url
  Wait-Listening 'Backend' 4200
  Wait-Listening 'Coach' 4250
  $env:BACKEND_URL = 'http://127.0.0.1:4200'
  $env:COACH_BACKEND_URL = 'http://127.0.0.1:4250'
  $env:DEV_ALLOWED_ORIGINS = ([uri]$url).Host
  $env:NEXT_DEV_DIST_DIR = '.next-phone'
  $next = Join-Path $root 'node_modules\next\dist\bin\next'
  $web = Start-Process -FilePath 'node.exe' -ArgumentList @("`"$next`"", 'dev', '--hostname', '127.0.0.1', '--port', '3200') `
    -WorkingDirectory (Join-Path $root 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'web.out.log') `
    -RedirectStandardError (Join-Path $logDir 'web.err.log') -PassThru
  Save-State $url
  Wait-Listening 'Web app' 3200
  $deadline = (Get-Date).AddSeconds(100)
  do {
    if (Test-Ready $url) { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if (-not (Test-Ready $url)) { throw "The public connection started, but the app is not ready. Check the logs in $logDir." }
  Save-State $url
  Show-Address $url
} catch {
  foreach ($process in @($web, $coach, $backend, $tunnel)) {
    if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
  }
  if ($tunnel -and (Test-Path $statePath)) { Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue }
  Write-Error $_
  exit 1
}
