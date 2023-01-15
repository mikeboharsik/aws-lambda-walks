<script>
	import { fade } from 'svelte/transition';

	export let currentMonthData = [];
	export let currentDate;
	export let firstDayOffset;
	export let isRealMonth;
	export let daysInMonth;
	export let sunsetTime;

	const dayNames = [
		'Su',
		'Mo',
		'Tu',
		'We',
		'Th',
		'Fr',
		'Sa'
	];

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
</script>

<div transition:fade id="wrapper">
	{#each dayNames as day}
		<h5>{day}</h5>
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

<style>
	@media (prefers-color-scheme: dark) {
		h5 {
			text-shadow: black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px; user-select: none
		}

		.day {
			background-color: #777;
			border: 1px solid #aaa;
			color: #333;
		}

		.non-walk-day {
			background-color: #f99;
		}
		.walk-day {
			background-color: #9f9;
		}
		.pending-day {
			background-color: #ff9;
		}
	}

	@media (prefers-color-scheme: light) {
		h5 {
			text-shadow: white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px; user-select: none;
		}

		.day {
			background-color: #eee;
			border: 1px solid black;
		}

		.non-walk-day {
			background-color: #faa;
		}
		.walk-day {
			background-color: #afa;
		}
		.pending-day {
			background-color: #ffa;
		}
	}

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

	#wrapper {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
		grid-gap: 1px;
	}

	.day {
		align-items: center;
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
		display: inline;
		text-align: left;
	}

	.future-padding-day {
		visibility: hidden;
	}

	
</style>