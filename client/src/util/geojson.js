export function getGeojsonIoUrlForRoute(id, data) {
	const targetRoute = data.find(route => route.properties.id === id);
	if (!targetRoute) {
		return;
	}

	const updatedRouteData = {
		type: "FeatureCollection",
		features: [targetRoute],
	};

	targetRoute.properties.commonFeatureIds?.forEach((commonFeatureId) => {
		const feature = data.find(r => r.properties.id === commonFeatureId);
		if (feature?.geometry) {
			updatedRouteData.features.push(feature);
		}
	});

	const encodedRouteData = encodeURIComponent(JSON.stringify(updatedRouteData));
	return `https://geojson.io/#data=data:application/json,${encodedRouteData}`;
}

export function goToGeojsonIoUrlForRoute(id, data) {
	window.open(getGeojsonIoUrlForRoute(id, data));
}
