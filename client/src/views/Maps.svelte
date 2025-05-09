<script>
	import * as L from 'leaflet';
	import { getJwt } from '../util/jwt';
	import { waitForElement } from '../util/waitForElement';
	import { getEvents } from '../util/api';

	const jwt = getJwt();
	if (jwt) {
		waitForElement("#map").then(async (el) => {
			const map = L.map("map").setView(
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

			if (jwt) {
				const radius = 100;
				const geoJson = await getEvents('42.4997178,-71.1006031', radius);
				L.geoJSON(geoJson).addTo(map);
				L.circle([42.4997178,-71.1006031], {
					color: '#f03',
					fillColor: '#f03',
					fillOpacity: 0.5,
					radius: radius
				}).addTo(map);
			}
		})
	};
</script>

<div>
	<div id="map" style="height: 720px; width: 1280px" />
</div>