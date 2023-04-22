Param(
	[string] $DistributionId,
	[string] $GeoJsonFilePath = "../../walk-routes/geo.json",

	[string[]] $InvalidationPaths = @("/build/*", "/global.css"),

	[switch] $DeployClient,
	[switch] $SkipUpload
)

if (!$DistributionId) {
	$DistributionId = Read-Host "No CloudFront distribution ID provided, please enter one or hit Enter to skip cache invalidation"
}

New-Item -Path "./build" -ItemType Directory -Force | Out-Null

Remove-Item -Path "./build/*" -Recurse -Force | Out-Null

Copy-Item -Path @("./index.js", "./node_modules") -Recurse -Destination "./build" -Force | Out-Null

if ($DeployClient) {
	Copy-Item -Path "../client/public" -Recurse -Destination "./build/public" -Force | Out-Null
}

$geojson = Get-Content $GeoJsonFilePath | ConvertFrom-Json | ConvertTo-Json -Depth 10 -Compress
Set-Content "./build/public/geo.json" $geojson -Force

Compress-Archive -Path "./build/**" -DestinationPath "./build/deployable.zip" -Force

if (!$SkipUpload) {
	aws --no-cli-pager lambda update-function-code --function-name "walks" --zip-file "fileb://./build/deployable.zip"

	if ($DistributionId) {
		$result = aws cloudfront create-invalidation --distribution-id $DistributionId --paths $InvalidationPaths
		Write-Host ($result | ConvertFrom-Json | ConvertTo-Json -Depth 10)
	}
}
