Param(
	[Parameter(Mandatory=$true)]
	[TimeSpan] $VideoStartTime
)

Write-Verbose "In directory [$(Get-Location)]"

$textFiles = Get-ChildItem -File ./*.json
$file = $textFiles[0]

$json = Get-Content $file
	| ConvertFrom-Json -AsHashtable -NoEnumerate -Depth 10
	
foreach ($event in $json) {
	$adjustedStart = [TimeSpan]$event.mark - $VideoStartTime
	$event['adjusted_start'] = $adjustedStart.ToString()
	$event['adjusted_end'] = $adjustedStart.ToString()
}
			
$json
	| ConvertTo-Json -Depth 10
	| Set-Content $file
