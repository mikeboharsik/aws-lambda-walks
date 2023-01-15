<script>
	import { fade } from 'svelte/transition';
</script>

<div transition:fade id="container-sunsetapisourceattribution">
	Sunset data provided by <a target="_blank" href="https://api.sunrise-sunset.org">api.sunrise-sunset.org</a>
</div>

<style>
	@media (prefers-color-scheme: dark) {
		a {
			color: #66f;
		}

		a:visited {
			color: #66f;
		}

		#container-sunsetapisourceattribution {
			text-shadow: black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px, black 0px 0px 4px;
		}
	}

	@media (prefers-color-scheme: light) {
		a {
			color: navy;
		}

		a:visited {
			color: navy;
		}

		#container-sunsetapisourceattribution {
			text-shadow: white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px, white 0px 0px 4px;
		}
	}

	div {
		backdrop-filter: blur(4px);
		border-radius: 4px;
		padding: 4px;
		font-size: 0.66em;
	}
</style>
