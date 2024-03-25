Param(
	[Parameter(Mandatory=$true)]
	[string] $Date,
	[switch] $WhatIf,

	[switch] $Test
)

$ErrorActionPreference = "Stop"

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

$year, $month, $date = $Date -Split '-'

if ($Test) {
	$json = @{
		start = "00:01:00.000"
		end = "00:15:00.000"
		exif = @(
			@{ CreateDate = "2024:01:01 00:00:00"; Duration = "00:05:00" }
			@{ CreateDate = "2024:01:01 00:00:00"; Duration = "00:05:00" }

			@{ CreateDate = "2024:01:01 00:06:00"; Duration = "00:05:00" }
			@{ CreateDate = "2024:01:01 00:06:00"; Duration = "00:05:00" }

			@{ CreateDate = "2024:01:01 00:12:00"; Duration = "00:05:00" }
			@{ CreateDate = "2024:01:01 00:12:00"; Duration = "00:05:00" }
		)
		events = @(
			@{ mark = "00:00:30.000"; name = "First" }
			@{ mark = "00:08:00.000"; name = "Second" }
			@{ mark = "00:14:00.000"; name = "Third" }
		)
	}
} else {
	$pathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes"
	$filePath = Resolve-Path "$pathToWalkRoutes\meta_archive\$year\$month\$year-$month-$date.json"

	$json = Get-Content $filePath
		| ConvertFrom-Json -AsHashtable -NoEnumerate -Depth 10
}

$segments = $json.exif | Select-Object -Unique CreateDate -ExpandProperty CreateDate | ForEach-Object { return [ordered]@{ createDate = $_; startDate = [DateTime]($_ -Replace '(\d{4}):(\d{2}):(\d{2})','$1-$2-$3') } }
foreach ($segment in $segments) {
	$parts = $json.exif | Where-Object { $_.CreateDate -eq $segment.createDate }
	$duration = [TimeSpan]"00:00:00"
	foreach ($part in $parts) {
		$duration += [TimeSpan]$part.Duration
	}
	$segment.duration = $duration
}

function Print-Nice {
	$copy = Copy-Array $segments

	foreach ($segment in $copy) {
		$segment.duration = $segment.duration.ToString()
		$segment.effectiveTrimmedStart = $segment.effectiveTrimmedStart.ToString()
		$segment.effectiveTrimmedEnd = $segment.effectiveTrimmedEnd.ToString()
		$segment.Remove('createDate')
	}
	
	Write-Host ($copy | ConvertTo-Json -Depth 10)
}

for ($i = 0; $i -lt $segments.Length; $i++) {
	$cur = $segments[$i]
	if ($i -gt 0) {
		$last = $segments[$i - 1]

		$cur.gapFromPrevious = ($cur.startDate - ($last.startDate + $last.duration)).ToString()

		$totalGap = [TimeSpan]"00:00:00"
		for ($j = 1; $j -le $i; $j++) {
			$t = $segments[$j]
			$totalGap += $t.gapFromPrevious
		}
		$cur.totalGap = $totalGap.ToString()

		$totalDuration = [TimeSpan]"00:00:00"
		$totalDurationWithoutGaps = [TimeSpan]"00:00:00"
		for ($j = 0; $j -le $i; $j++) {
			$t = $segments[$j]
			$totalDuration += [TimeSpan]$t.duration
			$totalDurationWithoutGaps += [TimeSpan]$t.duration

			if ($t.gapFromPrevious) {
				$totalDuration += $t.gapFromPrevious
			}
		}
		$cur.totalDuration = $totalDuration.ToString()
		$cur.totalDurationWithoutGaps = $totalDurationWithoutGaps.ToString()

		$cur.effectiveTrimmedStart = $last.effectiveTrimmedEnd + $cur.gapFromPrevious
		$cur.effectiveTrimmedEnd = $cur.effectiveTrimmedStart + $cur.duration
	} else {
		$cur.effectiveTrimmedStart = [TimeSpan]"00:00:00"
		$cur.effectiveTrimmedEnd = $cur.duration - [TimeSpan]$json.start
	}
}

foreach ($event in $json.events) {
	if (!$event.mark) { continue }

	$adjustedStart = [TimeSpan]$event.mark - [TimeSpan]$json.start

	$event['trimmedStart'] = $adjustedStart.ToString()

	if ($event.name -ne $null) {
		$event['trimmedEnd'] = $adjustedStart.ToString()
	}
}

if ($WhatIf) {
	return $json | ConvertTo-Json -Depth 10
}

if ($Test) {
	$asserts = @(
		@{ name = 'Segments length is 3'; value = $segments.Length; expected = 3; }

		@{ name = 'First event trimmedStart is -00:00:30'; value = $json.events[0].trimmedStart; expected = "-00:00:30" }
		@{ name = 'Second event trimmedStart is 00:08:00'; value = $json.events[1].trimmedStart; expected = "00:08:00" }
		# @{ name = 'Third event trimmedStart is -00:00:30'; value = $json.events[0].trimmedStart; expected = "-00:00:30" }
	)

	foreach ($assert in $asserts) {
		$good = $assert.value -eq $assert.expected
		if (!$good) {
			throw "Assertion failed: $($assert.name) -> Value is [$($assert.value)]"
		}
	}
} else {
	$json
		| ConvertTo-Json -Depth 10
		| Set-Content $filePath
}
