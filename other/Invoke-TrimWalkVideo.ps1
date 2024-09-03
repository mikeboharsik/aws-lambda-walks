[CmdletBinding()]
Param(
	[string] $Route,
	[hashtable] $Videos,

	[string] $EndTime,

	[switch] $SkipTimestampConversion,
	[switch] $SkipCitiesPopulation,
	[switch] $SkipJson,

	[switch] $WhatIf
)

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
$pathToWalkRoutes = "$PSScriptRoot\..\..\..\walk-routes"
$metaArchiveDir = Resolve-Path "$pathToWalkRoutes\meta_archive"
$expectedTargetFilePath = "$metaArchiveDir\$clipYear\$clipMonth\$clipDay.json"

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

$dayWalks = Get-Content $dataPath | ConvertFrom-Json -Depth 10 -AsHashtable
[hashtable]$data = $daysWalks.Length -gt 1 ? $dayWalks[-1] : $dayWalks

if (!$data.route -and !$data.coords -and !$Route) {
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

if ($data.coords -and !$SkipCitiesPopulation) {
	$testPoints =	($data.coords[0].lat, $data.coords[0].lon),
		($data.coords[[int]($data.coords.Length / 4)].lat, $data.coords[[int]($data.coords.Length / 4)].lon),
		($data.coords[[int]($data.coords.Length / 4) * 2].lat, $data.coords[[int]($data.coords.Length / 4) * 2].lon),
		($data.coords[[int]($data.coords.Length / 4) * 3].lat, $data.coords[[int]($data.coords.Length / 4) * 3].lon),
		($data.coords[$data.coords.Length - 1].lat, $data.coords[$data.coords.Length - 1].lon)

	$results = [System.Collections.Generic.List[string[]]]@()

	$testPoints | ForEach-Object -ThrottleLimit 5 -Parallel {
			$lat, $lon = $_
			$url = "https://www.google.com/maps/place/$lat,$lon"
			try {
				$data = Invoke-RestMethod $url -Headers @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' }
					| Select-String '([\w ]+), (\w{2}) \d{5}'
					| Select-Object -ExpandProperty matches
					| Select-Object -ExpandProperty groups
					| Select-Object -Skip 1 -ExpandProperty Value
					| ForEach-Object { $_.Trim() }
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
			$city, $state = $result
			if (!$data.towns[$state]) {
				$data.towns[$state] = @($city)
			} else {
				if (!$data.towns[$state].Contains($city)) {
					$data.towns[$state] += $city
				}
			}
		}
	}

	$newTowns = @{}
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
Move-Item $outputName "$dateDir\$($dateStr)_trimmed.mp4" -Force
Copy-Item "$clipsDir\template.blend" "$dateDir\$dateStr.blend"

if (!$SkipJson) {
	$dayWalks | ConvertTo-Json -Depth 10 -AsArray | Set-Content $expectedTargetFilePath

	if ($SkipTimestampConversion) {
		Write-Host "Skipping timestamp conversion"
	} else {
		& "$PSScriptRoot\..\Invoke-ConvertRawWalkTimestamps.ps1" -Date $dateStr
	}
}

if (Test-Path "$PSScriptRoot\thumbnail\Invoke-GenerateThumbnail.ps1") {
	& "$PSScriptRoot\thumbnail\Invoke-GenerateThumbnail.ps1" -Date $dateStr
} else {
	& "$PSScriptRoot\..\thumbnail\Invoke-GenerateThumbnail.ps1" -Date $dateStr
}
