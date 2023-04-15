<script>
	import { onMount } from 'svelte';
	import { Circle } from 'svelte-loading-spinners';

	import { baseUrl } from './constants/api';

	import { getPaddedDateString } from './util/date';

	import ErrorMessage from './components/ErrorMessage.svelte';
	import StatusBar from './components/StatusBar.svelte';
	import SunsetApiSourceAttribution from './components/SunsetApiSourceAttribution.svelte';
	import ThumbnailGrid from './components/ThumbnailGrid.svelte';
	import WalkCalendar from './components/WalkCalendar.svelte';

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	let now = new Date();
	const humanMonthNumber = now.getMonth() + 1;
	const realMonth = humanMonthNumber < 10 ? '0' + (now.getMonth() + 1) : humanMonthNumber.toString();
	const currentDate = now.getDate();

	let youtubeData = [];
	let originalRoutesData = null;
	let routesData = [];
	let currentMonthData = [];
	let sunxData = null;
	let isLoaded = false;
	let isErrorDuringLoad = false;
	
	let currentMonth;
	let firstDayOffset;
	let daysInMonth;
	let isRealMonth;

	function getCurrentMonthData() {
		const maxWeeksInDays = 6 * 7; // always make table have the maximum amount of cells so that changing month does not change the layout due to more/less rows existing
		const toAdd = maxWeeksInDays - (daysInMonth + firstDayOffset);
		const newCurrentMonthData = Array.from(new Array(daysInMonth + firstDayOffset + toAdd));

		const matches = youtubeData.filter(e => e.date.match(new RegExp(`\\d{4}-${currentMonth}-\\d{2}`)));

		newCurrentMonthData.forEach((e, i, a) => {
			const dayIsInMonth = i > (firstDayOffset - 1);
			if (dayIsInMonth) {
				const corresponding = matches.find(e => parseInt(e.date.slice(-2)) === (i - (firstDayOffset - 1)));
				if (corresponding) {
					a[i] = corresponding;
				}
			}
		});

		return newCurrentMonthData;
	}

	$: {
		let tempHumanMonthNumber = now.getMonth() + 1;
		currentMonth = tempHumanMonthNumber < 10 ? '0' + tempHumanMonthNumber : tempHumanMonthNumber.toString();
		firstDayOffset = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
		daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

		currentMonthData = getCurrentMonthData();
		isRealMonth = currentMonth === realMonth;
	}

	function getApiOptions() {
		let options = {};

		let secret = localStorage.getItem('secret');
		if (secret) {
			options.headers = { 'x-custom-key': secret };
		}

		return options;
	}

	onMount(async() => {
		const options = getApiOptions();

		const dateStr = getPaddedDateString(new Date());

		const tomorrowDate = new Date();
		tomorrowDate.setDate(tomorrowDate.getDate() + 1);
		const tomorrowDateStr = getPaddedDateString(tomorrowDate);

		const initialDataJobs = [
			fetch(`${baseUrl}/yt-data`, options).then(res => res.json()),
			fetch(`${baseUrl}/sunx?date=${dateStr}`, options).then(res => res.json()),
			fetch(`${baseUrl}/sunx?date=${tomorrowDateStr}`, options).then(res => res.json()),
			fetch('/geo.json', options).then(res => res.json()),
		];

		try {
			const results = await Promise.allSettled(initialDataJobs);
			
			const [
				{ value: { data: youtubeDataResult } },
				{ value: { results: sunxTodayResult } },
				{ value: { results: sunxTomorrowResult } },
				{ value: routesDataResult }
			] = results;

			youtubeData = youtubeDataResult;
			originalRoutesData = routesDataResult;
			routesData = routesDataResult.features;

			sunxData = { today: sunxTodayResult, tomorrow: sunxTomorrowResult };

			currentMonthData = getCurrentMonthData();
		} catch(e) {
			isErrorDuringLoad = true;
		}	finally {
			isLoaded = true;
		}
	});
</script>

<svelte:window on:keydown={({ altKey, code, shiftKey }) => {
	if (localStorage.getItem('secret') && originalRoutesData && altKey && shiftKey && code === 'KeyT') {
		const encodedRouteData = encodeURIComponent(JSON.stringify(originalRoutesData));
		window.open(`https://geojson.io/#data=data:application/json,${encodedRouteData}`, '_blank', 'noopener');
	}
}} />

<div id="container-app">
	{#if !navigator.userAgentData.mobile}
		<ThumbnailGrid data={youtubeData} />
	{/if}

	{#if isLoaded}
		{#if isErrorDuringLoad}
			<ErrorMessage />
		{:else}
			<StatusBar bind:now {currentMonthData} {routesData} {currentMonth} {isRealMonth} {monthNames} {realMonth} />

			<WalkCalendar {currentMonthData} {routesData} {currentDate} {firstDayOffset} {isRealMonth} {daysInMonth} {sunxData} />

			<SunsetApiSourceAttribution />
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
