param([Parameter(Mandatory)][string]$Device)
$ErrorActionPreference = 'Stop'
$androidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$jbr = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'C:/Program Files/Android/Android Studio/jbr' }
$env:JAVA_HOME = $jbr
$env:Path = "$jbr/bin;$env:Path"
$buildTools = Join-Path $androidSdk 'build-tools/36.0.0'
$androidJar = Join-Path $androidSdk 'platforms/android-37.0/android.jar'
$keystore = (Resolve-Path "$PSScriptRoot/../../mobile/android/app/debug.keystore").Path
$build = New-Item -ItemType Directory -Path (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('Temp/pq-offline-build-'+[guid]::NewGuid()))
function Run([string]$tool, [string[]]$arguments) {
  & $tool @arguments
  if ($LASTEXITCODE -ne 0) { throw "$tool exited with $LASTEXITCODE" }
}
Push-Location -LiteralPath $build.FullName
try {
  Run 'javac' @('--release','8','-cp',$androidJar,'-d','.', "$PSScriptRoot/OfflineActivity.java")
  Run "$buildTools/d8.bat" @('--lib',$androidJar,'--output','.','com/physiquequest/offlineverification/OfflineActivity.class')
  Run "$buildTools/aapt2.exe" @('link','-I',$androidJar,'--manifest',"$PSScriptRoot/AndroidManifest.xml",'-o','stub.apk')
  Run 'jar' @('uf','stub.apk','classes.dex')
  Run "$buildTools/zipalign.exe" @('-f','4','stub.apk','aligned.apk')
  Run "$buildTools/apksigner.bat" @('sign','--ks',$keystore,'--ks-pass','pass:android','--out','test.apk','aligned.apk')
  Run 'adb' @('-s',$Device,'install','-r','test.apk')
} finally { Pop-Location }
