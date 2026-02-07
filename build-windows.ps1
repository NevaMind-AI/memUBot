# Windows build script for memU bot
# Usage:
#   .\build-windows.ps1              # Build with default mode (memu)
#   .\build-windows.ps1 -Mode yumi   # Build with yumi mode

param(
    [string]$Mode = "memu"
)

Write-Host "Building Windows version (mode: $Mode)..." -ForegroundColor Green

# Set mirrors for Chinese network (avoid GitHub download timeouts)
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "Error: npm not found. Please install Node.js and add it to PATH." -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found npm: $($npmCmd.Source)" -ForegroundColor Green
Write-Host "Node.js version:" -ForegroundColor Cyan
node --version
Write-Host "npm version:" -ForegroundColor Cyan
npm --version

if (-not (Test-Path "node_modules")) {
    Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Dependency install failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "`nnode_modules exists, skipping install" -ForegroundColor Green
}

Write-Host "`nBuilding Windows package..." -ForegroundColor Green
$env:APP_MODE = $Mode
npm run build:win

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild succeeded! Output: dist\" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}
