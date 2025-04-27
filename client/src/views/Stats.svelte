<script>
	import { onMount } from "svelte";
	import { Circle } from "svelte-loading-spinners";
	import Chart from "chart.js/auto";

	import { getGlobalStats } from "../util/api";
	import { waitForElement } from '../util/waitForElement';

	import { GLOBAL_STATS_DATA } from "../stores.js";

	const TABS = {
		WALK_DISTANCE: 'WALK_DISTANCE',
		TOWNS: 'TOWNS',
	};

	let isLoaded = false;

	let tab = TABS.WALK_DISTANCE;

	let globalStatsData;
	GLOBAL_STATS_DATA.subscribe((val) => (globalStatsData = val));

	let chart;

	function buildDistanceChart() {
		chart?.destroy();
		waitForElement('#testChart').then(() => {
			chart = new Chart(document.getElementById("testChart"), {
				type: "bar",
				data: {
					labels: ["Mean", "Median"],
					datasets: [
						{
							label: "Distance in miles",
							data: [
								(globalStatsData.meanWalkDistance / 1609).toFixed(2),
								(globalStatsData.medianWalkDistance / 1609).toFixed(2),
							],
						},
					],
				},
				options: {
					scales: {
						y: {
							type: "linear",
						},
					},
				},
			});
		});
	}

	function buildTownsChart() {
		const data = Object.keys(globalStatsData.towns).reduce(
			(acc, state) => {
				const townsInState = Object.keys(globalStatsData.towns[state]);
				townsInState.forEach(
					(town) =>
						(acc[`${town}, ${state}`] =
							globalStatsData.towns[state][town]),
				);
				return acc;
			},
			{},
		);
		chart?.destroy();
		waitForElement('#testChart').then(() => {
			chart = new Chart(document.getElementById("testChart"), {
				type: "pie",
				data: {
					labels: Object.keys(data),
					datasets: [
						{
							label: "Town",
							data: Object.values(data),
						},
					],
				},
			});
		});
	}

	onMount(async () => {
		const initialDataJobs = [getGlobalStats()];

		try {
			const results = await Promise.allSettled(initialDataJobs);

			const [{ value: globalStatsResult }] = results;

			GLOBAL_STATS_DATA.update(() => globalStatsResult);

			buildDistanceChart();
		} catch (e) {
			console.error(e);
		} finally {
			isLoaded = true;
			globalStatsData = globalStatsData;
		}
	});
</script>

<div>
	{#if isLoaded}
		<div>
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span
				style="cursor: pointer"
				on:click={() => {
					if (tab !== TABS.WALK_DISTANCE) {
						tab = TABS.WALK_DISTANCE;
						buildDistanceChart();
					}
				}}>Walk distance</span
			>
			|
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span
				on:click={() => {
					if (tab !== TABS.TOWNS) {
						tab = TABS.TOWNS;
						buildTownsChart();
					}
				}}
				style="cursor: pointer">Towns</span
			>
		</div>
		{#if tab === TABS.WALK_DISTANCE}
			<div style="width: 540px; margin-top: 3em">
				Summary across {globalStatsData.totalWalks} walks
				<br>
				Total distance: {(globalStatsData.totalDistance / 1609).toFixed(2)} miles
			</div>
		{:else if tab === TABS.TOWNS}
			<div style="width: 540px; margin-top: 3em">
				Summary across {globalStatsData.totalWalks} walks
			</div>
		{/if}
		<canvas style={isLoaded ? "opacity: 1" : "opacity: 0"} id="testChart"></canvas>
	{:else}
		<div style="position: absolute; left: 50%; top: 50%">
			<Circle />
		</div>
	{/if}
</div>

<style>
</style>
