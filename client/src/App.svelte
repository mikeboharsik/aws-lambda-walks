<script>
	import { onMount } from 'svelte';
	import { Circle } from 'svelte-loading-spinners';

	import ErrorMessage from './components/ErrorMessage.svelte';

	import Calendar from './views/Calendar.svelte';
	import Routes from './views/Routes.svelte';

	import { EVENTS_DATA, ORIGINAL_ROUTES_DATA, ROUTES_DATA, SUNX_DATA, YOUTUBE_DATA } from './stores.js';

	import { baseApiUrl, baseUrl } from './constants/api';

	import { getApiOptions } from './util/api';
	import { getPaddedDateString } from './util/date';

	let isLoaded = false;
	let isErrorDuringLoad = false;
	let renderRoutes = false;

	onMount(async() => {
		const options = getApiOptions();

		const dateStr = getPaddedDateString(new Date());

		const tomorrowDate = new Date();
		tomorrowDate.setDate(tomorrowDate.getDate() + 1);
		const tomorrowDateStr = getPaddedDateString(tomorrowDate);

		const initialDataJobs = [
			fetch(`${baseApiUrl}/events`, options).then(res => res.json()),
			fetch(`${baseApiUrl}/yt-data`, options).then(res => res.json()),
			fetch(`${baseApiUrl}/sunx?date=${dateStr}`, options).then(res => res.json()),
			fetch(`${baseApiUrl}/sunx?date=${tomorrowDateStr}`, options).then(res => res.json()),
			fetch(`${baseUrl}/geo.json`, options).then(res => res.json()),
		];

		try {
			const results = await Promise.allSettled(initialDataJobs);
			
			const [
				{ value: { data: eventsDataResult } },
				{ value: { data: youtubeDataResult } },
				{ value: { results: sunxTodayResult } },
				{ value: { results: sunxTomorrowResult } },
				{ value: routesDataResult }
			] = results;

			EVENTS_DATA.update(() => eventsDataResult);
			YOUTUBE_DATA.update(() => youtubeDataResult);
			ORIGINAL_ROUTES_DATA.update(() => routesDataResult);
			ROUTES_DATA.update(() => routesDataResult.features);
			SUNX_DATA.update(() => ({ today: sunxTodayResult, tomorrow: sunxTomorrowResult }));
		} catch(e) {
			console.error(e);
			isErrorDuringLoad = true;
		}	finally {
			isLoaded = true;
		}
	});

	let originalRoutesData;
	ORIGINAL_ROUTES_DATA.subscribe(data => originalRoutesData = data);
</script>

<svelte:window on:keydown={({ altKey, code, shiftKey }) => {
	if (localStorage.getItem('access_token') && originalRoutesData && altKey && shiftKey && code === 'KeyT') {
		const encodedRouteData = encodeURIComponent(JSON.stringify(originalRoutesData));
		window.open(`https://geojson.io/#data=data:application/json,${encodedRouteData}`, '_blank', 'noopener');
	}

	if (localStorage.getItem('access_token') && altKey && shiftKey && code === 'KeyF') {
		renderRoutes = !renderRoutes;
	}
}} />

<div id="container-app">
	{#if isLoaded}
		{#if isErrorDuringLoad}
			<ErrorMessage />
		{:else}
			{#if renderRoutes}
				<Routes />
			{:else}
				<Calendar />
			{/if}
		{/if}
	{:else}
		<div style="position: absolute">
			<Circle />
		</div>
	{/if}
</div>

<style>
	@media (prefers-color-scheme: dark) {
			#container-app {
				background-color: rgb(32, 32, 32);
				color: white;
			}
	}

	@media (prefers-color-scheme: light) {
			#container-app {
				background-color: rgb(224, 244, 244);
				color: black;
			}
	}

	#container-app {
		align-items: center;
		display: flex;
		flex-direction: column;
		justify-content: center;
		text-align: center;

		height: 100%;
		width: 100%;

		position: relative;
	}
</style>
