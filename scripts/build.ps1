# Build ClipboardFilter
Write-Host ""
Write-Host "========================================"
Write-Host "  Building ClipboardFilter"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Clean
if (Test-Path "dist") {
    Write-Host "Cleaning dist folder..." -ForegroundColor Yellow
    Remove-Item "dist" -Recurse -Force
}

# Build TypeScript and copy the renderer files
Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ Build complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
