Param(
	[switch] $WhatIf
)

[System.IO.FileSystemInfo[]]$items = Get-ChildItem -File "*.mp4"

if ($items.Length -gt 1) {
	Write-Error "More than 1 items found in directory, halting execution"
	exit 1
}

if ($items[0].Name -NotMatch '.*.mp4') {
	Write-Error "Failed to find expected file in directory, halting execution"
	exit 1
}

if ($items[0].Name -Match '\d{4}-\d{2}-\d{2}') {
	$dateStr = $Matches[0]
} else {
	Write-Error "Failed to match date from filename [$($items[0].Name)]"
	exit 1
}

$data = @{
	date = $dateStr
	end = $End
	start = $Start
	towns = $Towns
	route = $Route
	videos = $Videos
	events = @()
}

if (Test-Path 'exif.json') {
	$exif = Get-Content 'exif.json' | ConvertFrom-Json -Depth 10
	$data.exif = $exif
} else {
	Write-Host 'Missing exif.json'
}

$eventsQuery = Get-ChildItem -File './events*.json'
if ($eventsQuery.Length -gt 0) {
	$eventsParsed = Get-Content $eventsQuery[0] | ConvertFrom-Json
	$data.events = $eventsParsed
}

$json = ConvertTo-Json $data -Compress

$encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))

if ($OnlyOutputBase64) {
	Write-Host "Encoded data = [$encoded]"
	return
}

$outputName = "$($dateStr)_trimmed.mp4"

$ffmpegArgs = @(
	'-ss', $Start
	'-to', $End
	'-i', $items[0].FullName
	'-c', 'copy'
	(Get-Location).Path + "\" + $outputName
	'-y'
)

Write-Host "ffmpeg arguments: [$ffmpegArgs]"

if (!$WhatIf) {
	ffmpeg @ffmpegArgs
}

if (!$SkipVideoLaunch) {
	Start-Process $outputName
}

$clipsDir = Resolve-Path "..\clips"
$dateDir = "$clipsDir\$dateStr"
New-Item -ItemType Directory -Path $dateDir
Move-Item $outputName "$dateDir\$($dateStr)_trimmed.mp4"
Copy-Item "$clipsDir\template.blend" "$dateDir\$dateStr.blend"

$clipYear, $clipMonth, $clipDate = $dateStr -Split '-'
$pathToWalkRoutes = "$PSScriptRoot\..\..\..\walk-routes"
$metaArchiveDir = Resolve-Path "$pathToWalkRoutes\meta_archive"

if (!(Test-Path "$metaArchiveDir\$clipYear")) {
	New-Item -ItemType Directory -Path "$metaArchiveDir\$clipYear"
}

if (!(Test-Path "$metaArchiveDir\$clipYear\$clipMonth")) {
	New-Item -ItemType Directory -Path "$metaArchiveDir\$clipYear\$clipMonth"
}

Set-Content "$metaArchiveDir\$clipYear\$clipMonth\$dateStr.json" (ConvertTo-Json -Depth 10 $data)

if ($data.events.Length -gt 0) {
	& "$Repos\aws-lambda-walks\other\Invoke-ConvertRawWalkTimestamps.ps1" -Date $dateStr
}