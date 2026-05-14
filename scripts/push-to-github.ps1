# push-to-github.ps1
# ===================================================================
# Commits and pushes the current state to GitHub.
# Auto-uses "Release vX.Y.Z" as the commit message and auto-tags.
# No interactive prompts.
#
# Run via:
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
# ===================================================================

$ErrorActionPreference = 'Stop'

# --- Sanity checks ---
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
    Write-Host 'First-time setup:' -ForegroundColor Yellow
    Write-Host '  git init'
    Write-Host '  git remote add origin https://github.com/johntsunami/Scripture-Quotes-app.git'
    Write-Host '  git branch -M main'
    exit 1
}

# --- Read version from package.json ---
$pkg = Get-Content '.\package.json' -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host ""
Write-Host "Project version: $version" -ForegroundColor Cyan

# --- Show changed files ---
Write-Host ""
Write-Host "Changes since last commit:" -ForegroundColor Yellow
git status --short
Write-Host ""

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Nothing to commit. Working tree is clean." -ForegroundColor Green
    Write-Host "Skipping commit/push but will still attempt to tag v$version if missing." -ForegroundColor Gray
} else {
    # --- Stage, commit, push (auto-use default message) ---
    $msg = "Release v$version"
    Write-Host "Commit message: $msg" -ForegroundColor Cyan

    Write-Host "Staging files..." -ForegroundColor Cyan
    git add -A

    Write-Host "Committing..." -ForegroundColor Cyan
    git commit -m "$msg"

    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    git push origin main

    Write-Host ""
    Write-Host "Push complete: https://github.com/johntsunami/Scripture-Quotes-app" -ForegroundColor Green
}

# --- Always tag this release (skip silently if tag already exists) ---
Write-Host ""
$existingTag = git tag -l "v$version"
if ($existingTag) {
    Write-Host "Tag v$version already exists, skipping tag step." -ForegroundColor Gray
} else {
    Write-Host "Tagging this commit as v$version..." -ForegroundColor Cyan
    git tag -a "v$version" -m "Release v$version"
    git push origin "v$version"
    Write-Host "Tagged as v$version." -ForegroundColor Green
}
