[CmdletBinding()]
Param(
	[Parameter(Mandatory=$true)]
	[string] $Date,
	
	[string] $ClipsPath = "D:/wip/walks/clips",

	[int] $ThumbnailWidth = 1280,
	[int] $ThumbnailHeight = 720,

	[int] $BorderThicknessX = 32,
	[int] $BorderThicknessY = 32,

	[TimeSpan] $TargetTimestamp = "00:00:00"
)

[TimeSpan] $EmptyTimestamp = "00:00:00"

$ErrorActionPreference = 'Stop'

if (!(Get-Command ffmpeg)) {
	throw "ffmpeg is required"
}

if (!(Test-Path $ClipsPath)) {
	throw "Failed to find expected folder [$ClipsPath]"
}

$expectedVideoFolder = "$ClipsPath/$Date"
if (!(Test-Path $expectedVideoFolder)) {
	throw "Failed to find expected folder [$expectedVideoFolder]"
}

$expectedVideoPath = Resolve-Path "$expectedVideoFolder/$($Date)_trimmed.mp4"
if (!(Test-Path $expectedVideoPath)) {
	throw "Failed to find expected file [$expectedVideoPath]"
}

[TimeSpan]$videoDuration = exiftool -Duration -json -api LargeFileSupport=1 $expectedVideoPath
	| ConvertFrom-Json -Depth 10
	| Select-Object -First 1
	| Select-Object -ExpandProperty Duration

Write-Host "[$expectedVideoPath] duration is [$($videoDuration.ToString())]"

if ($TargetTimestamp -eq $EmptyTimestamp) {
	$halfwayPoint = $videoDuration / 2
	$TargetTimestamp = $halfwayPoint
}

$TargetTimestamp = $TargetTimestamp.Subtract([TimeSpan]::FromMilliseconds($TargetTimestamp.Milliseconds))
$TargetTimestamp = $TargetTimestamp.ToString()

Write-Host "Getting image at target timestamp [$TargetTimestamp]"
$ffmpegArgs = @(
	'-ss', $TargetTimestamp
	'-i', $expectedVideoPath
	'-vframes', 1
	'-vf', "scale=$($ThumbnailWidth):$($ThumbnailHeight)"
	"$PSScriptRoot/gen/target_frame.png"
	'-y'
	'-loglevel', 'error'
)
Write-Verbose "Executing [ffmmpeg $ffmpegArgs]"
ffmpeg @ffmpegArgs

Write-Host "Generating barcode"
& "$PSScriptRoot/Invoke-GenerateBarcode.ps1" -Value $TargetTimestamp
$barcodeImageData = exiftool -ImageWidth -ImageHeight -json "$PSScriptRoot/gen/barcode.png"
	| ConvertFrom-Json -Depth 3
	| Select-Object -First 1

Write-Host "Overlaying border and barcode"

$barcodePositionX = ($ThumbnailWidth / 2) - ($barcodeImageData.ImageWidth / 2)
$barcodePositionY = $ThumbnailHeight - 30

$filters = @(
	# overlay frame on top of border
	"[0][1]overlay=$($BorderThicknessX):$($BorderThicknessY)[frameOverBorder]"

	# shrink frame
	"[1]scale=$($ThumbnailWidth - ($BorderThicknessX * 2)):$($ThumbnailHeight - ($BorderThicknessY * 2))[shrunkFrame]"

	# overlay shrunk frame over border
	"[frameOverBorder][shrunkFrame]overlay=$($BorderThicknessX):$($BorderThicknessY)[shrunkenFrameOverBorder]"

	# overlay border over shrunk frame
	"[shrunkenFrameOverBorder][0]overlay=0:0[borderOverFrame]"

	# overload barcode over borderOverFrame
	"[borderOverFrame][2]overlay=$($barcodePositionX):$($barcodePositionY)"
)

$outputPath = "$expectedVideoFolder/$($Date)_thumbnail.jpg"

$ffmpegArgs = @(
	'-i', "$PSScriptRoot/gen/border_white.png"
	'-i', "$PSScriptRoot/gen/target_frame.png"
	'-i', "$PSScriptRoot/gen/barcode.png"
	'-filter_complex', ($filters -Join ';')
	'-qmin', '1'
	'-qscale:v', '1'
	$outputPath
	'-y'
	'-loglevel', 'error'
)
Write-Verbose "Executing [ffmpeg $ffmpegArgs]"

ffmpeg @ffmpegArgs