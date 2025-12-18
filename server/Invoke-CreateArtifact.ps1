Param(
	[string] $EventsPath = "../walk-routes/events.json",
	[string] $GeneratedPath = "../walk-routes/generated/**"
)

Write-Host "Using arguments:`n"
	` "    `$EventsPath = [$EventsPath]"
	` "    `Get-Location = [$(Get-Location)]"

$ErrorActionPreference = 'Stop'

New-Item -Path "$PSScriptRoot/build" -ItemType Directory -Force | Out-Null

Copy-Item -Path @("$PSScriptRoot/src/**", "$PSScriptRoot/node_modules") -Recurse -Destination "$PSScriptRoot/build" -Force | Out-Null

Copy-Item -Path "$PSScriptRoot/../client/public" -Recurse -Destination "$PSScriptRoot/build/public" -Force | Out-Null

New-Item -Path "$PSScriptRoot/build/generated" -ItemType Directory -Force | Out-Null
Copy-Item -Recurse $GeneratedPath "$PSScriptRoot/build/generated"

Write-Host "Everything except node_modules:" (Get-ChildItem "$PSScriptRoot/build/**" -Recurse -File | Where-Object { $_.FullName -NotMatch "node_modules" } | ForEach-Object { $_.FullName } | ConvertTo-Json -Depth 10 -Compress)

Compress-Archive -Path "$PSScriptRoot/build/**" -DestinationPath "$PSScriptRoot/build/deployable.zip" -Force
