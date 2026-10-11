; Setup exe for ShareGo (Inno Setup 6). The release workflow runs:
;   iscc /DAppVersion=2.0.2 /DSourceDir=<flutter Release folder> windows\installer\ShareGo.iss
; It installs for the current user, so it needs no admin rights, and the app
; can run it silently to update itself.

#ifndef AppVersion
  #error Pass /DAppVersion=x.y.z
#endif
#ifndef SourceDir
  #error Pass /DSourceDir=<folder with ShareGo.exe>
#endif

[Setup]
AppId={{12A31F98-6178-4AEC-931C-080A632E3632}
AppName=ShareGo
AppVersion={#AppVersion}
AppVerName=ShareGo {#AppVersion}
AppPublisher=Mehdi Mamas
AppPublisherURL=https://github.com/MehdiMamas/ShareGo
AppSupportURL=https://github.com/MehdiMamas/ShareGo/issues
AppUpdatesURL=https://github.com/MehdiMamas/ShareGo/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\ShareGo
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=..\runner\resources\app_icon.ico
UninstallDisplayIcon={app}\ShareGo.exe
UninstallDisplayName=ShareGo
OutputDir=.
OutputBaseFilename=ShareGo-windows-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=privacy.txt
CloseApplications=yes
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "updatecheck"; Description: "Check for updates (asks GitHub at start and every 6 hours)"; GroupDescription: "Updates:"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\ShareGo"; Filename: "{app}\ShareGo.exe"
Name: "{autodesktop}\ShareGo"; Filename: "{app}\ShareGo.exe"; Tasks: desktopicon

[INI]
; read by ShareGo at start. a silent update keeps the earlier choice.
Filename: "{app}\ShareGo.ini"; Section: "updates"; Key: "check"; String: "true"; Tasks: updatecheck
Filename: "{app}\ShareGo.ini"; Section: "updates"; Key: "check"; String: "false"; Tasks: not updatecheck

[Run]
; no skipifsilent: after a silent update from inside the app, open it again
Filename: "{app}\ShareGo.exe"; Description: "{cm:LaunchProgram,ShareGo}"; Flags: nowait postinstall

[UninstallDelete]
Type: filesandordirs; Name: "{app}\data"
Type: files; Name: "{app}\ShareGo.ini"
