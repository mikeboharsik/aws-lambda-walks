<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Circle } from 'svelte-loading-spinners';

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

	let data = [];
	let currentMonthData = [];
	let sunsetTime;
	let isLoaded = false;
	let isErrorDuringLoad = false;

	let currentMonth;
	let currentMonthTotalDistance;
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
		currentMonthTotalDistance = currentMonthData.reduce((acc, cur) => cur ? cur.walks.reduce((acc2, cur2) => acc2 + parseFloat(cur2.distance), 0) + acc : acc, 0).toFixed(1);
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

	function getDateDistanceSum(date) {
		return currentMonthData.find(d => d?.date === date).walks.reduce((acc, cur) => acc + parseFloat(cur.distance), 0).toFixed(1);
	}

	function padNumber(n) {
		return n.toString().padStart(2, '0');
	}

	onMount(async() => {
		const options = {};
		
		let secret = localStorage.getItem('secret');
		if (secret) {
			options.headers = { 'x-custom-key': secret };
		}

		const now = new Date();
		const dateStr = `${padNumber(now.getFullYear())}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;

		const jobs = [
			fetch(`https://walks.mikeboharsik.com/api/yt-data`, options).then(res => res.json()),
			fetch(`https://walks.mikeboharsik.com/api/sunset?date=${dateStr}`).then(res => res.json()),
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

<div id="container">
	{#if isLoaded}
		{#if isErrorDuringLoad}
			<div>
				There was a problem. Try refreshing to see if that fixes it.
			</div>
			<br>
			<button on:click={() => window.location.reload()}>Refresh</button>
		{:else}
			{@const isEarliestMonth = currentMonth === '07' && now.getFullYear() === 2022}
			{@const isRealMonth = currentMonth === realMonth}

			{@const leftButtonStyle = isEarliestMonth ? 'visibility: hidden; pointer-events: none;' : null}
			{@const rightButtonStyle = isRealMonth ? 'visibility: hidden; pointer-events: none;' : null}

			<div transition:fade style="user-select: none">
				<div transition:fade>
					{now.getFullYear()}
				</div>

				<div transition:fade style="display: flex; flex-direction: row">
					<button style={leftButtonStyle} on:click={subtractMonth}>{'<<'}</button>
					<div style="width: 96px">
						{monthNames[now.getMonth()]}
					</div>
					<button style={rightButtonStyle} on:click={addMonth}>{'>>'}</button>
				</div>
			</div>

			<div transition:fade>
				{currentMonthTotalDistance} miles
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

					{@const walkDayContent = d?.date && d?.walks.length > 0 ? `${getDateDistanceSum(d.date)} miles` : 'Unspecified'}

					<div class={classes}>
						{#if !isEmptyDay && !isFuturePaddingDay}
							<div class="date-number">{dateNumber}</div>
						{/if}
						{#if isWalkDay}
							{walkDayContent}
							<div style="display: flex">
								{#each d.walks as { directions, videoId }, widx}
									<div style="display: flex; font-size: 0.8em; flex-direction: column">
										{#if directions}
											<a
												href={directions}
												noreferrer
												noopener
												style="text-decoration: none"
												target="_blank"
												title={`Walk ${widx + 1} Route`}
											>
												🗺️
											</a>
										{/if}
										{#if videoId}
											<a
												href={`https://youtu.be/${videoId}`}
												noreferrer
												noopener
												style="text-decoration: none"
												target="_blank"
												title={`Walk ${widx + 1} Video`}
											>
												🎥
											</a>
										{/if}
									</div>
								{/each}
							</div>
						{:else if isPendingDay}
							{`Sun sets at ${sunsetTime}`}
						{/if}
					</div>
				{/each}
			</div>

			<div transition:fade style="font-size: 0.66em">
				Sunset data provided by <a target="_blank" href="https://api.sunrise-sunset.org">api.sunrise-sunset.org</a>
			</div>
		{/if}
	{:else}
		<Circle />
	{/if}
</div>

<style>
	@media (max-width: 1000px) {
		.day {
			height: 96px;
			width: 96px;
		}

		.date-number {
			left: 0.1em;
			top: 0.1em;
		}
	}

	@media (min-width: 1001px) {
		.day {
			height: 96px;
			width: 96px;
		}

		.date-number {
			left: 0.1em;
			top: 0.1em;
		}
	}

	.day {
		align-items: center;
		border: 1px solid black;
		display: flex;
		flex-direction: column;
		font-size: 1rem;
		justify-content: center;
		position: relative;
	}

	.date-number {
		font-size: 0.75rem;
		position: absolute;
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
		justify-content: center;
		text-align: center;

		height: 100%;
		width: 100%;
	}

	#wrapper {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
		grid-gap: 1px;
	}

</style>