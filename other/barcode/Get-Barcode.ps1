Param(
	[Parameter(Mandatory = $true)]
	[string] $Value
)

$PaintExePath = "mspaint"

node "$PSScriptRoot\index.js" $Value

& $PaintExePath "$PSScriptRoot\barcode.png"
