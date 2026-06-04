#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$LogPath = Join-Path (Split-Path -Parent $PSScriptRoot) "artifacts/windows-enable-wsl-features.log"
Start-Transcript -Path $LogPath -Force | Out-Null

Write-Host "Enabling Windows features required for WSL2 and Docker Desktop..."

$features = @(
  "Microsoft-Windows-Subsystem-Linux",
  "VirtualMachinePlatform"
)

$restartNeeded = $false
foreach ($feature in $features) {
  Write-Host "Enabling $feature..."
  $result = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart
  if ($result.RestartNeeded) {
    $restartNeeded = $true
  }
}

Write-Host "Setting WSL default version to 2..."
wsl --set-default-version 2

Write-Host ""
if ($restartNeeded) {
  Write-Host "Done. Restart is required before WSL2, Docker, or Supabase can run."
} else {
  Write-Host "Done. No restart was reported."
}

Stop-Transcript | Out-Null
