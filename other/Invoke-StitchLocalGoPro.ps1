[CmdletBinding(SupportsShouldProcess = $true)]
Param(
	[string] $PathToWalkRoutes = "$PSScriptRoot\..\..\walk-routes",

	[switch] $DeleteOriginalFiles,
	[switch] $SkipBackup
)

$ErrorActionPreference = 'Stop'

$outputFolderPath = Get-Location

function Get-SensibleGoProFilenamePath {
	$filename = 'Get-SensibleGoProFilename.ps1'
	$result = $null
	if (Test-Path "$PSScriptRoot/$filename") {
		$result = Resolve-Path "$PSScriptRoot/$filename"
	} else {
		$result = Resolve-Path "$PSScriptRoot/../$filename"
	}
	if (!$result) {
		throw "Failed to find a path to $filename"
	}
	return $result
}

$metaArchiveDir = Resolve-Path "$PathToWalkRoutes\meta_archive"
$expectedTargetFilePath = "$metaArchiveDir\$clipYear\$clipMonth\$clipDay.json"
$possibleDataPaths = @($expectedTargetFilePath)

foreach ($path in $possibleDataPaths) {
	if (Test-Path $path) {
		$dataPath = Resolve-Path $path
		break
	}
}

$outputFolderPath = Resolve-Path $outputFolderPath
Write-Verbose "`$outputFolderPath = $outputFolderPath"

$SensibleGoProFilenamePath = Get-SensibleGoProFilenamePath
Write-Verbose "`$SensibleGoProFilenamePath = $SensibleGoProFilenamePath"

try {
	$copiedFiles = Get-ChildItem -File "$outputFolderPath\*.MP4"
	foreach ($file in $copiedFiles) {
		$name = $file.Name
		$newName = & $SensibleGoProFilenamePath -Filename $name

		if ($PSCmdlet.ShouldProcess("$name $newName", 'Move-Item')) {
			Move-Item $name $newName
		}
	}

	$files = Get-ChildItem "$outputFolderPath/*.MP4"
		| Sort-Object { $_.Name }

	if ($PSCmdlet.ShouldProcess("$files", 'Add paths to files.txt')) {
		foreach ($file in $files) {
			Add-Content "files.txt" "file $($file.Name)"
		}
	}

	$initialFile = $files[0]

	$data = (exiftool -api LargeFileSupport=1 -MediaCreateDate $initialFile.FullName)
	$mediaCreateDate = ($data.Split(': ')[1]) -Replace "(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})", "`$1-`$2-`$3_`$4-`$5-`$6"

	if (!$dataPath) {
		$dateOnly = $mediaCreateDate.Substring(0, 10)
		$dataPath = & "$PSScriptRoot/Invoke-DownloadRemoteWalkFile.ps1" -Date $dateOnly
	}

	if (!$dataPath) {
		Write-Error "Failed to find data path in possible paths [$($possibleDataPaths -Join ', ')] and failed to load from Drive"
		exit 1
	}

	$stitchedFilename = $mediaCreateDate + "_merged"
	$outputFilename = "$outputFolderPath/$stitchedFilename.mp4"

	$exifPath = "$($stitchedFilename)_exif.json"
	if ($PSCmdlet.ShouldProcess("$files", "Write exif data to $exifPath")) {
		exiftool.exe -api largefilesupport=1 -CreateDate -Duration -json $files > $exifPath
	}

	if ($PSCmdlet.ShouldProcess("$outputFilename", "Run ffmpeg to produce stitched file")) {
		$ffmpegResult = ffmpeg -f concat -i "files.txt" -c copy $outputFilename
		Write-Host "`$ffmpegResult = [$ffmpegResult]"
	}

	if ($DeleteOriginalFiles) {
		Remove-Item $files
	}

	if (!$SkipBackup) {
		Write-Host "Backing up [$outputFilename]"

		$localArchiveDir = "\\AVONAS\Archive\do_not_backup\walks"

		Write-Host "Writing to [$localArchiveDir]..."
		if ($PSCmdlet.ShouldProcess("$outputFilename, $exifPath", "Copy generated files to NAS for backup")) {
			Copy-Item $outputFilename $localArchiveDir
			Copy-Item $exifPath "$localArchiveDir/$exifPath"
		}
		Write-Host "Done."
	}
} finally {
	Remove-Item "files.txt" -ErrorAction SilentlyContinue
}
