<script>
	import { EVENTS_DATA } from '../stores.js';

	import StatusBar from '../components/StatusBar.svelte';
	import SunsetApiSourceAttribution from '../components/SunsetApiSourceAttribution.svelte';
	import ThumbnailGrid from '../components/ThumbnailGrid.svelte';
	import WalkCalendar from '../components/WalkCalendar.svelte';

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

	function getCurrentMonthData() {
			const maxWeeksInDays = 6 * 7; // always make table have the maximum amount of cells so that changing month does not change the layout due to more/less rows existing
			const toAdd = maxWeeksInDays - (daysInMonth + firstDayOffset);
			const newCurrentMonthData = Array.from(new Array(daysInMonth + firstDayOffset + toAdd));

			const searchPattern = new RegExp(`${now.getFullYear()}-${currentMonth}-\\d{2}`);
			const matches = eventsData.filter(e => e.date.match(searchPattern));

			newCurrentMonthData.forEach((e, i, a) => {
				const dayIsInMonth = i > (firstDayOffset - 1);
				if (dayIsInMonth) {
					const corresponding = matches.filter(e => parseInt(e.date.slice(-2)) === (i - (firstDayOffset - 1)));
					if (corresponding) {
						a[i] = corresponding;
					}
				}
			});

			return newCurrentMonthData;
		}

	let now = new Date();
	const humanMonthNumber = now.getMonth() + 1;
	const realMonth = humanMonthNumber < 10 ? '0' + (now.getMonth() + 1) : humanMonthNumber.toString();
	const currentDate = now.getDate();
	
	let currentMonthData = [];
	let currentMonth;
	let firstDayOffset;
	let daysInMonth;
	let isRealMonth;

	let eventsData = null;
	EVENTS_DATA.subscribe(val => eventsData = val);

	$: {
		eventsData = eventsData;
		let tempHumanMonthNumber = now.getMonth() + 1;
		currentMonth = tempHumanMonthNumber < 10 ? '0' + tempHumanMonthNumber : tempHumanMonthNumber.toString();
		firstDayOffset = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
		daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

		currentMonthData = getCurrentMonthData();
		isRealMonth = new Date().getFullYear() === now.getFullYear() && currentMonth === realMonth;
	}
</script>

{#if !navigator?.userAgentData?.mobile}
	<ThumbnailGrid />
{/if}

<StatusBar bind:now {currentMonthData} {currentMonth} {isRealMonth} {monthNames} {realMonth} />

<WalkCalendar {currentMonthData} {currentDate} {firstDayOffset} {isRealMonth} {daysInMonth} />

<SunsetApiSourceAttribution />
