' start-quotes-hidden.vbs
' Launches "npm start" with no visible console window.
' Used by the desktop shortcut and update-from-zip.ps1.

Set objShell = WScript.CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the directory containing this script and use it as the working dir
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
projectRoot = objFSO.GetParentFolderName(scriptDir)
objShell.CurrentDirectory = projectRoot

' Run npm start with window style 0 (hidden), don't wait for it to finish
objShell.Run "cmd /c npm start", 0, False
