$ErrorActionPreference = 'Stop'

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
  throw 'npm was not found on PATH.'
}

$registry = $env:npm_config_registry
if ([string]::IsNullOrWhiteSpace($registry)) {
  $registry = 'https://registry.npmmirror.com'
}

$electronMirror = $env:ELECTRON_MIRROR
if ([string]::IsNullOrWhiteSpace($electronMirror)) {
  $electronMirror = 'https://npmmirror.com/mirrors/electron/'
}

$env:npm_config_registry = $registry
$env:ELECTRON_MIRROR = $electronMirror
$env:npm_config_electron_mirror = $electronMirror

Write-Host 'Installing TokenUsage desktop widget runtime...'
Write-Host "npm registry: $registry"
Write-Host "Electron mirror: $electronMirror"
Write-Host ''

& $npm.Source install --no-save --package-lock=false electron@^41.5.0
exit $LASTEXITCODE
