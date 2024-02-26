[CmdletBinding()]
Param(
	[string] $Date
)

$year, $month, $date2 = $Date -Split '-'

$screenshotsFolder = Resolve-Path "D:\wip\walks\clips\$Date" -ErrorAction Stop
Write-Verbose "`$screenshotsFolder = $screenshotsFolder"

$pathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes"
$metaFile = Resolve-Path "$pathToWalkRoutes\meta_archive\$year\$month\$year-$month-$date2.json" -ErrorAction Stop
Write-Verbose "`$metaFile = $metaFile"

$metaContent = Get-Content $metaFile | ConvertFrom-Json -AsHashtable
if ($metaContent.events.Length -gt 0) {
	Write-Host "Skipping adding events since they already exist in [$metaFile]"
	return
}

$results = @()

$screenshots = Get-ChildItem "$screenshotsFolder\Screenshot*.png" -File
Write-Verbose "`$screenshots = $screenshots"
$screenshots | ForEach-Object {
	Write-Host "Running OCR on [$($_.Name)]"
	$results += (python -c "import easyocr; import cv2; img = cv2.imread('$($_.FullName -Replace '\\','/')'); roi = img[1055:1055+500, 0:1080]; reader = easyocr.Reader(['en']); print(reader.readtext(roi, detail = 0))" | ConvertFrom-Json)
}

Write-Verbose "Raw results:`n`n$($results | ConvertTo-Json)"

$events = [hashtable[]]@()
for ($i = 0; $i -lt $results.Length; $i++) {
	$cur = $results[$i]
	Write-Verbose "$i : [$cur]"
	if ($cur -Match "# *?(\d+)") {
			$number = [int]$Matches[1]
			$mark = '0' + ($results[$i + 2] -Replace '.\d+?$','') -Replace ' ',':'

			$existingEvent = $events | Where-Object { $_.number -eq $number } | Select-Object -First 1
			if ($existingEvent) {
				if ($existingEvent.mark -eq $mark) {
					Write-Warning "We parsed the same number before ($number) but the results agree so it's okay, skipping..."
					continue
				} else {
					throw "Disagreement between OCR results for number $number : [$existingEvent] != [$mark]"
				}
			}

			$events += @{ number = $number; mark = $mark; }
			$i = $i + 2 # anticipate the increment after this step
	}
}
$events = $events | Sort-Object { $_.number }

$durationSum = [TimeSpan]'00:00:00'
$metaContent.exif | ForEach-Object {
	$durationSum += [TimeSpan]$_.Duration
}
$durationSum -= $durationSum - [TimeSpan]$metaContent.end
$durationSum -= [TimeSpan]$metaContent.start
Write-Verbose "`$durationSum = $durationSum"

$metaContent.events = [ordered[]]@()
$events | ForEach-Object {
	$name = ''
	$originalMark = $_.mark

	try {
		$startTime = [TimeSpan]$metaContent.start
		$trimmedStart = [TimeSpan]$_.mark - $startTime

		if ($trimmedStart -lt [TimeSpan]'00:00:00' -or $trimmedStart -ge $durationSum) {
			$name = 'SKIP OOB'
		}
	} catch {
		$trimmedStart = "[$($originalMark)] - [$startTime]"
	}

	$metaContent.events += [ordered]@{
		mark = $_.mark
		name = $name
		trimmedStart = $trimmedStart.ToString()
		trimmedEnd = $trimmedStart.ToString()
	}
}
$metaContent.events[$metaContent.events.Length - 1].name = 'SKIP typically this can be deleted'
Set-Content $metaFile ($metaContent | ConvertTo-Json)
