<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import debug from 'debug';

	import { baseApiUrl } from '../constants/api';

	const log = debug('ThumbnailGrid');

	const thumbnailWidth = 160;
	const thumbnailHeight = 90;

	const marginX = 4;
	const marginY = 4;
	const paddingX = 2;
	const paddingY = 2;

	const imageFadeTime = 15000;
	const newImageInterval = parseInt((1/9) * imageFadeTime);

	let imageCountX = 0;
	let imageCountY = 0;
	let imageCells;
	let lastFrameTime = 0;

	let intervalRef;
	let allVideoIds = [];
	let thumbnailCache = {};

	let isTabInFocus = true;
	let lastPausedTime = null;
	let populateImageGridCellLastLog = null;

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

	window.addEventListener('blur', () => { isTabInFocus = false; lastPausedTime = performance.now(); });
	window.addEventListener('focus', () => { isTabInFocus = true; });

	async function getBitmapForThumbnail(videoId) {
		if (!videoId) {
			throw new Error("Cannot fetch a thumbnail for an undefined video");
		}

		const cached = thumbnailCache[videoId];
		if (cached) {
			return cached;
		}

		return await fetch(`${baseApiUrl}/yt-thumbnail?videoId=${videoId}`)
			.then(res => res.blob())
			.then(imgData => createImageBitmap(imgData));
	}

	function populateImageArray() {
		const calendarContainer = document.querySelector('#container-walkcalendar');
		if (!calendarContainer) {
			log('Failed to find the calendar container');
			return;
		}

		const calendarBoundingRect = calendarContainer.getBoundingClientRect();

		const initImageCountX = imageCountX;
		const initImageCountY = imageCountY;

		imageCountX = Math.floor((window.innerWidth - (marginX * 2)) / (thumbnailWidth + paddingX));
		imageCountY = Math.floor((window.innerHeight - (marginY * 2)) / (thumbnailHeight + paddingY));

		if (initImageCountX === imageCountX && initImageCountY === imageCountY) {
			return;
		}

		imageCells = new Array(imageCountX);
		for (let x = 0; x < imageCountX; x++) {
			imageCells[x] = new Array(imageCountY);
			for (let y = 0; y < imageCountY; y++) {
				const posX = marginX + x * thumbnailWidth + x;
				const posY = marginY + y * thumbnailHeight + y;

				const isHidden = posX + thumbnailWidth >= calendarBoundingRect.left && posX <= calendarBoundingRect.right;

				imageCells[x][y] = {
					isPointInside: function(inX, inY) {
						let withinXBounds = inX > posX && inX < posX + thumbnailWidth;
						let withinYBounds = inY > posY && inY < posY + thumbnailHeight;

						return withinXBounds && withinYBounds;
					},
					isHidden,
					posX,
					posY,
				};
			}
		}
	}

	function handleCanvasClick(e) {
		e.prev

		const { x, y } = e;

		const hit = imageCells.flat().find(({ isHidden, isPointInside, videoId }) => !isHidden && videoId && isPointInside(x, y));
		if (hit) {
			window.open(`https://youtu.be/${hit.videoId}`, '_blank', 'noopener');
		}
	}

	function draw(ts) {
		if (!isTabInFocus) {
			if (!populateImageGridCellLastLog || new Date().getTime() - populateImageGridCellLastLog > 1000) {
				log('Skipping draw as tab is not in focus');
				populateImageGridCellLastLog = new Date().getTime();
			}
			return window.requestAnimationFrame(draw);
		}

		let dt;
		if (lastPausedTime) {
			const timePaused = ts - lastPausedTime;
			dt = parseInt(ts - lastFrameTime - timePaused);
			lastPausedTime = null;
			log(`Set dt to ${dt} based on lastPausedTime`);
		} else {
			dt = parseInt(ts - lastFrameTime);
		}

		const canvas = document.getElementById('canvas');
		let ctx;
		try {
			ctx = canvas.getContext('2d');
		} catch (e) {
			return;
		}

		ctx.save();
		ctx.fillStyle = `rgba(${backgroundColor}, 255)`;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.restore();

		for (let x = 0; x < imageCountX; x++) {
			for (let y = 0; y < imageCountY; y++) {
				try {
					const curCell = imageCells[x][y];
					const { image, posX, posY, timeLeft } = curCell;

					if (image && timeLeft) {
						// multiply by 2 since we want to use the entire loaded image but scale it to half its size, which is the thumbnail width and height
						ctx.drawImage(image, 0, 0, thumbnailWidth * 2, thumbnailHeight * 2, posX, posY, thumbnailWidth, thumbnailHeight);

						ctx.save();
						const alpha = (imageFadeTime - timeLeft) / imageFadeTime;
						ctx.fillStyle = `rgba(${backgroundColor}, ${alpha})`;
						ctx.fillRect(posX, posY, thumbnailWidth, thumbnailHeight);
						ctx.restore();

						curCell.timeLeft -= dt;

						if (curCell.timeLeft <= 0) {
							curCell.image = null;
							curCell.timeLeft = null;
							curCell.videoId = null;
						}
					}
				} catch(e) {
					log(e, x, y, imageCountX * x + y);
					throw e;
				}
			}
		}

		lastFrameTime = ts;

		window.requestAnimationFrame(draw);
	}

	function getRandomWithMax(max) {
		return Math.floor(Math.random() * max);
	}

	async function populateImageGridCell() {
		if (!isTabInFocus) {
			log('Skipping populateImageGridCell as tab is not in focus');
			return;
		}

		if (allVideoIds.length <= 0) {
			return;
		}

		const candidates = imageCells.flat().filter(({ isHidden, timeLeft }) => !isHidden && !timeLeft);
		// TODO: what if there are no remaining candidates?

		const cell = candidates[getRandomWithMax(candidates.length)];

		if (cell) {
			let availableVideoIds = allVideoIds.filter(videoId => !Object.keys(thumbnailCache).includes(videoId));
			if (availableVideoIds.length <= 0) {
				console.debug('Ran out of thumbnails to fetch, falling back to cached images');
				availableVideoIds = Object.keys(thumbnailCache);
			}

			const vidIdx = getRandomWithMax(availableVideoIds.length);
			const vidId = availableVideoIds[vidIdx];

			cell.image = await getBitmapForThumbnail(vidId);
			cell.timeLeft = imageFadeTime;
			cell.videoId = vidId;

			thumbnailCache[vidId] = cell.image;
		} else {
			log('bad index', cell, imageCells);
		}
	}

	async function setupCanvas() {
		const canvas = document.getElementById('canvas');
		if (!canvas) {
			log('Failed to get canvas');
			return;
		}

		canvas.height = window.innerHeight;
		canvas.width = window.innerWidth;

		populateImageArray();

		allVideoIds = await fetch(`${baseApiUrl}/youtubeIds`).then(res => res.json());

		window.requestAnimationFrame(draw);

		addEventListener("resize", () => {
			canvas.height = window.innerHeight;
			canvas.width = window.innerWidth;

			populateImageArray();
			draw();

			clearInterval(intervalRef);
			intervalRef = setInterval(populateImageGridCell, newImageInterval);
		});

		clearInterval(intervalRef);
		intervalRef = setInterval(populateImageGridCell, newImageInterval);
	}

	onMount(() => {
		setupCanvas();
	});
</script>

<canvas
	style="position: absolute; top: 0; left: 0;"
	transition:fade
	id="canvas"
	on:click={handleCanvasClick}
>
</canvas>

<style>
</style>
