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

    const hour = d.getHours().toString().padStart(2, '0');
    const minute = d.getMinutes().toString().padStart(2, '0');
    const second = d.getSeconds().toString().padStart(2, '0');
    const millisecond = d.getMilliseconds().toString().padStart(3, '0');

    return `${hour}:${minute}:${second}.${millisecond}`;
  }

  function getInitialState() {
    const init = localStorage.getItem('state');
    if (init) {
      return JSON.parse(init);
    }

    return {
      running: false,
      marks: [],
      elapsed: 0
    };
  }

  function getInitialLastTimestamp() {
    return parseInt(localStorage.getItem('lastTimestamp') ?? new Date().getTime());
  }

  const markButtons = [
    { label: 'Plate', name: 'SKIP Plate' },
    { label: 'Lane change', name: 'Driver changes lane without signal' },
    { label: 'No signal turn', name: 'Driver turns without signal' },
    { label: 'Stop sign', name: 'Driver runs stop sign' },
    { label: 'Red light', name: 'Driver runs red light' },
    { label: 'Wrong park', name: 'Car parked on wrong side of road'},
    { label: 'Speeder', name: 'Speeding driver'},
    { label: 'Block turn', name: 'Driver blocks turn area' },    
    { label: 'Good look', name: 'Good driver looks before turning' },
    { label: 'Bad look', name: 'Bad driver does not look before turning' },
    { label: 'Misc', name: 'Misc' },
  ];

  let state = getInitialState();

  let lastMsSinceInit = 0;
  let lastTimestamp = getInitialLastTimestamp();
  
  if (state.running) {
    state.elapsed += (new Date().getTime() - lastTimestamp);
  }

  $: clockText = getClockText();
  $: stopwatchText = getDisplayText(state.elapsed);

  function download(filename) {
    const copy = JSON.parse(JSON.stringify(state.marks));
    copy.forEach((m) => {
      delete m.id;
      m.mark = getDisplayText(m.mark);
    });
    const json = JSON.stringify(copy);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function updateStorage(ignoreRunning = false) {
    localStorage.setItem('lastTimestamp', lastTimestamp);
    if (state.running || ignoreRunning) {
      localStorage.setItem('state', JSON.stringify(state));
    }
  }

  function handleToggleClick() {
    state.running = !state.running;
    updateStorage(true);
  }

  function handleExportClick() {
    download(`events_${new Date().getTime()}.json`);
  }

  function handleResetClick() {
    state.marks = [];
    state.elapsed = 0;
    state.running = false;
    updateStorage(true);
  }

  function addMark(name = 'SKIP') {
    state.marks.push({ id: crypto.randomUUID().toUpperCase(), mark: state.elapsed, name, plate: '' });
  }

  function getMarkHandler(name) {
    return () => addMark(name);
  }

  function getNameChangeHandler(id) {
    return (e) => {
      const target = state.marks.find(e => e.id === id);
      target.name = e.target.value;
    }
  }

  function update(msSinceInit) {
    if (state.running) {
      const dt = msSinceInit - lastMsSinceInit;

      state.elapsed += dt;
    }

    lastMsSinceInit = msSinceInit;
    lastTimestamp = new Date().getTime();

    clockText = getClockText();
    stopwatchText = getDisplayText(state.elapsed);

    updateStorage();
    requestAnimationFrame(update);
  }

  update(0);
</script>

<main>
  <h1>{clockText}</h1>
  <h1>{stopwatchText}</h1>

  <p>
    <button on:click={handleToggleClick}>{state.running ? 'Stop' : 'Start'}</button>
    <button on:click={handleExportClick}>Export</button>
    <button on:click={handleResetClick}>Reset</button>
  </p>
  <p>
    {#each markButtons as markButton}
      <button on:click={getMarkHandler(markButton.name)} disabled={!state.running}>{markButton.label}</button>
    {/each}
  </p>

  <ol reversed style={'text-align: left; font-size: 16px'}>
    {#each state.marks.toReversed() as mark}
      <li>{getDisplayText(mark.mark)} - <input type="text" value={mark.name} on:change={getNameChangeHandler(mark.id)}/></li>
    {/each}
  </ol>
</main>

<style>
  
</style>
