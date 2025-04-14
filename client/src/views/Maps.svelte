<script>
	import * as L from 'leaflet';

	function waitForElement(selector) {
		return new Promise((resolve) => {
			if (document.querySelector(selector)) {
				return resolve(document.querySelector(selector));
			}

			const observer = new MutationObserver((mutations) => {
				if (document.querySelector(selector)) {
					observer.disconnect();
					resolve(document.querySelector(selector));
				}
			});

			// If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		});
	}

	waitForElement("#map").then((el) => {
		const map = L.map("map").setView(
			[42.49982449797383, -71.10087850677222],
			13,
		);
		const tiles = L.tileLayer(
			"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
			{
				maxZoom: 19,
				attribution:
					'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			},
		).addTo(map);
	});
</script>

<div>
	<div id="map" style="height: 720px; width: 1280px" />
</div>