Param(
	[Parameter(Mandatory=$true)]
	[string] $Date,
	[hashtable] $SourceJson,

	[switch] $IgnoreExif,
	[switch] $PrintSegments,
	[switch] $ReturnData,
	[switch] $WhatIf
)

$ErrorActionPreference = "Stop"

$zeroDuration = [TimeSpan]"00:00:00"

$year, $month, $day = $Date -Split '-'

$pathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes"
$filePath = Resolve-Path "$pathToWalkRoutes\meta_archive\$year\$month\$day.json"

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

	[ordered[]]$segments = $exif
		| Select-Object -Unique CreateDate -ExpandProperty CreateDate
		| ForEach-Object {
			return [ordered]@{
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
	param([ordered[]]$segments)

	$jsonStart = [TimeSpan]$json.startMark

	$segments | ForEach-Object { $idx = 0 } {
		$createDate = $_.createDate
		Write-Verbose "`$createDate = $createDate"
		$replacedCreateDate = $createDate -Replace '(\d{4}):(\d{2}):(\d{2})','$1-$2-$3'
		Write-Verbose "`$replacedCreateDate = $replacedCreateDate"
		$_.startDate = [DateTime]$replacedCreateDate
		$_.endDate = $_.startDate + $_.duration
		if ($idx -eq 0) {
			$_.trimmedStart = $zeroDuration - $jsonStart
			$_.trimmedEnd = $_.duration - $jsonStart
			$_.gapFromPrevious = $zeroDuration
			$_.sumOfPreviousGaps = $zeroDuration
		} else {
			$last = $segments[$idx - 1]

			$_.gapFromPrevious = $_.startDate - $last.endDate

			$_.sumOfPreviousGaps = $_.gapFromPrevious
			for ($i = $idx - 1; $i -ge 0; $i--) {
				$_.sumOfPreviousGaps += $segments[$i].gapFromPrevious
			}
		}

		$idx++
	}

	return $segments
}

function Get-Segments {
	param($json)

	$segments = Get-SegmentsFromExif $json.exif

	Write-Verbose "$($segments.Length) segments"

	$segments = Get-CalculatedSegmentData $segments

	return $segments
}

function Print-Nice {
	param($segments)
	
	$copy = Copy-Array $segments

	foreach ($segment in $copy) {
		$segment.duration = $segment.duration.ToString()
		$segment.trimmedStart = $segment.trimmedStart.ToString()
		$segment.trimmedEnd = $segment.trimmedEnd.ToString()
		$segment.Remove('createDate')
	}
	
	Write-Host ($copy | ConvertTo-Json -Depth 10)
}

function Print-Segments {
	param($segments)

	Write-Host ($segments | ForEach-Object {
		$n = @{}
		foreach ($key in $_.Keys) {
			if ($_[$key] -and $_[$key].GetType() -eq [TimeSpan]) {
				$n[$key] = $_[$key].ToString()
			} else {
				$n[$key] = $_[$key]
			}
		}
		return $n
	} | ConvertTo-Json)
}

$walks = Get-Json

foreach ($json in $walks) {
	$jsonStart = [TimeSpan]$json.startMark
	[hashtable[]]$segments = $IgnoreExif ? @() : (Get-Segments $json)

	if ($PrintSegments) {
		Print-Segments $segments
	}

	[DateTime]$startDate = $IgnoreExif ? $json.startTime : $segments[0].startDate

	foreach ($event in $json.events) {
		if (!$event.mark) { continue }

		if ($event.trimmedStart -and $event.trimmedEnd -and $event.trimmedStart -ne $event.trimmedEnd) {
			Write-Host "Skipping event that has already been adjusted"
			continue
		}

		try {
			[DateTime]$markDate = $startDate + [TimeSpan]$event.mark

			if ($IgnoreExif) {
				$trimmedStart = ($markDate - [TimeSpan]$json.startMark - $startDate).ToString()
			} else {
				$targetSegment = $segments
					| Where-Object {
						$markDate -ge $_.startDate -and $markDate -le $_.endDate
					}
				if (!$targetSegment) {
					Write-Warning "Failed to find segment for event at mark [$($event.mark): $($event.name)]"
					continue
				}

				$mark = [TimeSpan]$event.mark
				Write-Verbose "`$mark = $mark"
				$trimmedStart = ($mark - $targetSegment.sumOfPreviousGaps - $jsonStart).ToString()
				Write-Verbose "`$trimmedStart = $trimmedStart"
			}

			$trimmedEnd = $trimmedStart

			$event['trimmedStart'] = $trimmedStart.ToString() -Replace '(\d{3})\d{4}','$1'
			if ($null -ne $event.name) {
				$event['trimmedEnd'] = $trimmedEnd.ToString() -Replace '(\d{3})\d{4}','$1'
			}
		} catch {
			Write-Error "Error processing event $($event | ConvertTo-Json -Depth 10)`n$($_)"
		}
	}
}

if ($WhatIf) {
	return $walks | ConvertTo-Json -Depth 10 -AsArray
}

if ($ReturnData) {
	return $walks
} else {
	try {
		$walks | ConvertTo-Json -Depth 10 -AsArray | Set-Content $filePath
	} catch {
		Write-Error "Failed to write to file [$filePath]: $_"
	}
}