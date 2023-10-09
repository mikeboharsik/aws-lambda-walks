function getGeoJsonFeaturesRecursively(allFeatures, feature) {
	let features = [feature];
	const commonFeatureIds = feature?.properties?.commonFeatureIds;
	if (commonFeatureIds?.length) {
		for (let i of commonFeatureIds) {
			const f = allFeatures.find(e => e.properties.id === i);
			features.push(...getGeoJsonFeaturesRecursively(allFeatures, f));
		}
	}
	return features;
}

export function getGeojsonIoUrlForRoute(id, data) {
	const targetRoute = data.find(route => route.properties.id === id);
	if (!targetRoute) {
		return;
	}

	const allFeatures = getGeoJsonFeaturesRecursively(data, targetRoute);

	const updatedRouteData = {
		type: "FeatureCollection",
		features: allFeatures,
	};

	const encodedRouteData = encodeURIComponent(JSON.stringify(updatedRouteData));
	return `https://geojson.io/#data=data:application/json,${encodedRouteData}`;
}

export function goToGeojsonIoUrlForRoute(id, data) {
	window.open(getGeojsonIoUrlForRoute(id, data));
}

export function getRouteDistanceRecursively(allRoutes, route) {
	let distance = route?.properties?.distance ?? 0;
	const commonFeatureIds = route?.properties?.commonFeatureIds;
	if (commonFeatureIds?.length) {
		for (let featureId of commonFeatureIds) {
			const targetFeature = allRoutes.find(e => e.properties.id === featureId);
			distance += getRouteDistanceRecursively(allRoutes, targetFeature);
		}
	}
	return distance;
}
