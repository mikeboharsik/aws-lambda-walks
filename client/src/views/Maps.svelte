<script>
	import * as L from 'leaflet';
	import { waitForElement } from '../util/waitForElement';
	import { getEvents } from '../util/api';
	import { Circle } from 'svelte-loading-spinners';

	let map;
	let features = [];
	let clickedCoordinate = null;
	let hitFeaturesCount = 0;
	let isLoadingData = false;

	waitForElement("#map").then(async (el) => {
		map = L.map("map").setView(
			[42.49982449797383, -71.10087850677222],
			13,
		);
		const tiles = L.tileLayer(
			"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			{
				maxZoom: 22,
				attribution:
					'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			},
		).addTo(map);

		map.on('click', (e) => {
			clickedCoordinate = [parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6))];
		});
	});

	function removeFeaturesFromMap(map) {
		if (features.length) {
			features.forEach(f => f.removeFrom(map));
			features = [];
		}
	}

	function addFeaturesToMap(fs, map) {
		removeFeaturesFromMap(map);
		fs.forEach((f) => {
			const feature = L.geoJSON(f).addTo(map);
			feature.bindPopup(`<div title="${f.properties.id}">${f.properties.name ?? f.properties.plates ?? 'Tags: ' + f.properties.tags}<br>${f.properties.time === 'Unknown' ? 'Unknown time' : new Date(f.properties.time).toISOString()}<br><a href="https://2milesaday.com/api/jumpToEvent?id=${f.properties.id}" target="_blank">Jump to event</a></div>`);
			features.push(feature);
		});
		hitFeaturesCount = fs.length;
	}
</script>

<div>
	<div id="map" style="height: 720px; width: 1280px">
		{#if isLoadingData}
			<div style="display: flex; position: absolute; z-index: 9999; width: 100%; height: 100%; justify-content: center; align-items: center; background-color: rgba(0, 0, 0, 0.2); pointer-events:none">
				<Circle />
			</div>
		{/if}
	</div>

	<div>
		<div>
			<input placeholder="Enter plate without spaces" type="text" id="search-for-plate-value">
			<input type="button" disabled={isLoadingData} value="Search for plate" on:click={async (e) => {
				try {
					const plateValue = document.querySelector('#search-for-plate-value').value;
					isLoadingData = true;
					const geoJson = await getEvents({ hasPlate: plateValue });
					addFeaturesToMap(geoJson.features, map);
				} finally {
					isLoadingData = false;
				}
			}}>
		</div>
		<div>
			<input placeholder="Coordinate" type="text" bind:value={clickedCoordinate} disabled>
			<input placeholder="Radius" value=25 id="radius" type="number">
			<input type="button" disabled={isLoadingData} value="Search within radius" on:click={async (e) => {
				const platesOnly = document.querySelector('#plates-only').checked;
				const nonPlatesOnly = document.querySelector('#non-plates-only').checked;
				const radius = document.querySelector('#radius').value;
				const queryParams = {
					targetPoint: clickedCoordinate.join(','),
					maxRadius: radius
				};
				if (platesOnly) {
					queryParams.plateOnly = true;
				}
				if (nonPlatesOnly) {
					queryParams.nonPlateOnly = true;
				}
				try {
					isLoadingData = true;
					const geoJson = await getEvents(queryParams);
					addFeaturesToMap(geoJson.features, map);
					var circle = L.circle(clickedCoordinate, {
							color: 'red',
							fillColor: '#f03',
							fillOpacity: 0.5,
							radius: radius
					});
					circle.addTo(map);
					features.push(circle);
				} finally {
					isLoadingData = false;
				}
			}}>
		</div>
		<div>
			Plates only: <input type="checkbox" id="plates-only">
			Non-plates only: <input type="checkbox" id="non-plates-only">
		</div>
		<div>
			Currently showing {hitFeaturesCount} datapoints
		</div>
	</div>
</div>