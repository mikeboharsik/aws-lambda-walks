<script>
	import { fade } from 'svelte/transition';

	import { toFixedDefault } from '../constants/config';

	export let currentMonth;
	export let currentMonthData;
	export let routesData;
	export let monthNames;
	export let now;
	export let realMonth;
	export let isRealMonth;

	const hiddenStyle = 'visibility: hidden; pointer-events: none;';

	let currentMonthTotalDistance = 0;
	let isEarliestMonth;
	let shouldHideLeftLeftButton;
	let shouldHideRightRightButton;

	function subtractMonth() {
		now = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	}

	function addMonth() {
		now = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	}

	function setFirstMonth() {
		now = new Date(2022, 6, 1);
	}

	function setLastMonth() {
		now = new Date();
	}

	$: {
		shouldHideLeftLeftButton = parseInt(currentMonth) <= 8 && now.getFullYear() === 2022;
		isEarliestMonth = currentMonth === '07' && now.getFullYear() === 2022;
		// TODO: FIX: we need to check the absolute Date rather than just the number of month
		shouldHideRightRightButton = currentMonth >= realMonth - 1 && now.getFullYear() === new Date().getFullYear();

		currentMonthTotalDistance = (currentMonthData.reduce((monthTotal, { walks } = {}) => {
			return (walks?.reduce((dayTotal, { routeId }) => {
				if (!routeId) return dayTotal;

				const routeData = routesData.find(r => r.properties.id === routeId);
				if (!routeData) {
					console.warn(`Failed to load data for route [${routeId}], current month total distance data will probably be inaccurate`)
					return dayTotal;
				}

				const { properties: { distance, startFeatureId, endFeatureId } } = routeData;
				let routeDistance = distance;

				if (startFeatureId) {
					const startFeature = routesData.find(r => r.properties.id === startFeatureId);
					routeDistance += startFeature.properties.distance;
				}
				if (endFeatureId) {
					const endFeature = routesData.find(r => r.properties.id === endFeatureId)
					routeDistance += endFeature.properties.distance;
				}

				return (routeDistance ?? 0) + dayTotal;
			}, 0) ?? 0) + monthTotal;
		}, 0) / 1609).toFixed(toFixedDefault);
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
