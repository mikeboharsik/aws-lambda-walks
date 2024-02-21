<script>
  function getDisplayText(timestamp, withoutMillseconds = false) {
    const hours = (Math.floor(timestamp / (1000 * 60 * 60))).toString().padStart(2, '0');
    const minutes = (Math.floor(timestamp / (1000 * 60)) % 60).toString().padStart(2, '0');
    const seconds = (Math.floor(timestamp / 1000) % 60).toString().padStart(2, '0');
    const milliseconds = (Math.floor(timestamp % 1000)).toString().padStart(3, '0');
    
    return withoutMillseconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  function getClockText() {
    const d = new Date();

    const year = d.getFullYear().toString();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const date = d.getDate().toString().padStart(2, '0');
    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    const millisecond = d.getMilliseconds().toString().padStart(3, '0');

    return `${hour}:${minute}:${second}.${millisecond}`;
  }

  const persistInit = localStorage.getItem('state');
  let persist = persistInit ? JSON.parse(persistInit) : {
    running: false,
    marks: [],
    elapsed: 0
  }

  let lastMsSinceInit = 0;
  let lastTimestamp = parseInt(localStorage.getItem('lastTimestamp') ?? new Date().getTime());
  
  $: clockText = getClockText();
  $: stopwatchText = getDisplayText(persist.elapsed);

  function update(msSinceInit) {
    if (persist.running) {
      persist.elapsed += msSinceInit - lastMsSinceInit;
    }

    lastMsSinceInit = msSinceInit;

    clockText = getClockText();
    stopwatchText = getDisplayText(persist.elapsed);

    requestAnimationFrame(update);
  }

  update(0);
</script>

<main>
  <div id="clock">{clockText}</div>
  <div id="stopwatch">{stopwatchText}</div>

  <button id="toggleButton" on:click={() => persist.running = !persist.running}>Start</button>
</main>

<style>
  
</style>
