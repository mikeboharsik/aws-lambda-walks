<script>
	import { onMount } from "svelte";
	import { Circle } from "svelte-loading-spinners";
	import Chart from "chart.js/auto";

	import { getGlobalStats } from "../util/api";

	import { GLOBAL_STATS_DATA } from "../stores.js";

	let isLoaded = false;

	let tab = null;

	let globalStatsData;
	GLOBAL_STATS_DATA.subscribe((val) => (globalStatsData = val));

	let chart;

	onMount(async () => {
		const initialDataJobs = [getGlobalStats()];

		try {
			const results = await Promise.allSettled(initialDataJobs);

			const [{ value: globalStatsResult }] = results;

			GLOBAL_STATS_DATA.update(() => globalStatsResult);
		} catch (e) {
			console.error(e);
		} finally {
			isLoaded = true;
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
					tab = "walk distance";
					chart?.destroy();
					chart = new Chart(document.getElementById("testChart"), {
						type: "bar",
						data: {
							labels: ["Mean", "Median", "Total"],
							datasets: [
								{
									label: "Distance in miles",
									data: [
										(globalStatsData.meanWalkDistance / 1609).toFixed(2),
										(globalStatsData.medianWalkDistance / 1609).toFixed(2),
										(globalStatsData.totalDistance / 1609).toFixed(2),
									],
								},
							],
						},
						options: {
							scales: {
								y: {
									type: "logarithmic",
								},
							},
						},
					});
				}}>Walk distance</span
			>
			|
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<span
				on:click={() => {
					tab = "towns";
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
				}}
				style="cursor: pointer">Towns</span
			>
		</div>
		{#if tab === "walk distance"}
			<div style="width: 540px; margin-top: 3em">
				Summary across {globalStatsData.totalWalks} walks
			</div>
		{:else if tab === "towns"}
			<div style="width: 540px; margin-top: 3em">
				Summary across {globalStatsData.totalWalks} walks
			</div>
		{/if}
		<canvas style={isLoaded ? "opacity: 1" : "opacity: 0"} id="testChart"
		></canvas>
	{:else}
		<div style="position: absolute; left: 50%; top: 50%">
			<Circle />
		</div>
	{/if}
</div>

<style>
</style>
