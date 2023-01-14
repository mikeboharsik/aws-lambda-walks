<script>
	import { fade } from 'svelte/transition';

	export let data;

	const thumbnailWidth = 120;
	const thumbnailHeight = 90;
	const marginX = 4;
	const marginY = 4;
	const paddingX = 2;
	const paddingY = 2;
	const newImageInterval = 5000;

	let imageCountX = 0;
	let imageCountY = 0;
	let imageCells;
	let lastFrameTime = 0;

	let intervalRef;
	let allVideoIds = [];
	let thumbnailCache = {};

	const offset = 32;
	const darkModeColor = `${offset}, ${offset}, ${offset}`;
	const lightModeColor = `${256 - offset}, ${256 - offset}, ${256 - offset}`;
	let backgroundColor = window.matchMedia('(prefers-color-scheme: dark)').matches ? darkModeColor : lightModeColor;

	window.matchMedia('(prefers-color-scheme: dark)')
		.addEventListener('change', event => {
			if (event.matches) {
				backgroundColor = darkModeColor;
			} else {
				backgroundColor = lightModeColor;
			}
		});

	async function getBitmapForThumbnail(videoId) {
		if (!videoId) {
			throw new Error("Cannot fetch a thumbnail for an undefined video");
		}

		const cached = thumbnailCache[videoId];
		if (cached) {
			return cached;
		}

		return await fetch(`https://walks.mikeboharsik.com/api/yt-thumbnail?videoId=${videoId}`)
			.then(res => res.blob())
			.then(imgData => createImageBitmap(imgData));
	}

	function populateImageArray() {
		const initImageCountX = imageCountX;
		const initImageCountY = imageCountY;

		imageCountX = Math.floor((window.innerWidth - (marginX * 2)) / (thumbnailWidth + paddingX));
		imageCountY = Math.floor((window.innerHeight - (marginY * 2)) / (thumbnailHeight + paddingY));

		if (initImageCountX === imageCountX && initImageCountY === imageCountY) {
			return;
		}

		imageCells = new Array(imageCountX);
		for (let i = 0; i < imageCountX; i++) {
			imageCells[i] = new Array(imageCountY);
			for (let j = 0; j < imageCountY; j++) {
				imageCells[i][j] = {};
			}
		}
	}

	function draw(ts) {
		const canvas = document.getElementById('canvas');
		const ctx = canvas.getContext('2d');

		ctx.save();
		ctx.fillStyle = `rgb(${backgroundColor})`;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.restore();

		for (let x = 0; x < imageCountX; x++) {
			for (let y = 0; y < imageCountY; y++) {
				try {
					const { image, start } = imageCells[x][y];

					if (image && start) {
						const imageX = marginX + x * thumbnailWidth + x;
						const imageY = marginY + y * thumbnailHeight + y;

						ctx.drawImage(image, imageX, imageY);
						
						const alpha = Math.abs(Math.sin((ts - start) / 10000));
						ctx.fillStyle = `rgba(${backgroundColor}, ${alpha})`;
						ctx.fillRect(imageX, imageY, thumbnailWidth, thumbnailHeight);
					}
				} catch(e) {
					console.error(e, x, y, imageCountX * x + y);
					throw e;
				}
			}
		}

		lastFrameTime = ts;

		window.requestAnimationFrame(draw);
	}

	async function setupCanvas() {
		const canvas = document.getElementById('canvas');
		canvas.height = window.innerHeight;
		canvas.width = window.innerWidth;

		populateImageArray();

		allVideoIds = data.reduce((acc1, day) => [...acc1, ...day.walks.reduce((acc2, walk) => [...acc2, walk.videoId], [])], []);

		window.requestAnimationFrame(draw);

		addEventListener("resize", () => {
			canvas.height = window.innerHeight;
			canvas.width = window.innerWidth;

			populateImageArray();
			draw();

			clearInterval(intervalRef);
			intervalRef = setInterval(startRandomImage, newImageInterval);
		});
		
		function getRandomWithMax(max) {
			return Math.floor(Math.random() * max);
		}

		async function startRandomImage() {
			if (allVideoIds.length <= 0) {
				console.log('All videos have been fetched!');
				return;
			}

			const candidates = imageCells.flat().filter(cell => !cell.start);
			// TODO: what if there are no remaining candidates?

			const cell = candidates[getRandomWithMax(candidates.length)];

			if (cell) {
				let availableVideoIds = allVideoIds.filter(videoId => !Object.keys(thumbnailCache).includes(videoId));
				if (availableVideoIds.length <= 0) {
					console.log('Ran out of thumbnails to fetch, falling back to cached images');
					availableVideoIds = Object.keys(thumbnailCache);
				}

				const vidIdx = getRandomWithMax(availableVideoIds.length);
				const vidId = availableVideoIds[vidIdx];

				cell.image = await getBitmapForThumbnail(vidId);
				cell.start = performance.now();

				thumbnailCache[vidId] = cell.image;
			} else {
				console.log('it fucked up with index', cell, imageCells);
			}
		}

		intervalRef = setInterval(startRandomImage, newImageInterval);
	}

	$: {
		if (data?.length) {
			setupCanvas();
		}
	}
</script>

<canvas
	style="position: absolute; z-index: -1000;"
	transition:fade
	id="canvas"
	on:click={(e) => console.log(e)}
>
</canvas>

<style>

</style>
