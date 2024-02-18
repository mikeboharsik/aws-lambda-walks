[CmdletBinding(SupportsShouldProcess = $true)]
Param(
	[string] $SdCardPath = "P:",
	[string] $ContentPath = "DCIM/100GOPRO",

	[string] $DestinationPath = "D:/wip/walks",

	[switch] $DeleteOriginalFiles,
	[switch] $SkipEject
)

function Get-StitchLocalGoProPath {
	$filename = 'Invoke-StitchLocalGoPro.ps1'
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

Write-Verbose "`$PSScriptRoot = [$PSScriptRoot]"

$StitchLocalGoProPath = Get-StitchLocalGoProPath
Write-Verbose "`$StitchLocalGoProPath = $StitchLocalGoProPath"

$SensibleGoProFilenamePath = Get-SensibleGoProFilenamePath
Write-Verbose "`$SensibleGoProFilenamePath = $SensibleGoProFilenamePath"

$OriginalContentPath = "$SdCardPath/$ContentPath"

$originalPath = Get-Location

$date = Get-Date -Format "yyyy-MM-dd"

$outputFolderPath = "$DestinationPath/$date"
New-Item -ItemType Directory -Path $outputFolderPath -ErrorAction SilentlyContinue | Out-Null
Remove-Item "$outputFolderPath\**"

Push-Location $outputFolderPath

$outputFolderPath = Resolve-Path $outputFolderPath
Write-Verbose "`$outputFolderPath = $outputFolderPath"

try {
	$originalFiles = Get-ChildItem $OriginalContentPath
		| Where-Object { $_.Extension -eq ".MP4" }

	if ($PSCmdlet.ShouldProcess("$originalFiles $outputFolderPath", 'Copy-Item')) {
		Copy-Item -Path $originalFiles -Destination $outputFolderPath
	}

	$copiedFiles = Get-ChildItem $outputFolderPath
	foreach ($file in $copiedFiles) {
		$name = $file.Name
		$newName = & $SensibleGoProFilenamePath -Filename $name

		if ($PSCmdlet.ShouldProcess("$name $newName", 'Move-Item')) {
			Move-Item $name $newName
		}
	}

	$files = Get-ChildItem $outputFolderPath
		| Sort-Object { $_.Name }

	exiftool.exe -api largefilesupport=1 -json $files > exif.json

	$initialFile = $files[0]

	$data = (exiftool -api LargeFileSupport=1 -MediaCreateDate $initialFile.FullName)
	$mediaCreateDate = ($data.Split(': ')[1]) -Replace "(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})", "`$1-`$2-`$3_`$4-`$5-`$6"

	& $StitchLocalGoProPath -StitchedFilename $mediaCreateDate

	if ($DeleteOriginalFiles) {
		if ($PSCmdlet.ShouldProcess("$files, $OriginalContentPath\*", 'Remove-Item')) {
			Remove-Item $files
			Remove-Item "$OriginalContentPath\*"
		}
	}

	if (!$SkipEject) {
		if ($PSCmdlet.ShouldProcess($sdCardPath, 'Eject')) {
			(New-Object -ComObject Shell.Application).NameSpace(17).ParseName($SdCardPath).InvokeVerb("Eject")
		}
	}
} finally {
	Set-Location $originalPath
}
