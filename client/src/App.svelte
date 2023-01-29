<script>
	import { onMount } from 'svelte';
	import { Circle } from 'svelte-loading-spinners';

	import { baseUrl } from './stores/api';

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

	let apiBaseUrl;
	baseUrl.subscribe(val => apiBaseUrl = val);

	let now = new Date();
	const humanMonthNumber = now.getMonth() + 1;
	const realMonth = humanMonthNumber < 10 ? '0' + (now.getMonth() + 1) : humanMonthNumber.toString();
	const currentDate = now.getDate();

	let data = [];
	let currentMonthData = [];
	let sunsetTime;
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

		const matches = data.filter(e => e.date.match(new RegExp(`\\d{4}-${currentMonth}-\\d{2}`)));

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

	function padNumber(n) {
		return n.toString().padStart(2, '0');
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

		const now = new Date();
		const dateStr = `${padNumber(now.getFullYear())}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;

		const jobs = [
			fetch(`${apiBaseUrl}/yt-data`, options).then(res => res.json()),
			fetch(`${apiBaseUrl}/sunx?date=${dateStr}`).then(res => res.json()),
		];

		try {
			const results = await Promise.allSettled(jobs);
			
			data = results[0].value.data;

			const rawSunset = new Date(results[1].value.results.sunset);
			sunsetTime = `${padNumber(rawSunset.getHours())}:${padNumber(rawSunset.getMinutes())}:${padNumber(rawSunset.getSeconds())}`;

			currentMonthData = getCurrentMonthData();
		} catch(e) {
			isErrorDuringLoad = true;
		}	finally {
			isLoaded = true;
		}
	});
</script>

<div id="container-app">
	{#if !navigator.userAgentData.mobile}
		<ThumbnailGrid {data} />
	{/if}

	{#if isLoaded}
		{#if isErrorDuringLoad}
			<ErrorMessage />
		{:else}
			<StatusBar bind:now {currentMonthData} {currentMonth} {isRealMonth} {monthNames} {realMonth} />

			<WalkCalendar {currentMonthData} {currentDate} {firstDayOffset} {isRealMonth} {daysInMonth} {sunsetTime} />

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
