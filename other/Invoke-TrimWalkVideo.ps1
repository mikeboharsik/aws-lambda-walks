[CmdletBinding()]
Param(
	[Parameter(Mandatory=$false)]
	[string] $Route = $null,
	[hashtable] $Videos,

	[string] $EndTime,

	[switch] $SkipTimestampConversion,
	[switch] $SkipCitiesPopulation,
	[switch] $SkipJson,
	[switch] $AssumeVideoCreated,

	[string] $PathToWalkRoutes = "$PSScriptRoot\..\..\..\walk-routes",

	[switch] $WhatIf
)

$ErrorActionPreference = 'Stop'

[System.IO.FileSystemInfo[]]$items = Get-ChildItem -File "*_merged.mp4"
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

$clipYear, $clipMonth, $clipDay = $dateStr -Split '-'
$metaArchiveDir = Resolve-Path "$PathToWalkRoutes\meta_archive"
$expectedTargetFilePath = "$metaArchiveDir\$clipYear\$clipMonth\$clipDay.json"

$possibleDataPaths = @($expectedTargetFilePath)

foreach ($path in $possibleDataPaths) {
	if (Test-Path $path) {
		$dataPath = Resolve-Path $path
		break
	}
}

if (!$dataPath) {
	$expectedRemote = "personalgdrive:/Walk Uploads/$($dateStr)_1.json"
	$expectedLocal = "C:\Users\mboha\Documents\GitHub\walk-routes\meta_archive\$clipYear\$clipMonth\$clipDay.json"

	Write-Host "Attempting data load from Drive [$expectedRemote]"

	rclone copyto $expectedRemote $expectedLocal

	$dataPath = Resolve-Path $expectedLocal
}

if (!$dataPath) {
	Write-Error "Failed to find data path in possible paths [$($possibleDataPaths -Join ', ')] and failed to load from Drive"
	exit 1
}

$dayWalks = Get-Content $dataPath | ConvertFrom-Json -Depth 10 -AsHashtable
Write-Verbose ($dayWalks | ConvertTo-Json -Depth 10)
[hashtable]$data = $dayWalks.Length -gt 1 ? $dayWalks[-1] : $dayWalks

if ($Route) {
	$data.route = $Route
}
$Route = $data.route

if ($Videos) {
	$data.videos = $Videos
}

if ($data.coords -and !$SkipCitiesPopulation) {
	$testPoints =	($data.coords[0].lat, $data.coords[0].lon),
		($data.coords[[int]($data.coords.Length / 4)].lat, $data.coords[[int]($data.coords.Length / 4)].lon),
		($data.coords[[int]($data.coords.Length / 4) * 2].lat, $data.coords[[int]($data.coords.Length / 4) * 2].lon),
		($data.coords[[int]($data.coords.Length / 4) * 3].lat, $data.coords[[int]($data.coords.Length / 4) * 3].lon),
		($data.coords[$data.coords.Length - 1].lat, $data.coords[$data.coords.Length - 1].lon)

	$results = [System.Collections.Generic.List[PSCustomObject]]::new()

	$testPoints | ForEach-Object -ThrottleLimit 5 -Parallel {
			$lat, $lon = $_
			try {
				$scriptPath = "$($using:PSScriptRoot)/Get-DataForGpsCoordinate.ps1"
				if (!(Test-Path $scriptPath)) {
					$scriptPath = Resolve-Path "$($using:PSScriptRoot)/../Get-DataForGpsCoordinate.ps1"
				}

				$data = & $scriptPath -Coordinate "$lat,$lon"
			} catch {
				Write-Error $_.Exception
				exit 1
			}

			($using:results).Add($data)
		}

	Write-Verbose "Cities results: $($results | ConvertTo-Json)"

	if (!$data.towns) {
		$data.towns = @{}
	}

	foreach ($result in $results) {
		if ($result) {
			$null, $stateIso = $result.address.'ISO3166-2-lvl4' -Split "-"

			if (!$stateIso) { continue }

			$town = $result.address.town
			if (!$data.towns[$stateIso]) {
				$data.towns[$stateIso] = @($town)
			} else {
				if (!$data.towns[$stateIso].Contains($town)) {
					$data.towns[$stateIso] += $town
				}
			}
		}
	}

	$newTowns = [ordered]@{}
	foreach ($stateName in $data.towns.Keys) {
		[string[]]$newTowns[$stateName] = $data.towns[$stateName] | Sort-Object
	}
	$data.towns = $newTowns
}

$outputName = "$($dateStr)_trimmed.mp4"

$exifPath = (Get-ChildItem './*exif.json')[0]

if ($exifPath) {
	$exif = Get-Content $exifPath | ConvertFrom-Json -Depth 10

	foreach ($section in $exif) {
		if ($section.Duration -Match "(\d{1,2})\.(\d{2}) s") {
			$section.Duration = "00:00:$($Matches[1]).$($Matches[2])"
		}

		$section.Duration = ([TimeSpan]$section.Duration).ToString() -Replace '(\d{3})\d{3,}','$1'
	}

	$data.exif = $exif
} else {
	Write-Host 'Missing exif.json'
}

if (!$EndTime) {
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

	Write-Host "Start: $($data.startMark)"
	try {
		$adjustedEnd = ([TimeSpan]$data.endMark - $totalGap).ToString().Substring(0, 12)
	} catch {
		$adjustedEnd = $data.endMark
	}
} else {
	$adjustedEnd = $EndTime
}

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
	foreach ($walk in $dayWalks) {
		$walk.coords = "<truncated $($walk.coords.Length) elements>"
	}
	Write-Host "Generated JSON:`n$($dayWalks | ConvertTo-Json -Depth 10 -AsArray)"
	Write-Host "Output name: $outputName"

	exit 0
} else {
	if ($AssumeVideoCreated) {
		Write-Host "`$AssumeVideoCreated = $AssumeVideoCreated, skipping ffmpeg"
	} else {
		ffmpeg @ffmpegArgs

		if (!$?) {
			exit 1
		}
	}
}

if (!$AssumeVideoCreated) {
	$clipsDir = Resolve-Path "..\clips"
	$outputDir = "$clipsDir\output"
	if (!(Test-Path $outputDir)) {
		New-Item -ItemType Directory -Path $outputDir
	}
	Move-Item $outputName "$outputDir\$($dateStr)_trimmed.mp4" -Force
	Copy-Item "$clipsDir\template.blend" "$outputDir\$dateStr.blend"
}

if (!$SkipJson) {
	$dayWalks | ConvertTo-Json -Depth 10 -AsArray | Set-Content $expectedTargetFilePath

	if ($SkipTimestampConversion) {
		Write-Host "Skipping timestamp conversion"
	} else {
		& "$PSScriptRoot\..\Invoke-ConvertRawWalkTimestamps.ps1" -Date $dateStr
	}
}

$getMapScreenshotPath = "$PSScriptRoot\thumbnail\getMapScreenshot.js" -Replace '\\pathable',''
for ($i = 0; $i -lt $dayWalks.Length; $i++) {
	node $getMapScreenshotPath $dateStr $i
}
