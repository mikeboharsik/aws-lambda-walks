Param(
	[string] $DistributionId,
	[string] $EventsPath = "../walk-routes/events.json",
	[string] $GeneratedPath = "../walk-routes/generated/**",

	[string[]] $InvalidationPaths = @(
		"/build/*"
		"/api/events*"
		"/api/git"
		"/api/globalStats"
		"/api/jumpToEvent*"
		"/api/routes*"
		"/api/plates*"
		"/api/youtubeIds"
		"/global.css"
		"/index.html"
	),

	[switch] $DeployClient,
	[switch] $SkipUpload
)

Write-Host "Using arguments:`n" 
	` "    `$DistributionId = [$DistributionId]"
	` "    `$EventsPath = [$EventsPath]"
	` "    `$InvalidationPaths = [$InvalidationPaths]"
	` "    `$DeployClient = [$DeployClient]"
	` "    `$SkipUpload = [$SkipUpload]"
	` "    `Get-Location = [$(Get-Location)]"

$ErrorActionPreference = 'Stop'

if (!$DistributionId) {
	$DistributionId = Read-Host "No CloudFront distribution ID provided, please enter one or hit Enter to skip cache invalidation"
}

New-Item -Path "$PSScriptRoot/build" -ItemType Directory -Force | Out-Null

Copy-Item -Path @("$PSScriptRoot/src/**", "$PSScriptRoot/node_modules") -Recurse -Destination "$PSScriptRoot/build" -Force | Out-Null

if ($DeployClient) {
	Copy-Item -Path "$PSScriptRoot/../client/public" -Recurse -Destination "$PSScriptRoot/build/public" -Force | Out-Null
}

Copy-Item -Recurse $GeneratedPath "$PSScriptRoot/build"

Write-Host "Everything except node_modules:" (Get-ChildItem "$PSScriptRoot/build/**" -Recurse -File | Where-Object { $_.FullName -NotMatch "node_modules" } | ForEach-Object { $_.FullName } | ConvertTo-Json -Depth 10 -Compress)

Compress-Archive -Path "$PSScriptRoot/build/**" -DestinationPath "$PSScriptRoot/build/deployable.zip" -Force

if (!$SkipUpload) {
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
}
