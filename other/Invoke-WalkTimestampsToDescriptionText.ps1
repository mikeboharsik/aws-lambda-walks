Param(
	[Parameter(Position=0)]
	[string] $JsonFilePath
)

Write-Host "00:00:00 Walking"
Get-Content $JsonFilePath
	| ConvertFrom-Json -Depth 100
	| ForEach-Object {
		Write-Host "$($_.adjusted_start) $($_.Name)"
		Write-Host "$($_.adjusted_end) Walking"
	}