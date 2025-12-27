# Package ClipboardFilter for distribution
param(
    [string]$Platform = "win32",
    [string]$Arch = "x64"
)

Write-Host ""
Write-Host "========================================"
Write-Host "  Packaging ClipboardFilter"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build first
Write-Host "Building..." -ForegroundColor Yellow
& .\scripts\build.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Package with electron-builder
Write-Host ""
Write-Host "Packaging for $Platform-$Arch..." -ForegroundColor Yellow

npx electron-builder --$Platform --$Arch

if ($LASTEXITCODE -ne 0) {
    Write-Host "Packaging failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ Package complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check release/ folder for installer" -ForegroundColor Yellow
Write-Host ""
