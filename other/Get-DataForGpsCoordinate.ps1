Param(
	[string] $Coordinate
)

if (!$Coordinate) {
	throw "-Coordinate required"
}

$lat, $lon = $Coordinate -Split ','
$lat = $lat.Trim()
$lon = $lon.Trim()

$url = "http://localhost:8080/reverse.php?lat=$($lat)&lon=$($lon)&zoom=18&layer=address&format=jsonv2"

return Invoke-RestMethod $url
