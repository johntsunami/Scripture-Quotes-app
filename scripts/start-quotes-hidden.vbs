' start-quotes-hidden.vbs
' Launches the Electron app with no visible console window.
' Calls electron.exe directly instead of going through npm/cmd,
' which eliminates the brief cmd flash on launch.

Set objShell = WScript.CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
projectRoot = objFSO.GetParentFolderName(scriptDir)
objShell.CurrentDirectory = projectRoot

electronExe = projectRoot & "\node_modules\electron\dist\electron.exe"

If Not objFSO.FileExists(electronExe) Then
    ' Electron not installed yet, fall back (briefly shows cmd)
    objShell.Run "cmd /c npm start", 0, False
Else
    ' Run electron directly, window-style 0 (hidden, no console)
    objShell.Run """" & electronExe & """ """ & projectRoot & """", 0, False
End If
