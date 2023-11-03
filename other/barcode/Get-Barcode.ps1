Param(
	[Parameter(Mandatory = $true)]
	[string] $Value
)

$PaintExePath = "C:\Program Files\WindowsApps\Microsoft.Paint_11.2309.28.0_x64__8wekyb3d8bbwe\PaintApp\mspaint.exe"

node "$PSScriptRoot\index.js" $Value

& $PaintExePath "$PSScriptRoot\barcode.png"
