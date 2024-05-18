Param(
	[string] $Route,
	[hashtable] $Videos,

	[switch] $SkipTimestampConversion,
	[switch] $SkipCitiesPopulation,
	[switch] $SkipJson,

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

if ($items[0].Name -Match '(\d{4})-(\d{2})-(\d{2})') {
	$dateStr = $Matches[0]
} else {
	Write-Error "Failed to match date from filename [$($items[0].Name)]"
	exit 1
}

$clipYear, $clipMonth, $clipDate = $dateStr -Split '-'
$pathToWalkRoutes = "$PSScriptRoot\..\..\..\walk-routes"
$metaArchiveDir = Resolve-Path "$pathToWalkRoutes\meta_archive"
$expectedTargetFilePath = "$metaArchiveDir\$clipYear\$clipMonth\$dateStr.json"

$possibleDataPaths = @($expectedTargetFilePath)

foreach ($path in $possibleDataPaths) {
	if (Test-Path $path) {
		$dataPath = Resolve-Path $path
		break
	}
}

if (!$dataPath) {
	Write-Error "Failed to find data path in possible paths [$($possibleDataPaths -Join ', ')]"
	exit 1
}

$data = Get-Content $dataPath | ConvertFrom-Json -AsHashtable -Depth 10

if (!$data.route -and !$Route) {
	$Route = Read-Host 'Route'
	if ($Route.ToUpper() -eq 'NEW') {
		$Route = [System.Guid]::NewGuid().ToString().ToUpper()
	}
	$data.route = $Route
}
if ($Route) {
	$data.route = $Route
}
$Route = $data.route

if (!$data.videos -and !$Videos) {
	$Videos = @{}
	do {
		$VidId = Read-Host "Video ID"
		if (!$VidId) { break }

		$VidTimeCode = Read-Host "  Video Timecode"
		$WalkTimeCode = Read-Host "  Walk Timecode"
		if (!$VidTimeCode -and !$WalkTimeCode) {
			$Videos[$VidId] = $null
		} else {
			$Videos[$VidId] = @($VidTimeCode, $WalkTimeCode)
		}
	} while ($VidId)

	if (!$Videos.Keys.Length) {
		$Videos = $null
	}
}
if ($Videos) {
	$data.videos = $Videos
}

if (!$SkipCitiesPopulation) {
	try {
		$citiesScriptPath = Resolve-Path "$PSScriptRoot\..\..\..\walk-routes\utility\getCitiesForRoute.js" -ErrorAction Stop
		$data.towns = @{ MA = [string[]](ConvertFrom-Json (& node $citiesScriptPath $Route)) }
	} catch {
		$data.towns = @{ MA = [string[]]@() }
	}
}

if (Test-Path 'exif.json') {
	$exif = Get-Content 'exif.json' | ConvertFrom-Json -Depth 10

	foreach ($section in $exif) {
		if ($section.Duration -Match "(\d{2})\.(\d{2}) s") {
			$section.Duration = "00:00:$($Matches[1]).$($Matches[2])"
		}

		$section.Duration = ([TimeSpan]$section.Duration).ToString() -Replace '(\d{3})\d{3,}','$1'
	}

	$data.exif = $exif
} else {
	Write-Host 'Missing exif.json'
}

$json = ConvertTo-Json $data -Depth 10

$outputName = "$($dateStr)_trimmed.mp4"

$totalGap = [TimeSpan]"00:00:00"
$data.exif | ForEach-Object { $i = 0 } {
	if ($i -gt 0) {
		$last = $data.exif[$i-1]
		$created = [DateTime]($_.CreateDate -Replace "(\d{4}):(\d{2}):(\d{2})",'$1-$2-$3')
		$lastCreated = [DateTime]($last.CreateDate -Replace "(\d{4}):(\d{2}):(\d{2})",'$1-$2-$3')
		$lastDuration = [TimeSpan]$last.Duration

		$gap = $created - ($lastCreated + $lastDuration)
		$totalGap += $gap
	}
	$i++
}
Write-Host "`Total gap between segments = $totalGap"
if ($totalGap -lt [TimeSpan]"00:00:00") {
	$totalGap = [TimeSpan]"00:00:00"
}

Write-Host "Unadjusted end: $($data.endMark)"
$adjustedEnd = ([TimeSpan]$data.endMark - $totalGap).ToString().Substring(0, 12)
Write-Host "Adjusted end: $adjustedEnd"

$ffmpegArgs = @(
	'-ss', $data.startMark
	'-to', $adjustedEnd
	'-i', $items[0].FullName
	'-c', 'copy'
	(Get-Location).Path + "\" + $outputName
	'-y'
)

Write-Host "ffmpeg arguments: [$ffmpegArgs]"

if ($WhatIf) {
	Write-Host "Generated JSON:`n$json"
	Write-Host "Output name: $outputName"

	exit 0
} else {
	ffmpeg @ffmpegArgs

	if (!$?) {
		exit 1
	}
}

$clipsDir = Resolve-Path "..\clips"
$dateDir = "$clipsDir\$dateStr"
if (!(Test-Path $dateDir)) {
	New-Item -ItemType Directory -Path $dateDir
}
Move-Item $outputName "$dateDir\$($dateStr)_trimmed.mp4"
Copy-Item "$clipsDir\template.blend" "$dateDir\$dateStr.blend"

if (!$SkipJson) {
	Set-Content $expectedTargetFilePath $json

	if ($SkipTimestampConversion) {
		Write-Host "Skipping timestamp conversion"
	} else {
		& "$PSScriptRoot\..\Invoke-ConvertRawWalkTimestamps.ps1" -Date $dateStr
	}
}