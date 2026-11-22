param([string]$Root = (Split-Path $PSScriptRoot -Parent), [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
# Accepted patches only. 0010 and all DRAFT experiments are deliberately excluded.
# This series targets the captured workspace baseline; it is not a clean-HEAD release.
$series = @(
 '0009-generic-counter-candidate.patch','0011-subject-selection-scenarios.patch',
 '0012-timing-rejection.patch','0013-tracking-availability-wording.patch','0014-camera-exercise-lifecycle.patch',
 '0015-camera-recovery-state.patch','0016-browser-recovery.patch','0017-native-recovery.patch',
 '0018-host-message-recovery.patch','0019-recovery-integration-tests.patch','0020-a3-evidence-and-apply.patch'
)
$Root = [IO.Path]::GetFullPath($Root)
$probe = Join-Path ([IO.Path]::GetTempPath()) ('pq-patch-probe-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $probe | Out-Null
$applied = @{}
function Apply-Patch([string]$At, [string]$Patch, [string[]]$Flags) {
 Push-Location $At
 $previousAction=$ErrorActionPreference
 try { $ErrorActionPreference='Continue'; & git apply @Flags -- $Patch 2>$null; return ($LASTEXITCODE -eq 0) }
 finally { $ErrorActionPreference=$previousAction; Pop-Location }
}
try {
 # Inspect in a disposable file copy: reversing newer patches exposes older
 # applied patches even when later changes overlap their context.
 $paths = @{}
 foreach ($name in $series) {
   $patch = Join-Path $PSScriptRoot $name
   if (!(Test-Path -LiteralPath $patch)) { throw "Missing patch: $name" }
   foreach ($line in Get-Content -LiteralPath $patch) {
     if ($line -match '^(?:\+\+\+ b/|--- a/)(.+)$') { $paths[$Matches[1]] = $true }
   }
 }
 foreach ($relative in $paths.Keys) {
   if ($relative -match '(^[/\\]|(^|[/\\])\.\.([/\\]|$)|:)') { throw "Unsafe patch path: $relative" }
   $source=Join-Path $Root $relative
   if (Test-Path -LiteralPath $source) {
     $target=Join-Path $probe $relative
     New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
     Copy-Item -LiteralPath $source -Destination $target
   }
 }
 for ($i=$series.Count-1; $i -ge 0; $i--) {
   $name=$series[$i]; $patch=Join-Path $PSScriptRoot $name
   if (Apply-Patch $probe $patch @('--reverse','--check')) {
     if (!(Apply-Patch $probe $patch @('--reverse'))) { throw "Could not inspect $name" }
     $applied[$name]=$true
   }
 }
 foreach ($name in $series) {
   $patch=Join-Path $PSScriptRoot $name
   if (!(Apply-Patch $probe $patch @('--check'))) { throw "Series conflict at $name; source tree unchanged." }
   if (!(Apply-Patch $probe $patch @())) { throw "Could not stage $name; source tree unchanged." }
 }
 if ($CheckOnly) { Write-Output 'Accepted patch series checks passed.'; return }
 foreach ($name in $series) {
   if ($applied.ContainsKey($name)) { Write-Output "Already applied: $name"; continue }
   $patch=Join-Path $PSScriptRoot $name
   if (!(Apply-Patch $Root $patch @('--check'))) { throw "Workspace changed before $name; stopped." }
   if (!(Apply-Patch $Root $patch @())) { throw "Failed to apply $name" }
   Write-Output "Applied: $name"
 }
} finally {
 $resolved=[IO.Path]::GetFullPath($probe)
 $temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if ($resolved.StartsWith($temporary,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolved) -like 'pq-patch-probe-*') {
   Remove-Item -LiteralPath $resolved -Recurse -Force
 }
}
