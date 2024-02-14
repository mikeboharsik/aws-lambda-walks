Param(
	[Parameter(Mandatory=$true)]
	[string] $Date
)

$year, $month, $date = $Date -Split '-'

$filePath = "$PSScriptRoot\meta_archive\$year\$month\$year-$month-$date.json"

$json = Get-Content $filePath
	| ConvertFrom-Json -AsHashtable -NoEnumerate -Depth 10
	
foreach ($event in $json.events) {
	$adjustedStart = [TimeSpan]$event.mark - [TimeSpan]$json.start
	$event['adjusted_start'] = $adjustedStart.ToString()
	$event['adjusted_end'] = $adjustedStart.ToString()
}
			
$json
	| ConvertTo-Json -Depth 10
	| Set-Content $filePath
