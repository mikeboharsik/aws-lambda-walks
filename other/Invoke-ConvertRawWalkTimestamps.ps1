Param(
	[Parameter(Mandatory=$true)]
	[TimeSpan] $VideoStartTime
)

Write-Verbose "In directory [$(Get-Location)]"

$textFiles = Get-ChildItem ./*.txt
$file = $textFiles[0]

Get-Content $file
	| ForEach-Object {
		if ($_) {
			$t = [TimeSpan]$_ - $VideoStartTime
			return $t.ToString()
		} else {
			return ""
		}
	} 
	| Set-Content "$($file.BaseName)_converted.txt"
