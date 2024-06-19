[CmdletBinding()]
Param(
	[Parameter(Mandatory=$true)]
	[string] $Date,

	[int] $ThumbnailWidth = 1280,
	[int] $ThumbnailHeight = 720,

	[TimeSpan] $TargetTimestamp = "00:00:00"
)

[TimeSpan] $EmptyTimestamp = "00:00:00"

$ErrorActionPreference = 'Stop'

$expectedVideoPath = Resolve-Path "D:/wip/walks/clips/$Date/$($Date)_trimmed.mp4"
[TimeSpan]$videoDuration = exiftool -Duration -json -api LargeFileSupport=1 $expectedVideoPath | ConvertFrom-Json -Depth 10 | Select-Object -First 1 | Select-Object -ExpandProperty Duration

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
$barcodeImageData = exiftool -ImageWidth -ImageHeight -json "$PSScriptRoot/gen/barcode.png" | ConvertFrom-Json -Depth 3 | Select-Object -First 1

Write-Host "Overlaying border and barcode"

$barcodePositionX = ($ThumbnailWidth / 2) - ($barcodeImageData.ImageWidth / 2)
$barcodePositionY = $ThumbnailHeight - 30

$ffmpegArgs = @(
	'-i', "$PSScriptRoot/gen/target_frame.png"
	'-i', "$PSScriptRoot/gen/border_white.png"
	'-i', "$PSScriptRoot/gen/barcode.png"
	'-filter_complex', "[0:v][1:v]overlay=0:0[withBorder];[withBorder][2]overlay=$($barcodePositionX):$($barcodePositionY)"
	"$PSScriptRoot/gen/$($Date)_thumbnail.png"
	'-y'
	'-loglevel', 'error'
)
Write-Verbose "Executing [ffmmpeg $ffmpegArgs]"
ffmpeg @ffmpegArgs
