[CmdletBinding(SupportsShouldProcess = $true)]
Param(
	[string] $StitchedFilename,

	[switch] $DeleteOriginalFiles,
	[switch] $SkipBackup
)

$outputFolderPath = Get-Location

$outputFolderPath = Resolve-Path $outputFolderPath
Write-Verbose "`$outputFolderPath = $outputFolderPath"

try {
	$files = Get-ChildItem "$outputFolderPath/*.MP4"
		| Sort-Object { $_.Name }

	foreach ($file in $files) {
		Add-Content "files.txt" "file $($file.Name)"
	}

	if (!$StitchedFilename) {
		$StitchedFilename = $files[0].BaseName + "_merged"
	}

	$outputFilename = "$outputFolderPath/$StitchedFilename.mp4"

	ffmpeg -f concat -i "files.txt" -c copy $outputFilename

	if ($DeleteOriginalFiles) {
		Remove-Item $files
	}

	if (!$SkipBackup) {
		Write-Host "Backing up [$outputFilename]"

		$localArchiveDir = "H:/do_not_backup/walks"
		$remoteArchiveDir = "gs://walk-videos"

		Write-Host "Writing to [$localArchiveDir]..."
		Copy-Item $outputFilename $localArchiveDir
		Write-Host "Done."

		<#
		Write-Host "Writing to [$remoteArchiveDir]..."
		gsutil cp $outputFilename $remoteArchiveDir
		Write-Host "Done."
		#>
	}
} finally {
	Remove-Item "files.txt" -ErrorAction SilentlyContinue
}
