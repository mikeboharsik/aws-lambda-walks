param([string] $date)

$expectedRemote = "personalgdrive:/Walk Uploads/$($date)_1.json"
$year, $month, $day = $date -Split '-'
$expectedLocal = "C:\Users\mboha\Documents\GitHub\walk-routes\meta_archive\$year\$month\$day.json"

if (Test-Path $expectedLocal) {
	Write-Host "File at [$expectedLocal] already exists, skipping download"
	return $expectedRemote
}

Write-Host "Attempting data load from Drive [$expectedRemote]"

rclone copyto $expectedRemote $expectedLocal

$obj = Get-Content $expectedLocal | ConvertFrom-Json -AsHashtable
$array = @($obj)
ConvertTo-Json $array -Depth 10 | Set-Content $expectedLocal

$dataPath = Resolve-Path $expectedLocal

return $dataPath
