<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let now = new Date();
	const realMonth = '0' + (now.getMonth() + 1);
	const currentDate = now.getDate();

	let data = [];
	let currentMonthData = [];
	let isLoaded = false;

	let currentMonth;
	let firstDayOffset;
	let daysInMonth;

	function getCurrentMonthData() {
		const toAdd = 42 - (daysInMonth + firstDayOffset);
		const newCurrentMonthData = Array.from(new Array(daysInMonth + firstDayOffset + toAdd));
		const matches = data.filter(e => e.date.match(new RegExp(`\\d{4}-${currentMonth}-\\d{2}`)));
		newCurrentMonthData.forEach((e, i, a) => {
			if (i > (firstDayOffset - 1)) {
				const corresponding = matches.find(e => parseInt(e.date.slice(-2)) === (i - (firstDayOffset - 1)));
				if (corresponding) {
					a[i] = corresponding;
				}
			}
		});
		return newCurrentMonthData;
	}

	$: {
		currentMonth = '0' + (now.getMonth() + 1);
		firstDayOffset = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
		daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

		currentMonthData = getCurrentMonthData();
	}

	function subtractMonth() {
		now = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	}

	function addMonth() {
		now = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	}

	function getDayClasses({ isEmptyDay, isFutureDay, isFuturePaddingDay, isPendingDay, isWalkDay }) {
		let classes = ['day'];

		if (isPendingDay) {
			classes.push('pending-day');
		}
		else if (isWalkDay) {
			classes.push('walk-day');
		}
		else if (isFuturePaddingDay) {
			classes.push('future-padding-day');
		}
		else if (!isEmptyDay && !isFutureDay) {
			classes.push('non-walk-day');
		}

		return classes.join(' ');
	}

	onMount(async() => {
		const options = {};
		
		let secret = localStorage.getItem('secret');
		if (secret) {
			options.headers = { 'x-custom-key': secret };
		}

		const res = await fetch('https://walks.mikeboharsik.com/api/yt-data', options).then(res => res.json());
		({ data } = res);

		currentMonthData = getCurrentMonthData();
		isLoaded = true;
	});
</script>

<div id="container">
	{#if isLoaded}
		{@const leftButtonStyle = currentMonth === '07' ? 'visibility: hidden; pointer-events: none;' : null}
		{@const rightButtonStyle = currentMonth === realMonth ? 'visibility: hidden; pointer-events: none;' : null}

		<div style="flex-direction: row">
			<button style={leftButtonStyle} on:click={subtractMonth}>{'<<'}</button>
			Month: {currentMonth}
			<button style={rightButtonStyle} on:click={addMonth}>{'>>'}</button>
		</div>

		<div transition:fade id="wrapper">
			{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr' , 'Sa'] as day}
				<h5>{day}</h5>
			{/each}

			{#each currentMonthData as d, idx}
				{@const dateNumber = idx - firstDayOffset + 1}
				{@const isRealMonth = currentMonth === realMonth}
				{@const currentDateIdx = currentDate + firstDayOffset - 1}
				{@const isCurrentDate = idx === currentDateIdx}

				{@const isEmptyDay = idx < firstDayOffset}
				{@const isFutureDay = isRealMonth && idx > currentDateIdx}
				{@const isPendingDay = isRealMonth && isCurrentDate && !d?.date}
				{@const isWalkDay = d?.date}
				{@const isFuturePaddingDay = idx > daysInMonth + firstDayOffset - 1}

				{@const classes = getDayClasses({ isEmptyDay, isFutureDay, isFuturePaddingDay, isPendingDay, isWalkDay })}

				<div class={classes}>
					{#if !isEmptyDay && !isFuturePaddingDay}
						<div class="date-number">{dateNumber}</div>
					{/if}
					{#if isWalkDay}
						{d.distance ? `${d.distance} miles` : 'Unspecified'}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.day {
		align-items: center;
		display: flex;
		justify-content: center;
		border: 1px solid black;
		height: 96px;
		width: 96px;
		position: relative;
	}

	.date-number {
		position: absolute;
		top: 0.1em;
		left: 0.1em;
	}

	.non-walk-day {
		background-color: #ffaaaa;
		display: inline;
		text-align: left;
	}

	.future-padding-day {
		visibility: hidden;
	}

	.walk-day {
		background-color: #aaffaa;
	}

	.pending-day {
		background-color: #ffffaa;
	}

	#container {	
		align-items: center;
		display: flex;
		flex-direction: column;
		height: 100%;
		justify-content: center;
		text-align: center;
		width: 100%;
	}

	#wrapper {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
		grid-gap: 1px;
	}
</style>