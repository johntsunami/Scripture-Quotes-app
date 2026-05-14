# push-to-github.ps1
# ===================================================================
# After extracting a new zip from Claude, run this script to commit
# and push the changes to GitHub.
#
# Usage:
#   cd C:\Users\jcnur\Code\Scripture-Quotes-app
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
#
# It will:
#   1. Read the version from package.json
#   2. Show you what files changed
#   3. Ask for a commit message (suggesting one based on the version)
#   4. Commit + push to origin/main
#
# First-time setup needed BEFORE this works:
#   - Install Git for Windows from https://git-scm.com/
#   - Run: git config --global user.name  "Your Name"
#   - Run: git config --global user.email "you@example.com"
#   - In this project folder, run: git init
#   - Then: git remote add origin https://github.com/johntsunami/Scripture-Quotes-app.git
#   - Then: git branch -M main
# ===================================================================

$ErrorActionPreference = 'Stop'

# --- Sanity checks -------------------------------------------------
if (-not (Test-Path '.\package.json')) {
    Write-Host 'ERROR: package.json not found. Run this from the project root.' -ForegroundColor Red
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: Git is not installed. Download from https://git-scm.com/' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path '.\.git')) {
    Write-Host 'ERROR: This folder is not a Git repository.' -ForegroundColor Red
    Write-Host 'First-time setup steps:' -ForegroundColor Yellow
    Write-Host '  git init'
    Write-Host '  git remote add origin https://github.com/johntsunami/Scripture-Quotes-app.git'
    Write-Host '  git branch -M main'
    Write-Host 'Then re-run this script.'
    exit 1
}

# --- Read the version from package.json ----------------------------
$pkg = Get-Content '.\package.json' -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host ''
Write-Host "Project version: $version" -ForegroundColor Cyan

# --- Show what changed ---------------------------------------------
Write-Host ''
Write-Host '--- Changes since last commit ---' -ForegroundColor Yellow
git status --short
Write-Host ''

# Are there even any changes?
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host 'Nothing to commit. Working tree is clean.' -ForegroundColor Green
    exit 0
}

# --- Commit message --------------------------------------------------
$defaultMsg = "Release v$version"
Write-Host "Suggested commit message: $defaultMsg" -ForegroundColor Cyan
$msg = Read-Host 'Press Enter to accept, or type a custom message'
if ([string]::IsNullOrWhiteSpace($msg)) {
    $msg = $defaultMsg
}

# --- Stage, commit, push --------------------------------------------
Write-Host ''
Write-Host 'Staging files...' -ForegroundColor Cyan
git add -A

Write-Host 'Committing...' -ForegroundColor Cyan
git commit -m "$msg"

Write-Host ''
Write-Host 'Pushing to GitHub...' -ForegroundColor Cyan
git push origin main

Write-Host ''
Write-Host 'Done! Check your repo:' -ForegroundColor Green
Write-Host '  https://github.com/johntsunami/Scripture-Quotes-app' -ForegroundColor Green

# --- Optional: tag this release -------------------------------------
Write-Host ''
$tagAnswer = Read-Host "Tag this commit as v$version on GitHub? (y/N)"
if ($tagAnswer -eq 'y' -or $tagAnswer -eq 'Y') {
    git tag -a "v$version" -m "Release v$version"
    git push origin "v$version"
    Write-Host "Tagged as v$version." -ForegroundColor Green
}
