# update-from-zip.ps1
# ===================================================================
# Smart update workflow: takes a fresh quotes.zip from Downloads and
# applies it to the project folder WITHOUT destroying .git/ or data/.
#
# Workflow per update:
#   1. Save this zip to C:\Users\jcnur\Downloads\quotes.zip
#   2. Run:
#      cd C:\Users\jcnur\Code\quotes
#      powershell -ExecutionPolicy Bypass -File .\scripts\update-from-zip.ps1
#
# What this does:
#   - Stops any running Quotes app process (no more "in use" errors)
#   - Extracts zip to a temp folder
#   - Copies the source files into your project (preserving .git/ and data/)
#   - Runs setup.ps1
#   - Shows you what changed
#   - Offers to commit + push to GitHub
#   - Offers to start the app
# ===================================================================

$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\jcnur\Code\quotes'
$zipPath     = 'C:\Users\jcnur\Downloads\quotes.zip'
$tempExtract = Join-Path $env:TEMP "quotes-update-$(Get-Random)"

# --- Sanity checks ---
if (-not (Test-Path $zipPath)) {
    Write-Host "ERROR: zip not found at $zipPath" -ForegroundColor Red
    Write-Host "Save the new zip there first, then re-run this script."
    exit 1
}

if (-not (Test-Path $projectRoot)) {
    Write-Host "ERROR: project folder not found at $projectRoot" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Scripture Quotes -- update from zip" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Stop the running Quotes app so its files aren't locked ---
Write-Host "Step 1: Stopping any running Quotes app..." -ForegroundColor Yellow

# The Electron app launches as electron.exe. We only want to kill OUR instance,
# not any unrelated Electron app the user might be running. Filter by path.
$running = Get-Process -Name 'electron' -ErrorAction SilentlyContinue |
           Where-Object { $_.Path -like "$projectRoot*" }
if ($running) {
    $running | ForEach-Object {
        Write-Host "  Stopping PID $($_.Id): $($_.Path)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force
    }
    Start-Sleep -Seconds 2  # give Windows a moment to release the file handles
    Write-Host "  Done." -ForegroundColor Green
} else {
    Write-Host "  No running instance found." -ForegroundColor Green
}

# --- Step 2: Extract zip to a temp folder ---
Write-Host ""
Write-Host "Step 2: Extracting zip to temp folder..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force
$extractedRoot = Join-Path $tempExtract 'quotes'
if (-not (Test-Path $extractedRoot)) {
    Write-Host "ERROR: zip did not contain expected 'quotes' folder" -ForegroundColor Red
    Remove-Item $tempExtract -Recurse -Force
    exit 1
}
Write-Host "  Extracted to $extractedRoot" -ForegroundColor Green

# --- Step 3: Copy source files into project (preserving .git/, data/, node_modules/) ---
Write-Host ""
Write-Host "Step 3: Copying source files into project..." -ForegroundColor Yellow
Write-Host "  Preserving: .git\, data\, node_modules\" -ForegroundColor Gray

# robocopy is the safe choice: handles deletions, preserves what we don't want touched
$excludeDirs = @('.git', 'data', 'node_modules')
$robocopyArgs = @(
    $extractedRoot,
    $projectRoot,
    '/MIR',                                 # mirror -- delete files in dest that aren't in src
    '/XD'                                   # exclude these directories
) + ($excludeDirs | ForEach-Object { Join-Path $projectRoot $_ }) + @(
    '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP'  # quiet output
)

robocopy @robocopyArgs | Out-Null

# robocopy uses non-zero exit codes for SUCCESS -- codes 0-7 are fine, 8+ are errors
if ($LASTEXITCODE -gt 7) {
    Write-Host "  robocopy reported errors (exit $LASTEXITCODE)" -ForegroundColor Red
    Remove-Item $tempExtract -Recurse -Force
    exit 1
}
Write-Host "  Done." -ForegroundColor Green

# Clean up temp folder
Remove-Item $tempExtract -Recurse -Force

# --- Step 4: Run setup.ps1 ---
Write-Host ""
Write-Host "Step 4: Running setup.ps1..." -ForegroundColor Yellow
Set-Location $projectRoot
powershell -ExecutionPolicy Bypass -File .\setup.ps1

# --- Step 5: Show what changed in Git ---
Write-Host ""
Write-Host "Step 5: Changes in Git working tree..." -ForegroundColor Yellow
if (Test-Path '.\.git') {
    git status --short
} else {
    Write-Host "  No .git folder found -- skipping Git steps." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Update complete. Run 'npm start' to launch the app." -ForegroundColor Green
    exit 0
}

# --- Step 6: Always push to GitHub ---
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "  No changes to commit." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
}

# --- Step 7: Always start the app (silently, no console window) ---
Write-Host ""
Write-Host "Starting the app..." -ForegroundColor Cyan
$launcher = Join-Path $projectRoot 'scripts\start-quotes-hidden.vbs'
Start-Process -FilePath 'wscript.exe' -ArgumentList "`"$launcher`""
Write-Host "  Launched. Look for the tray icon in your taskbar." -ForegroundColor Green

Write-Host ""
Write-Host "Update complete." -ForegroundColor Green
