<script>
	import { ROUTES_DATA } from '../stores';

	import { getGeojsonIoUrlForRoute } from '../util/geojson';

	let routesData = null;
	ROUTES_DATA.subscribe(val => {
		routesData = val.toSorted(({ properties: { name: a } }, { properties: { name: b } }) => {
			if (a < b) {
				if (a.startsWith('COMMON') && !b.startsWith('COMMON')) {
					return 1;
				}
				return -1;
			}
			if (b < a) { 
				if (b.startsWith('COMMON') && !a.startsWith('COMMON')) {b
					return -1;
				}
				return 1;
			}
			return 0;
		});
	});
</script>

<ul style="font-family: monospace; font-size: 12px; text-align: left; text-wrap: nowrap; width: 960px; overflow: scroll">
	{#each routesData as { properties: { id, name } }}
		<li>
			[<a href={getGeojsonIoUrlForRoute(id, routesData)} target="_blank" noreferrer noopener>{id}</a>] {name ?? '[MISSING NAME]'}
		</li>
	{/each}
</ul>
