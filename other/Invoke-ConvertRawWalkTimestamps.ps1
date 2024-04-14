Param(
	[Parameter(Mandatory=$true)]
	[string] $Date,
	[hashtable] $SourceJson,

	[switch] $ReturnData,
	[switch] $WhatIf
)

$ErrorActionPreference = "Stop"

$zeroDuration = [TimeSpan]"00:00:00"

function Copy-Array($array) {
	$newArray = @()
	foreach ($item in $array) {
			if ($item -is [array]) {
					$newArray += Copy-Array($item)
			} else {
					$newArray += $item
			}
	}
	return $newArray
}

function Get-Json {
	$year, $month, $date = $Date -Split '-'

	$pathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes"
	$filePath = Resolve-Path "$pathToWalkRoutes\meta_archive\$year\$month\$year-$month-$date.json"

	if ($SourceJson) {
		$json = $SourceJson
	} else {
		$json = Get-Content $filePath
			| ConvertFrom-Json -AsHashtable -NoEnumerate -Depth 10
	}

	return $json
}

function Get-SegmentsFromExif {
	param($exif)

	[hashtable[]]$segments = $exif
		| Select-Object -Unique CreateDate -ExpandProperty CreateDate
		| ForEach-Object {
			return [hashtable]@{
				createDate = $_
				startDate = [DateTime]($_ -Replace '(\d{4}):(\d{2}):(\d{2})','$1-$2-$3')
			}
		}

	foreach ($segment in $segments) {
		$parts = $exif | Where-Object { $_.CreateDate -eq $segment.createDate }
		$duration = $zeroDuration
		foreach ($part in $parts) {
			$duration += [TimeSpan]$part.Duration
		}
		$segment.duration = $duration
	}

	return $segments
}

function Get-CalculatedSegmentData {
	param($segments)

	$jsonStart = [TimeSpan]$json.start

	for ($i = 0; $i -lt $segments.Length; $i++) {
		$cur = $segments[$i]
		if ($i -eq 0) {
			$cur.effectiveTrimmedStart = $zeroDuration
			$cur.effectiveTrimmedEnd = $cur.duration - $jsonStart
			$cur.totalGap = $zeroDuration
		} else {
			$last = $segments[$i - 1]

			$cur.gapFromPrevious = $cur.startDate - ($last.startDate + $last.duration)
	
			$totalGap = $zeroDuration
			for ($j = 1; $j -le $i; $j++) {
				$t = $segments[$j]
				$totalGap += $t.gapFromPrevious
			}
			$cur.totalGap = $totalGap
	
			$totalDuration = $zeroDuration
			$totalDurationWithoutGaps = $zeroDuration
			for ($j = 0; $j -le $i; $j++) {
				$t = $segments[$j]
				$totalDuration += [TimeSpan]$t.duration
				$totalDurationWithoutGaps += [TimeSpan]$t.duration
	
				if ($t.gapFromPrevious) {
					$totalDuration -= $t.gapFromPrevious
				}
			}
			$cur.totalDuration = $totalDuration - $jsonStart
			$cur.totalDurationWithoutGaps = $totalDurationWithoutGaps - $jsonStart
	
			$cur.effectiveTrimmedStart = $last.effectiveTrimmedEnd + $cur.gapFromPrevious
			$cur.effectiveTrimmedEnd = $cur.effectiveTrimmedStart + $cur.duration - $cur.gapFromPrevious
		}
	}

	return $segments
}

function Get-Segments {
	param($json)

	$segments = Get-SegmentsFromExif $json.exif
	$segments = Get-CalculatedSegmentData $segments

	return $segments
}

function Print-Nice {
	param($segments)
	
	$copy = Copy-Array $segments

	foreach ($segment in $copy) {
		$segment.duration = $segment.duration.ToString()
		$segment.effectiveTrimmedStart = $segment.effectiveTrimmedStart.ToString()
		$segment.effectiveTrimmedEnd = $segment.effectiveTrimmedEnd.ToString()
		$segment.Remove('createDate')
	}
	
	Write-Host ($copy | ConvertTo-Json -Depth 10)
}

function Print-Segments {
	param($segments)

	Write-Host ($segments | ForEach-Object {
		$n = @{}
		foreach ($key in $_.Keys) {
			if ($_[$key].GetType() -eq [TimeSpan]) {
				$n[$key] = $_[$key].ToString()
			} else {
				$n[$key] = $_[$key]
			}
		}
		return $n
	} | ConvertTo-Json)
}

$json = Get-json
$jsonStart = [TimeSpan]$json.start
$segments = Get-Segments $json
# Print-Segments $segments

foreach ($event in $json.events) {
	if (!$event.mark) { continue }

	if ($event.trimmedStart -and $event.trimmedEnd -and $event.trimmedStart -ne $event.trimmedEnd) {
		Write-Host "Skipping event that has already been adjusted"
		continue
	}

	$mark = [TimeSpan]$event.mark

	$targetSegment = $segments | Where-Object { $mark -ge $_.effectiveTrimmedStart -and $mark -lt $_.effectiveTrimmedEnd }
	if (!$targetSegment) {
		Write-Error "Failed to find segment for event"
		exit 1
	}

	$adjustedStart = $mark - $jsonStart - $targetSegment.totalGap
	$adjustedStart = $adjustedStart.ToString() -Replace '([\d]{3})\d+','$1'

	$event['trimmedStart'] = $adjustedStart

	if ($event.name -ne $null) {
		$event['trimmedEnd'] = $adjustedStart
	}
}

if ($WhatIf) {
	$json.Remove("exif")
	return $json | ConvertTo-Json -Depth 10
}

if ($ReturnData) {
	return $json
} else {
	$json | ConvertTo-Json -Depth 10 | Set-Content $filePath $serialized
}
