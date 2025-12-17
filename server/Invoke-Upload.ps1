Param(
	[string] $DistributionId,

	[string[]] $InvalidationPaths = @(
		"/build/*"
		"/api/walks*"
		"/api/events*"
		"/api/git"
		"/api/globalStats"
		"/api/jumpToEvent*"
		"/api/routes*"
		"/api/plates*"
		"/api/youtubeIds"
		"/global.css"
		"/index.html"
	)
)

Write-Host "Using arguments:`n" 
	` "    `$DistributionId = [$DistributionId]"
	` "    `$InvalidationPaths = [$InvalidationPaths]"
	` "    `Get-Location = [$(Get-Location)]"

$ErrorActionPreference = 'Stop'

if (!$DistributionId) {
	$DistributionId = Read-Host "No CloudFront distribution ID provided, please enter one or hit Enter to skip cache invalidation"
}

aws --no-cli-pager lambda update-function-code --function-name "walks" --zip-file "fileb://$PSScriptRoot/build/deployable.zip" | ConvertFrom-Json -AsHashtable -Depth 10 | ConvertTo-Json -Depth 10 -Compress

if ($DistributionId) {
	$result = aws cloudfront create-invalidation --distribution-id $DistributionId --paths $InvalidationPaths | ConvertFrom-Json -AsHashtable
	$invalidationId = $result.Invalidation.Id
	Write-Host ($result | ConvertTo-Json -Depth 10 -Compress)

	while ($result.Invalidation.Status -ne 'Completed') {
		Start-Sleep -Seconds 5

		$result = aws cloudfront get-invalidation --distribution-id $DistributionId --id $invalidationId | ConvertFrom-Json -AsHashtable
	}

	Write-Host ($result | ConvertTo-Json -Depth 10 -Compress)
}