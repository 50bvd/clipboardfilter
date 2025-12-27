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

# Build TypeScript
Write-Host "Building TypeScript..." -ForegroundColor Yellow
npx tsc

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Copy files
Write-Host "Copying files..." -ForegroundColor Yellow
Copy-Item "src/renderer.html" "dist/"
Copy-Item "src/renderer.js" "dist/"
Copy-Item "src/styles.css" "dist/"
Copy-Item "default-filters.json" "dist/"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ Build complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
