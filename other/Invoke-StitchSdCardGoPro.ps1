[CmdletBinding(SupportsShouldProcess = $true)]
Param(
	[string] $SdCardPath = "G:",
	[string] $ContentPath = "DCIM/100GOPRO",

	[string] $DestinationPath = "D:/wip/walks",

	[switch] $DeleteOriginalFiles,
	[switch] $SkipEject
)

Write-Verbose "`$PSScriptRoot = [$PSScriptRoot]"

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

$StitchLocalGoProPath = Get-StitchLocalGoProPath
Write-Verbose "`$StitchLocalGoProPath = $StitchLocalGoProPath"

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

	& $StitchLocalGoProPath -DeleteOriginalFiles:$DeleteOriginalFiles

	if ($DeleteOriginalFiles) {
		if ($PSCmdlet.ShouldProcess("$OriginalContentPath\*", 'Remove-Item')) {
			Remove-Item "$OriginalContentPath\*"
		}
	}

	if (!$SkipEject) {
		if ($PSCmdlet.ShouldProcess($sdCardPath, 'Eject')) {
			(New-Object -ComObject Shell.Application).NameSpace(17).ParseName($SdCardPath).InvokeVerb("Eject")
		}
	}

	Add-Type -AssemblyName PresentationCore,PresentationFramework
	[System.Windows.MessageBox]::Show("Backup has completed", "Invoke-StitchSdCardGoPro.ps1", 0) | Out-Null
} finally {
	Set-Location $originalPath
}
