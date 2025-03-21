<script>
	import { onMount } from 'svelte';
	import { Circle } from 'svelte-loading-spinners';

	import ErrorMessage from './components/ErrorMessage.svelte';

	import Calendar from './views/Calendar.svelte';
	import Stats from './views/Stats.svelte';

	import { EVENTS_DATA, ORIGINAL_ROUTES_DATA, SUNX_DATA } from './stores.js';

	import { getEvents, getGit, getSunx } from './util/api';
	import { getPaddedDateString } from './util/date';
	import { storeJwt, getJwt } from './util/jwt';

	const PAGES = { CALENDAR: 'CALENDAR', STATS: 'STATS' };

	let page = localStorage.getItem('page');
	if (page === null) {
		page = PAGES.CALENDAR;
		localStorage.setItem('page', page);
	}

	let isLoaded = false;
	let isErrorDuringLoad = false;
	let gitHashes = {};

	onMount(async() => {
		storeJwt();

		const dateStr = getPaddedDateString(new Date());

		const tomorrowDate = new Date();
		tomorrowDate.setDate(tomorrowDate.getDate() + 1);
		const tomorrowDateStr = getPaddedDateString(tomorrowDate);

		const today = new Date();
		const todayYearAndMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

		const initialDataJobs = [
			getEvents(todayYearAndMonth),
			getGit(),
			getSunx(dateStr),
			getSunx(tomorrowDateStr),
		];

		try {
			const results = await Promise.allSettled(initialDataJobs);
			
			const [
				{ value: eventsDataResult },
				{ value: gitResult },
				{ value: { results: sunxTodayResult } },
				{ value: { results: sunxTomorrowResult } },
			] = results;

			gitHashes = gitResult;
			EVENTS_DATA.update(() => eventsDataResult);
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
	if (getJwt() && originalRoutesData && altKey && shiftKey && code === 'KeyT') {
		const encodedRouteData = encodeURIComponent(JSON.stringify(originalRoutesData));
		window.open(`https://geojson.io/#data=data:application/json,${encodedRouteData}`, '_blank', 'noopener');
	}
}} />

<div id="container-app">
	{#if isLoaded}
		{#if isErrorDuringLoad}
			<ErrorMessage />
		{:else}
			{#if page === PAGES.CALENDAR}
				<Calendar />
			{:else if page === PAGES.STATS}
				<Stats />
			{/if}
		{/if}

		<div style="position: absolute; top: 1em; border: 0; margin: 0; color: white">
			<span
				on:click={() => { page = PAGES.CALENDAR; localStorage.setItem('page', page); }}
				style={'cursor: pointer' + (page === PAGES.CALENDAR ? '; font-weight: bold' : '')}
			>
				Calendar
			</span>
			|
			<span
				on:click={() => { page = PAGES.STATS; localStorage.setItem('page', page); }}
				style={'cursor: pointer' + (page === PAGES.STATS ? '; font-weight: bold' : '')}
			>
				Stats
			</span>
		</div>
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
