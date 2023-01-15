<script>
	import { fade } from 'svelte/transition';

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

		currentMonthTotalDistance = currentMonthData.reduce((acc, cur) => cur ? cur.walks.reduce((acc2, cur2) => acc2 + parseFloat(cur2.distance), 0) + acc : acc, 0).toFixed(1);
	}
</script>

<div transition:fade id="container">
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
			color: #fff;
		}

		#container {
			text-shadow: black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px; user-select: none
		}
	}

	@media (prefers-color-scheme: light) {
		button {
			background-color: #eee;
			color: #000;
		}

		#container {
			text-shadow: white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px; user-select: none;
		}
	}

	button {
		border-radius: 4px;
	}

	#container {
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