<script>
  import { Duration } from 'luxon';

  let lastTimestamp = parseInt(localStorage.getItem('lastTimestamp') ?? new Date().getTime());

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

  function getDisplayText(timestamp, withoutMillseconds = false) {
    if (!timestamp) {
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
    { label: 'Lane change', name: 'Driver changes lane without signal ', type: EVENT_TYPE.LANE_CHANGE_WITHOUT_SIGNAL },
    { label: 'No signal turn', name: 'Driver turns without signal ', type: EVENT_TYPE.TURN_WITHOUT_SIGNAL },
    { label: 'Stop sign', name: 'Driver runs stop sign ', type: EVENT_TYPE.STOP_SIGN_RUN },
    { label: 'Red light', name: 'Driver runs red light ', type: EVENT_TYPE.RED_LIGHT_RUN },
    { label: 'Wrong park', name: 'Car parked on wrong side of road ', type: EVENT_TYPE.PARKED_ON_WRONG_SIDE },
    { label: 'Speeder', name: 'Speeding driver ', type: EVENT_TYPE.SPEEDER },
    { label: 'Block turn', name: 'Driver blocks turn area ', type: EVENT_TYPE.TURN_AREA_BLOCK },    
    { label: 'Look good', name: 'Good driver looks before turning ', type: EVENT_TYPE.LOOK_GOOD },
    { label: 'Look bad', name: 'Bad driver does not look before turning ', type: EVENT_TYPE.LOOK_BAD },
    { label: 'Tag', type: EVENT_TYPE.TAG },
    { label: 'Misc', name: '', type: EVENT_TYPE.MISC },
    { label: 'Begin', type: EVENT_TYPE.BEGIN },
    { label: 'End', type: EVENT_TYPE.END },
  ];

  function getExportContent() {
    const copy = JSON.parse(JSON.stringify(state.marks));

    const begin = getDisplayText(copy.find(m => m.type === EVENT_TYPE.BEGIN)?.mark);
    const end = getDisplayText(copy.find(m => m.type === EVENT_TYPE.END)?.mark);

    const beginDuration = Duration.fromISOTime(begin);

    copy.forEach((m) => {
      m.mark = getDisplayText(m.mark);

      let isOutOfBounds = false;
      if (m.mark < begin || m.mark > end) {
        isOutOfBounds = true;
      }

      const duration = Duration.fromISOTime(m.mark);
      const trimmedStart = duration.minus(beginDuration);
      let trimmedStartProcessed = trimmedStart.toFormat('hh:mm:ss');

      if (trimmedStartProcessed.includes('-')) {
        trimmedStartProcessed = '-' + trimmedStartProcessed.replace('-','');
      }

      m.trimmedStart = trimmedStartProcessed;
      if (![EVENT_TYPE.PLATE, EVENT_TYPE.PLATE_MA, EVENT_TYPE.PLATE_ME, EVENT_TYPE.PLATE_NH, EVENT_TYPE.TAG].includes(m.type)) {
        m.trimmedEnd = m.trimmedStart;
      }

      switch(m.type) {
        case EVENT_TYPE.BEGIN: {
          break;
        }
        case EVENT_TYPE.END: {
          break;
        }
        case EVENT_TYPE.PLATE: {
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
        case EVENT_TYPE.TAG: {
          break;
        }
        default: {
          m.name = isOutOfBounds ? `SKIP OOB ${m.name.trim()}` : m.name.trim();
        }
      }

      delete m.id;
    });
    const events = copy.filter(e => ![EVENT_TYPE.BEGIN, EVENT_TYPE.END].includes(e.type));

    events.forEach(m => delete m.type);

    return { start: begin, end, route: '', events };
  }

  function download(filename) {
    const json = JSON.stringify(getExportContent());
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

  function handleExportClick(e) {
    if (e.ctrlKey) {
      console.log(JSON.stringify(getExportContent(), null, '  '));
    } else {
      download(`events_${new Date().toISOString().slice(0, 10)}.json`);
    }
  }

  function resetStorage() {
    state.marks = [];
    state.elapsed = 0;
    state.running = false;
    updateStorage(true);
  }

  function handleResetClick() {
    resetStorage();
  }

  function getAddMarkHandler(button) {
    return () => {
      const id = crypto.randomUUID().toUpperCase();

      const newMark = { id, mark: state.elapsed, type: button.type };

      switch (button.type) {
        case EVENT_TYPE.BEGIN: {
          break;
        }
        case EVENT_TYPE.END: {
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
          newMark.name = button.name;
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
    <button on:click={handleToggleClick}>{state.running ? 'Stop' : 'Start'}</button>
    <button on:click={handleExportClick} disabled={!state.marks.length}>Export</button>
    <button on:click={handleResetClick}>Reset</button>
  </p>
  <p>
    
  </p>
  <p>
    {#each markButtons as markButton}
      {#if markButton.type === EVENT_TYPE.BEGIN && state.marks.find(m => m.type === EVENT_TYPE.BEGIN)}
        {''}
      {:else if markButton.type === EVENT_TYPE.END && (!state.marks.find(m => m.type === EVENT_TYPE.BEGIN) || state.marks.find(m => m.type === EVENT_TYPE.END))}
        {''}
      {:else}
        <button on:click={getAddMarkHandler(markButton)} disabled={!state.running}>{markButton.label}</button>
      {/if}
    {/each}
  </p>

  <ol reversed style={'text-align: left; font-size: 16px'}>
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
</main>

<style>
  
</style>
