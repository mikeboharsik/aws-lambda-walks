Param(
	[Parameter(Mandatory = $true)]
	[string] $Value
)

node "$PSScriptRoot\index.js" $Value
