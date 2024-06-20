Param(
	[string] $DistributionId,
	[string] $EventsPath = "../../walk-routes/events",

	[string[]] $InvalidationPaths = @(
		"/build/*"
		"/api/routes*"
		"/api/events*"
		"/api/plates*"
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

Remove-Item -Path "$PSScriptRoot/build/*" -Recurse -Force | Out-Null

Copy-Item -Path @("$PSScriptRoot/index.js", "$PSScriptRoot/node_modules") -Recurse -Destination "$PSScriptRoot/build" -Force | Out-Null

if ($DeployClient) {
	Copy-Item -Path "$PSScriptRoot/../client/public" -Recurse -Destination "$PSScriptRoot/build/public" -Force | Out-Null
}

Copy-Item $EventsPath "$PSScriptRoot/build/events" -Recurse

Write-Host (tree "$PSScriptRoot/build/public") /f
Write-Host (tree "$PSScriptRoot/build/events") /f

Compress-Archive -Path "$PSScriptRoot/build/**" -DestinationPath "$PSScriptRoot/build/deployable.zip" -Force

if (!$SkipUpload) {
	aws --no-cli-pager lambda update-function-code --function-name "walks" --zip-file "fileb://$PSScriptRoot/build/deployable.zip"

	if ($DistributionId) {
		$result = aws cloudfront create-invalidation --distribution-id $DistributionId --paths $InvalidationPaths
		Write-Host ($result | ConvertFrom-Json | ConvertTo-Json -Depth 10)
	}
}
