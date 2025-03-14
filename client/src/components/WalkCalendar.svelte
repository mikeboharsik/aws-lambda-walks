<script>
	import { fade } from 'svelte/transition';

	import { toFixedDefault } from '../constants/config';
	import { EVENTS_DATA_IN_PROGRESS, SUNX_DATA } from '../stores.js';

	import { getPaddedDateString, getPaddedTimeString } from '../util/date';

	export let currentMonthData = [];
	export let currentDate;
	export let firstDayOffset;
	export let isRealMonth;
	export let daysInMonth;

	let sunxData = null;
	SUNX_DATA.subscribe(val => sunxData = val);

	let eventsDataInProgress = false;
	EVENTS_DATA_IN_PROGRESS.subscribe(val => eventsDataInProgress = val);

	const now = new Date();
	const todaySunrise = new Date(sunxData.today.sunrise);
	const todaySunset = new Date(sunxData.today.sunset);
	const tomorrowSunrise = new Date(sunxData.tomorrow.sunrise);

	const isPastTodaySunrise = now > todaySunrise;

	const didWalkToday = !!currentMonthData.find((dayData) => dayData?.date === getPaddedDateString(now));

	const dayNames = [
		'Su',
		'Mo',
		'Tu',
		'We',
		'Th',
		'Fr',
		'Sa'
	];

	function getDayClasses({ isEmptyDay, isFutureDay, isFuturePaddingDay, isPendingDay, isTomorrow, isWalkDay }) {
		let classes = ['day'];

		if (eventsDataInProgress) {
			// do not push classes
		}
		else if (isPendingDay || didWalkToday && isTomorrow) {
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
		try {
			return ((currentMonthData
				.find(dayData => dayData?.some(e => e.date === date))
				.reduce((acc, { distance }) => { return acc + (distance ?? 0); }, 0)) / 1609).toFixed(toFixedDefault);
		}	catch(e) {
			console.error(e);
			return null;
		}
	}

	$: {
		// console.log({ currentMonthData });
	}
</script>

<div transition:fade id="container-walkcalendar">
	{#each dayNames as day}
		<h5>{day}</h5>
	{/each}

	{#each currentMonthData as dayData, idx}
		{@const dateNumber = idx - firstDayOffset + 1}
		{@const currentDateIdx = currentDate + firstDayOffset - 1}
		{@const isCurrentDate = idx === currentDateIdx}

		{@const isEmptyDay = idx < firstDayOffset}
		{@const isFutureDay = isRealMonth && idx > currentDateIdx}
		{@const isTomorrow = isRealMonth && idx === currentDateIdx + 1}
		{@const isPendingDay = isRealMonth && isCurrentDate && !dayData?.length}
		{@const isWalkDay = !!dayData?.length}
		{@const isFuturePaddingDay = idx > daysInMonth + firstDayOffset - 1}

		{@const classes = getDayClasses({ isEmptyDay, isFutureDay, isFuturePaddingDay, isPendingDay, isTomorrow, isWalkDay })}

		{@const dateDistanceSum = dayData?.[0]?.date ? getDateDistanceSum(dayData?.[0]?.date) : null}
		{@const walkDayContent = dateDistanceSum === null ? null : `${dateDistanceSum} miles`}

		<div class={classes}>
			{#if !isEmptyDay && !isFuturePaddingDay}
				<div class="date-number">{dateNumber}</div>
			{/if}
			{#if isWalkDay}
				<div style={`opacity: ${walkDayContent ? 1 : 0}`}>{walkDayContent}</div>
				<div style="display: flex">
					{#each dayData as walk}
						<div style="display: flex; font-size: 0.8em; flex-direction: column">
							<a
								href={`https://walks.mikeboharsik.com/api/routes?date=${walk.date}`}
								noreferrer
								noopener
								style="text-decoration: none"
								target="_blank"
								title={`Walk Route`}
							>
								🗺️
							</a>

							{#if walk.youtubeId}
								<a
									href={`https://youtu.be/${walk.youtubeId}`}
									noreferrer
									noopener
									style="text-decoration: none"
									target="_blank"
									title={`Walk Video`}
								>
									🎥
								</a>
							{/if}
						</div>
					{/each}
				</div>
			{:else if isPendingDay && !isPastTodaySunrise}
				{`Sun rises at ${getPaddedTimeString(todaySunrise)}`}
			{:else if isPendingDay}
				{`Sun sets at ${getPaddedTimeString(todaySunset)}`}
			{:else if didWalkToday && isTomorrow}
				{`Sun rises at ${getPaddedTimeString(tomorrowSunrise)}`}
			{/if}
		</div>
	{/each}
</div>

<style>
	@media (prefers-color-scheme: dark) {
		h5 {
			color: white;
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

	#container-walkcalendar {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
		grid-gap: 1px;
		z-index: 1;
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
