Param(
	[Parameter(Mandatory=$true)]
	[string] $Date
)

$year, $month, $date = $Date -Split '-'

$pathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes"
$filePath = Resolve-Path "$pathToWalkRoutes\meta_archive\$year\$month\$year-$month-$date.json"

$json = Get-Content $filePath
	| ConvertFrom-Json -AsHashtable -NoEnumerate -Depth 10
	
foreach ($event in $json.events) {
	$adjustedStart = [TimeSpan]$event.mark - [TimeSpan]$json.start

	$event['trimmedStart'] = $adjustedStart.ToString().SubString(0, 12)
	$event['trimmedEnd'] = $adjustedStart.ToString().SubString(0, 12)

	if ($adjustedStart -lt [TimeSpan]'00:00:00') {
		$event['name'] = 'SKIP OOB ' + $event['name']
	}
}
			
$json
	| ConvertTo-Json -Depth 10
	| Set-Content $filePath
