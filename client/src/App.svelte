<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

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

	const dayNames = [
		'Su',
		'Mo',
		'Tu',
		'We',
		'Th',
		'Fr',
		'Sa'
	];

	let now = new Date();
	const humanMonthNumber = now.getMonth() + 1;
	const realMonth = humanMonthNumber < 10 ? '0' + (now.getMonth() + 1) : humanMonthNumber.toString();
	const currentDate = now.getDate();

	console.log({ currentDate, realMonth });

	let data = [];
	let currentMonthData = [];
	let isLoaded = false;

	let currentMonth;
	let firstDayOffset;
	let daysInMonth;

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
		{@const isEarliestMonth = currentMonth === '07' && now.getFullYear() === 2022}
		{@const isRealMonth = currentMonth === realMonth}

		{@const leftButtonStyle = isEarliestMonth ? 'visibility: hidden; pointer-events: none;' : null}
		{@const rightButtonStyle = isRealMonth ? 'visibility: hidden; pointer-events: none;' : null}

		<div style="user-select: none">
			<div>
				{now.getFullYear()}
			</div>

			<div style="display: flex; flex-direction: row">
				<button style={leftButtonStyle} on:click={subtractMonth}>{'<<'}</button>
				<div style="width: 96px">
					{monthNames[now.getMonth()]}
				</div>
				<button style={rightButtonStyle} on:click={addMonth}>{'>>'}</button>
			</div>
		</div>

		<div transition:fade id="wrapper">
			{#each dayNames as day}
				<h5 style="user-select: none">{day}</h5>
			{/each}

			{#each currentMonthData as d, idx}
				{@const dateNumber = idx - firstDayOffset + 1}
				{@const currentDateIdx = currentDate + firstDayOffset - 1}
				{@const isCurrentDate = idx === currentDateIdx}

				{@const isEmptyDay = idx < firstDayOffset}
				{@const isFutureDay = isRealMonth && idx > currentDateIdx}
				{@const isPendingDay = isRealMonth && isCurrentDate && !d?.date}
				{@const isWalkDay = !!d?.date}
				{@const isFuturePaddingDay = idx > daysInMonth + firstDayOffset - 1}

				{@const classes = getDayClasses({ isEmptyDay, isFutureDay, isFuturePaddingDay, isPendingDay, isWalkDay })}

				{@const walkDayContent = d?.distance ? `${d.distance} miles` : 'Unspecified'}

				<div class={classes}>
					{#if !isEmptyDay && !isFuturePaddingDay}
						<div class="date-number">{dateNumber}</div>
					{/if}
					{#if isWalkDay}
						{#if d.directions}
							<a href={d.directions} noreferrer nopener target="_blank">{walkDayContent}</a>
						{:else}
							{walkDayContent}
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.day {
		align-items: center;
		border: 1px solid black;
		display: flex;
		height: 96px;
		justify-content: center;
		position: relative;
		width: 96px;
	}

	.date-number {
		left: 0.1em;
		position: absolute;
		top: 0.1em;
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