# Quotes -- setup.ps1
# One-liner bootstrap for Windows 11 / Node v18+.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host ">> $msg" -ForegroundColor DarkYellow }
function Ok($msg)   { Write-Host "   $msg" -ForegroundColor DarkGreen }
function Warn($msg) { Write-Host "   $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "   $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "Quotes -- setup" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

# 1. Node check ---------------------------------------------------------------
Step "Checking Node.js"
try {
    $nodeVersion = (node --version).TrimStart('v')
    $major = [int]($nodeVersion.Split('.')[0])
    if ($major -lt 18) {
        Warn "Node $nodeVersion detected. Electron 32 wants Node 18+. Upgrade recommended."
    } else {
        Ok "Node v$nodeVersion"
    }
} catch {
    throw "Node.js not found on PATH. Install from https://nodejs.org/ (v20 LTS or v24) and re-run."
}

# 2. Install deps -------------------------------------------------------------
Step "Installing npm dependencies (this can take a minute on first run)"
npm install --no-audit --no-fund | Out-Host

# Verify Electron actually landed -- npm can exit 0 even when a postinstall
# script fails (Electron downloads a prebuilt binary in a postinstall step).
$electronBin = Join-Path $PSScriptRoot 'node_modules\.bin\electron.cmd'
if (-not (Test-Path $electronBin)) {
    Fail "Electron binary not found at node_modules\.bin\electron.cmd"
    Fail "npm install likely failed silently. Try:"
    Fail "    cd $PSScriptRoot"
    Fail "    npm install --no-audit --no-fund --verbose"
    throw "Setup aborted -- Electron is not installed."
}
Ok "Dependencies installed (Electron present)"

# 3. Seed data ----------------------------------------------------------------
Step "Seeding data directory"
$dataDir = Join-Path $PSScriptRoot 'data'
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

$quotesPath = Join-Path $dataDir 'quotes.json'
$seedPath   = Join-Path $dataDir 'quotes.seed.json'

if (-not (Test-Path $quotesPath)) {
    if (Test-Path $seedPath) {
        Copy-Item $seedPath $quotesPath
        Ok "Created data\quotes.json from seed"
    } else {
        Warn "No seed file found at $seedPath -- paste quotes via Settings."
    }
} else {
    Ok "data\quotes.json already present, leaving it alone"
}

$statePath = Join-Path $dataDir 'state.json'
if (-not (Test-Path $statePath)) {
    '{ "seen": [], "favorites": [], "deleted": [] }' | Set-Content -Path $statePath -Encoding UTF8
    Ok "Created data\state.json"
}

# 4. Done ---------------------------------------------------------------------
Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  npm run popup-preview    # see the transparent fade-in popup once"
Write-Host "  npm start                # run the app normally"
Write-Host "  npm run dev              # run with DevTools attached"
Write-Host ""
