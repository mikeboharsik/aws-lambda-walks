<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import { getEvents } from '../util/api';
	import { firstMonth, toFixedDefault } from '../constants/config';
	import { WALKS_DATA, WALKS_DATA_IN_PROGRESS } from '../stores.js';

	export let currentMonth;
	export let currentMonthData;
	export let monthNames;
	export let now;
	export let realMonth;
	export let isRealMonth;

	const hiddenStyle = 'visibility: hidden; pointer-events: none;';

	let currentMonthTotalDistance = 0;
	let isEarliestMonth;
	let shouldHideLeftLeftButton;
	let shouldHideRightRightButton;

	async function updateEvents() {
		const month = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
		WALKS_DATA_IN_PROGRESS.update(() => true);
		const monthEvents = await getWalks(month);
		WALKS_DATA_IN_PROGRESS.update(() => false);
		WALKS_DATA.update(() => monthEvents);
	}

	function subtractMonth() {
		now = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		updateEvents();
	}

	function addMonth() {
		now = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		updateEvents();
	}

	function setFirstMonth() {
		now = firstMonth;
		updateEvents();
	}

	function setLastMonth() {
		now = new Date();
		updateEvents();
	}

	onMount(async() => {
		
	});

	$: {
		shouldHideLeftLeftButton = parseInt(currentMonth) <= 8 && now.getFullYear() === 2022;
		isEarliestMonth = currentMonth === '07' && now.getFullYear() === 2022;
		// TODO: FIX: we need to check the absolute Date rather than just the number of month
		shouldHideRightRightButton = currentMonth >= realMonth - 1 && now.getFullYear() === new Date().getFullYear();

		const monthDistanceInMeters = currentMonthData.reduce((monthTotal, curDay, idx) => {
			return monthTotal + (curDay?.reduce((acc, cur) => acc + cur.distance, 0) ?? 0);
		}, 0);

		currentMonthTotalDistance = (monthDistanceInMeters / 1609).toFixed(toFixedDefault);
	}
</script>

<div transition:fade id="container-statusbar">
	<div transition:fade>
		{now.getFullYear()}
	</div>

	<div transition:fade id="navButtons">
		{#if shouldHideLeftLeftButton}
		<button style={hiddenStyle} on:click={setFirstMonth}>{'|<'}</button>
		{:else}
		<button on:click={setFirstMonth}>{'|<'}</button>
		{/if}

		&nbsp;&nbsp;&nbsp;

		{#if isEarliestMonth}
		<button style={hiddenStyle} on:click={subtractMonth}>{'<<'}</button>
		{:else}
		<button on:click={subtractMonth}>{'<<'}</button>
		{/if}

		&nbsp;&nbsp;&nbsp;

		<div id="monthName">
			{monthNames[now.getMonth()]}
		</div>

		&nbsp;&nbsp;&nbsp;

		{#if isRealMonth}
			<button style={hiddenStyle} on:click={addMonth}>{'>>'}</button>
		{:else}
			<button on:click={addMonth}>{'>>'}</button>
		{/if}

		&nbsp;&nbsp;&nbsp;

		{#if shouldHideRightRightButton}
			<button style={hiddenStyle} on:click={setLastMonth}>{'>|'}</button>
		{:else}
			<button on:click={setLastMonth}>{'>|'}</button>
		{/if}
	</div>

	<div transition:fade>
		{currentMonthTotalDistance} miles
	</div>
</div>

<style>
	@media (prefers-color-scheme: dark) {
		button {
			background-color: #111;
			border: 2px solid #666;
			color: #fff;
		}

		#container-statusbar {
			text-shadow: black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px; user-select: none
		}
	}

	@media (prefers-color-scheme: light) {
		button {
			background-color: #eee;
			color: #000;
		}

		#container-statusbar {
			text-shadow: white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px; user-select: none;
		}
	}

	button {
		border-radius: 4px;
		font-family: monospace;
		padding-bottom: 3px;
	}

	#container-statusbar {
		backdrop-filter: blur(8px);
		border-radius: 4px;
		padding: 8px;
		user-select: none;
	}

	#navButtons {
		display: flex;
		flex-direction: row
	}

	#monthName {
		width: 96px; /* maintain consistent width to prevent button positions shifting when month changes */
	}
</style>
