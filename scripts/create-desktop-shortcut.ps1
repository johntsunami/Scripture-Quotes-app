$projectRoot = 'C:\Users\jcnur\Code\quotes'
$desktop     = [Environment]::GetFolderPath('Desktop')
$shortcut    = Join-Path $desktop 'Scripture Quotes.lnk'
$target      = 'C:\Windows\System32\wscript.exe'
$launcher    = Join-Path $projectRoot 'scripts\start-quotes-hidden.vbs'
$icon        = Join-Path $projectRoot 'assets\tray-icon.png'

if (-not (Test-Path $launcher)) {
    Write-Host "ERROR: launcher not found at $launcher" -ForegroundColor Red
    exit 1
}

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($shortcut)
$lnk.TargetPath = $target
$lnk.Arguments = "`"$launcher`""
$lnk.WorkingDirectory = $projectRoot
$lnk.WindowStyle = 7
$lnk.Description = 'Launch Scripture Quotes'
if (Test-Path $icon) {
    $icoPath = Join-Path $projectRoot 'assets\quotes.ico'
    if (-not (Test-Path $icoPath)) {
        Add-Type -AssemblyName System.Drawing
        try {
            $bmp = [System.Drawing.Image]::FromFile($icon)
            $ico = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$bmp).GetHicon())
            $fs = [System.IO.File]::OpenWrite($icoPath)
            $ico.Save($fs)
            $fs.Close()
            $bmp.Dispose()
        } catch {
            Write-Host "  Could not convert PNG to ICO, using PNG directly" -ForegroundColor Yellow
        }
    }
    if (Test-Path $icoPath) {
        $lnk.IconLocation = $icoPath
    }
}
$lnk.Save()

Write-Host "Desktop shortcut created: $shortcut" -ForegroundColor Green
Write-Host "Double-click it any time to launch Scripture Quotes." -ForegroundColor Green
