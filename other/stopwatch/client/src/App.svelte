<script>
  let lastTimestamp = parseInt(localStorage.getItem('lastTimestamp') ?? new Date().getTime());

  let isTestUpload = false;

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
  let state = getInitialState();
  if (state.running) {
    state.elapsed += (new Date().getTime() - lastTimestamp);
  }

  let lastMsSinceInit = 0;

  $: clockText = getClockText();
  $: stopwatchText = getDisplayText(state.elapsed);
  $: isUploading = false;

  function getDisplayText(timestamp, withoutMillseconds = false) {
    if (timestamp === undefined) {
      return '';
    }

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

  const EVENT_TYPE = {
    BEGIN: 'BEGIN',
    CROSSWALK: 'CROSSWALK',
    END: 'END',
    LANE_CHANGE_WITHOUT_SIGNAL: 'LANE_CHANGE_WITHOUT_SIGNAL',
    LOOK_BAD: 'LOOK_BAD',
    LOOK_GOOD: 'LOOK_GOOD',
    MISC: 'MISC',
    PARKED_ON_WRONG_SIDE: 'PARKED_ON_WRONG_SIDE',
    PLATE: 'PLATE',
    PLATE_MA: 'PLATE_MA',
    PLATE_ME: 'PLATE_ME',
    PLATE_NH: 'PLATE_NH',
    RED_LIGHT_RUN: 'RED_LIGHT_RUN',
    SPACE: 'SPACE',
    SPEEDER: 'SPEEDER',
    STOP_SIGN_RUN: 'STOP_SIGN_RUN',
    TAG: 'TAG',
    TURN_AREA_BLOCK: 'TURN_AREA_BLOCK',
    TURN_WITHOUT_SIGNAL: 'TURN_WITHOUT_SIGNAL',
  };

  const markButtons = [
    { label: 'Plate MA', type: EVENT_TYPE.PLATE_MA },
    { label: 'Plate NH', type: EVENT_TYPE.PLATE_NH },
    { label: 'Plate ME', type: EVENT_TYPE.PLATE_ME },
    { label: 'Plate', type: EVENT_TYPE.PLATE },
    { label: 'Lane change', name: 'Driver changes lane without signal', type: EVENT_TYPE.LANE_CHANGE_WITHOUT_SIGNAL },
    { label: 'No signal turn', name: 'Driver turns without signal', type: EVENT_TYPE.TURN_WITHOUT_SIGNAL },
    { label: 'Stop sign', name: 'Driver runs stop sign', type: EVENT_TYPE.STOP_SIGN_RUN },
    { label: 'Red light', name: 'Driver runs red light', type: EVENT_TYPE.RED_LIGHT_RUN },
    { label: 'Space', name: 'Driver wastes space', type: EVENT_TYPE.SPACE },
    { label: 'Crosswalk', name: 'Driver blocks crosswalk', type: EVENT_TYPE.CROSSWALK },
    { label: 'Wrong park', name: 'Car parked on wrong side of road', type: EVENT_TYPE.PARKED_ON_WRONG_SIDE },
    { label: 'Speeder', name: 'Speeding driver', type: EVENT_TYPE.SPEEDER },
    { label: 'Block turn', name: 'Driver blocks turn area', type: EVENT_TYPE.TURN_AREA_BLOCK },    
    { label: 'Look good', name: 'Good driver looks before turning', type: EVENT_TYPE.LOOK_GOOD },
    { label: 'Look bad', name: 'Bad driver does not look before turning', type: EVENT_TYPE.LOOK_BAD },
    { label: 'Tag', type: EVENT_TYPE.TAG },
    { label: 'Misc', name: '', type: EVENT_TYPE.MISC },
  ];

  async function getExportContent(coords) {
    const copy = JSON.parse(JSON.stringify(state.marks));

    const beginEvent = copy.find(m => m.type === EVENT_TYPE.BEGIN);
    const endEvent = copy.find(m => m.type === EVENT_TYPE.END);

    const startMark = getDisplayText(beginEvent?.mark);
    const endMark = getDisplayText(endEvent?.mark);

    const startTime = beginEvent?.datetime;
    const endTime = endEvent?.datetime;

    copy.forEach((m) => {
      m.mark = getDisplayText(m.mark);
      if (m.name) {
        m.name = m.name.trim();
      }

      switch(m.type) {
        case EVENT_TYPE.BEGIN:
        case EVENT_TYPE.END:
        case EVENT_TYPE.PLATE:
        case EVENT_TYPE.TAG: {
          break;
        }
        case EVENT_TYPE.PLATE_MA: {
          m.plate = `MA ${m.plate}`;
          break;
        }
        case EVENT_TYPE.PLATE_ME: {
          m.plate = `ME ${m.plate}`;
          break;
        }
        case EVENT_TYPE.PLATE_NH: {
          m.plate = `NH ${m.plate}`;
          break;
        }
        case EVENT_TYPE.MISC: {
          break;
        }
        default: {
          m.plate = '';
        }
      }

      delete m.id;
    });
    const events = copy.filter(e => ![EVENT_TYPE.BEGIN, EVENT_TYPE.END].includes(e.type));

    events.forEach(m => delete m.type);

    return {
      date: new Date().toISOString().slice(0, 10),
      startMark,
      endMark,
      startTime,
      endTime,
      events,
      coords,
    };
  }

  function backup() {
    const maxBackupCount = 5;
    for (let i = maxBackupCount - 1; i >= 0; i--) {
      localStorage.setItem(`Backup_${i}`, localStorage.getItem(`Backup_${i-1}`));
    }
    localStorage.setItem('Backup_0', JSON.stringify(state));
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

  async function handleUploadClick(fileInputChangeEvent) {
    const reader = new FileReader();
    const [file] = fileInputChangeEvent.target.files;
    reader.addEventListener('load', async () => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(reader.result, 'text/html');
      const coords = Array.from(doc.querySelectorAll('trkpt'))
        .map(e => {
          const lat = e.attributes['lat'];
          const lon = e.attributes['lon'];
          const ele = e.querySelector('ele');
          const speed = e.querySelector('speed');
          const sat = e.querySelector('sat');
          const time = e.querySelector('time');

          return {
            lat: parseFloat(lat.value),
            lon: parseFloat(lon.value),
            ele: parseFloat(ele.textContent),
            speed: speed ? parseFloat(speed.textContent) : undefined,
            sat: sat ? parseInt(sat.textContent) : undefined,
            time: new Date(time.textContent).getTime(),
          };
        });

      const exportContent = await getExportContent(coords);
      if (isTestUpload) {
        console.log(JSON.stringify(exportContent, null, '  '));
      } else {
        try {
          isUploading = true;
          await fetch('https://mike-desktop/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(exportContent) });
        } catch (e) {
          alert(`Encountered an error during upload: ${e.message}`);
        } finally {
          isUploading = false;
        }
      }
    });

    reader.readAsText(file);    
  }

  function resetStorage() {
    state.marks = [];
    state.elapsed = 0;
    state.running = false;
    updateStorage(true);
  }

  function handleResetClick() {
    backup();
    resetStorage();
  }

  function getAddMarkHandler(button) {
    return () => {
      const id = crypto.randomUUID?.().toUpperCase() ?? Math.floor(Math.random() * 1e10);

      const newMark = { id, mark: state.elapsed, type: button.type };

      switch (button.type) {
        case EVENT_TYPE.BEGIN: 
        case EVENT_TYPE.END: {
          newMark.datetime = new Date().toISOString();
          break;
        }
        case EVENT_TYPE.PLATE:
        case EVENT_TYPE.PLATE_MA:
        case EVENT_TYPE.PLATE_ME:
        case EVENT_TYPE.PLATE_NH: {
          newMark.plate = '';
          break;
        }
        case EVENT_TYPE.TAG: {
          newMark.tag = '';
          break;
        }
        default: {
          newMark.name = button.name + ' ';
        }
      }

      state.marks.push(newMark);

      if (![EVENT_TYPE.BEGIN, EVENT_TYPE.END].includes(button.type)) {
        setTimeout(() => {
          document.querySelector(`#input_${id}`).focus();
        }, 50);
      }
    }
  }

  function getInputChangeHandler(id) {
    return (e) => {
      const target = state.marks.find(e => e.id === id);
      switch (target.type) {
        case EVENT_TYPE.PLATE:
        case EVENT_TYPE.PLATE_MA:
        case EVENT_TYPE.PLATE_ME:
        case EVENT_TYPE.PLATE_NH: {
          target.plate = e.target.value.toUpperCase();
          break;
        }
        case EVENT_TYPE.TAG: {
          target.tag = e.target.value;
          break;
        }
        default: {
          target.name = e.target.value;
        }
      }
    }
  }

  function getItemDeleteHandler(id) {
    return () => {
      const targetIdx = state.marks.findIndex(e => e.id === id);
      state.marks.splice(targetIdx, 1);
    }
  }

  function getItemStyle(mark, idx) {
    if (idx === 0) {
      const diff = Math.floor(state.elapsed - mark.mark);
      if (diff >= 5000) return null;

      const percent = (5000 - diff) / 5000;
      const n = Math.floor(255 - (255 * percent));

      return `color: rgb(255, ${n}, ${n})`;
    }
    return null;
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
    <button on:click={handleToggleClick}>Toggle</button>
    <button on:click={e => { isTestUpload = e.ctrlKey; document.querySelector('#gps_file').click(); }} disabled={!state.marks.length || isUploading}>Upload</button>
    <button on:click={handleResetClick}>Reset</button>
  </p>
  <p>
    {#if state.marks.find(m => m.type === EVENT_TYPE.BEGIN)}
      {''}
    {:else}
      <button on:click={getAddMarkHandler({ type: EVENT_TYPE.BEGIN })} disabled={!state.running}>START</button>
    {/if}

    {#if (!state.marks.find(m => m.type === EVENT_TYPE.BEGIN) || state.marks.find(m => m.type === EVENT_TYPE.END))}
      {''}
    {:else}
      <button on:click={getAddMarkHandler({ type: EVENT_TYPE.END })} disabled={!state.running}>END</button>
    {/if}
  </p>
  <p>
    {#each markButtons as markButton}
      <button on:click={getAddMarkHandler(markButton)} disabled={!state.running}>{markButton.label}</button>
    {/each}
  </p>

  <ol reversed style={'text-align: left; font-size: 16px;'}>
    {#each state.marks.toReversed() as mark, idx}
      {@const itemStyle = getItemStyle(mark, idx)}
      <li style={itemStyle}>
        {getDisplayText(mark.mark)}
        -
        {#if mark.type === EVENT_TYPE.BEGIN}
          BEGIN
        {:else if mark.type === EVENT_TYPE.END}
          END
        {:else if mark.type === EVENT_TYPE.PLATE}
          PLATE <input type="text" style={'width: 122px'} id={`input_${mark.id}`} value={mark.plate} on:input={getInputChangeHandler(mark.id)}/>
        {:else if mark.type === EVENT_TYPE.PLATE_MA}
          MA <input type="text" style={'width: 122px'} id={`input_${mark.id}`} value={mark.plate} on:input={getInputChangeHandler(mark.id)}/>
        {:else if mark.type === EVENT_TYPE.PLATE_ME}
          ME <input type="text" style={'width: 122px'} id={`input_${mark.id}`} value={mark.plate} on:input={getInputChangeHandler(mark.id)}/>
        {:else if mark.type === EVENT_TYPE.PLATE_NH}
          NH <input type="text" style={'width: 122px'} id={`input_${mark.id}`} value={mark.plate} on:input={getInputChangeHandler(mark.id)}/>
        {:else if mark.type === EVENT_TYPE.TAG}
          TAG <input type="text" style={'width: 122px'} id={`input_${mark.id}`} value={mark.tag} on:input={getInputChangeHandler(mark.id)}/>
        {:else}
          <input type="text" id={`input_${mark.id}`} value={mark.name} on:input={getInputChangeHandler(mark.id)}/>
        {/if}

        {#if itemStyle}
          <button style={'vertical-align: middle; margin: 0; padding: 0; height: 28px; width: 32px'} on:click={getItemDeleteHandler(mark.id)}>X</button>
        {/if}
      </li>
    {/each}
  </ol>

  <input style="display: none" type="file" id="gps_file" on:change={handleUploadClick}>
</main>

<style>
  
</style>
