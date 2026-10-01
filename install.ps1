param([string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'))
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-manifest.json') -Raw | ConvertFrom-Json
if ($manifest.package -notmatch '^dsh-theme-whale-girl-[0-9]+\.[0-9]+\.[0-9]+\.tgz$') { throw 'Invalid package filename.' }
$packagePath = Join-Path $PSScriptRoot $manifest.package
if (!(Test-Path -LiteralPath $packagePath)) { throw 'Extract the entire release ZIP before installing.' }
if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Checksum mismatch. Download a fresh release ZIP.' }
$officialExe = Join-Path $InstallDirectory 'DeepSeek Harness.exe'
$officialCli = Join-Path $InstallDirectory 'resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js'
if (!(Test-Path -LiteralPath $officialExe)) { throw 'Official DSH Desktop was not found. Install it first, or specify -InstallDirectory.' }
if (Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue) { throw 'Fully exit DSH from the tray, then run this installer again.' }
$previousNodeMode = $env:ELECTRON_RUN_AS_NODE
$logBase = Join-Path ([IO.Path]::GetTempPath()) ('dsh-custom-theme-'+[guid]::NewGuid().ToString())
try {
  $env:ELECTRON_RUN_AS_NODE = '1'
  $process = Start-Process -FilePath $officialExe -ArgumentList @('--expose-internals', ('"'+$officialCli+'"'), 'plugin','--profile','desktop','add',('"'+$packagePath+'"')) -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput ($logBase+'.out.log') -RedirectStandardError ($logBase+'.err.log')
  Get-Content -LiteralPath ($logBase+'.out.log')
  Get-Content -LiteralPath ($logBase+'.err.log')
  if ($process.ExitCode -ne 0) { throw "Official plugin installer failed (exit $($process.ExitCode))." }
  Write-Host 'Installed! Reopen DSH and go to Settings > Custom Themes.'
  Write-Host 'Keep this folder. After moving it, rerun this installer. Your history is untouched.'
} finally {
  $env:ELECTRON_RUN_AS_NODE = $previousNodeMode
  foreach ($log in @(($logBase+'.out.log'),($logBase+'.err.log'))) { if (Test-Path -LiteralPath $log) { Remove-Item -LiteralPath $log } }
}
