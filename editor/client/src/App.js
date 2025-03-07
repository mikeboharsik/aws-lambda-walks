import './App.css';

import { useEffect, useState } from 'react';

const baseUrl = 'http://localhost:8089';

function SelectDateComponent({ isVisible, options, updateValue, revert }) {
  if (isVisible && options) {
    return (
      <div>
        {revert && <span style={{ cursor: 'pointer' }} onClick={revert}>{'←'}</span>}
        {
          options
            .toSorted((a,b) => parseInt(a) < parseInt(b) ? -1 : parseInt(a) > parseInt(b) ? 1 : 0)
            .map(e => (
              <div key={`year-${e}`} style={{ cursor: 'pointer' }} onClick={() => updateValue(e)}>{e}</div>
            ))
        }
      </div>);
  }

  return null;
}

const states = [
  'MA',
  'NH',
  'ME',
  'NY',
  'CT',
  'RI',
  'NJ',
  'N/A'
];

function PlateStateInput({ defaultValue = 'MA' }) {
  return <select defaultValue={defaultValue} className="plate-state">{states.map(e => <option value={e}>{e}</option>)}</select>;
}

function PlateInputs({ plates, addPlate }) {
  const [newPlates, setNewPlates] = useState([]);
  if (plates?.length || newPlates.length) {
    return (
      <div>
        {(plates || []).concat(newPlates).map(e => (
          <span className="plate">
            <PlateStateInput defaultValue={e?.slice(0, 2)} />
            <input key={e} className="plate-value" type="text" defaultValue={e.slice(2).trim()}></input>
          </span>
        ))}
        <span onClick={() => setNewPlates(e => [...e, ''])}>{'+'}</span>
      </div>
    );
  }
  return <div>No plates <span onClick={() => setNewPlates(e => [...e, ''])}>{'+'}</span></div>;
}

function currentTimeToTimestamp(currentTime) {
  const hours = Math.floor(currentTime / (60 * 60)).toString().padStart(2, 0);
  const minutes = Math.floor(currentTime / 60).toString().padStart(2, 0);
  const seconds = Math.floor(currentTime % 60).toString().padStart(2, 0);
  const ms = (currentTime % 1).toFixed(3).padEnd(3, 0).replace('0.', '');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

function VideoPreview() {
  const [vidSrc, setVidSrc] = useState(null);
  const [vidZoom, setVidZoom] = useState(1.0);
  const [vidOffset, setVidOffset] = useState([0, 0]);
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <>
      <div
        id="video-container"
        style={{
          width: '960px',
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        {vidSrc && <video
          onTimeUpdate={(e) => {setCurrentTime(e.target.currentTime)}}
          id="wip-video"
          src={vidSrc}
          controls
          width="960"
          height="540"
          style={{ display: 'inline-block', scale: vidZoom, translate: `${vidOffset[0]}px ${vidOffset[1]}px`, width: 960, height: 540 }}
          onWheel={(e) => {
            if (e.ctrlKey) {
              let newVal = vidZoom;   
              if (e.nativeEvent.wheelDeltaY > 0) {
                newVal = Math.min(10.0, vidZoom + 1);
              } else {
                newVal = Math.max(1.0, vidZoom - 1);
                if (newVal === 1) {
                  setVidOffset([0, 0]);
                }
              }
              setVidZoom(newVal);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseMove={(e) => { if (e.shiftKey) setVidOffset(([x, y]) => ([x + e.movementX, y + e.movementY]))}}
        ></video>}
        {!vidSrc && <input type="file" onChange={(e) => {
          const url = URL.createObjectURL(e.target.files[0]);
          setVidSrc(url);
        }}></input>}

        <div
          style={{ position: 'absolute', bottom: '15%' }}
        >
          <button onClick={() => {
            setVidZoom(1.0);
            setVidOffset([0, 0]);
          }}>Reset video transforms</button>
          <br></br>
          <input type="text" id="jump-to-time" defaultValue={'00:00:00'}></input>
          <button onClick={() => {
            const targetTime = document.querySelector('#jump-to-time').value;
            let [, hour, minute, second, , millisecond] = targetTime.match(/(\d{2}):(\d{2}):(\d{2})(\.)*(\d{1,})*/);
            if (millisecond) millisecond = millisecond.padEnd(3, 0);
            console.log({ hour, minute, second, millisecond });
            const newCurrentTime = (parseInt(hour) * 60 * 60) + (parseInt(minute) * 60) + parseInt(second) + (parseInt(millisecond ?? 0) / 1000);
            console.log(newCurrentTime);
            document.querySelector('#wip-video').currentTime = newCurrentTime;
          }}>Jump to time</button>
          <br></br>
          <input type="text" value={currentTimeToTimestamp(currentTime)}></input>
        </div>
      </div>
    </>
  );
}

function EventInputs({ year, month, day, walks, walkIdx, revert }) {
  if (year && month && day && walks) {
    const { events } = walks[walkIdx];
    return (
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ width: '50%' }}>
          <VideoPreview />
        </div>
        <div style={{ width: '50%' }}>
          <div id="eventInputs" style={{ height: '100vh', overflow: 'scroll' }}>
            {revert && <span style={{ cursor: 'pointer' }} onClick={revert}>{'←'}</span>}
            <span></span>
            {events.map(e => (
              <div className="event" style={{ fontSize: '18px' }} key={e.id}>
                Name: <input className="name" type="text" defaultValue={e.name}></input>
                Trimmed start: <input className="trimmedStart" style={{ textAlign: 'center', width: '6.2em' }} type="text" defaultValue={e.trimmedStart}></input>
                Trimmed end: <input className="trimmedEnd" style={{ textAlign: 'center', width: '6.2em' }} type="text" defaultValue={e.trimmedEnd}></input>
                Skip: <input className="skip" type="checkbox" defaultChecked={e.skip === true}></input>
                Resi: <input className="resi" type="checkbox" defaultChecked={e.resi === true}></input>
                <input className="coords" type="hidden" defaultValue={e.coords}></input>
                <input className="mark" type="hidden" defaultValue={e.mark}></input>
                <input className="id" type="hidden" defaultValue={e.id}></input>
                <PlateInputs plates={e.plates} />
                <hr />
              </div>
            ))}
            <button onClick={(e) => {
              const updatedEvents = Array.from(document.querySelector('#eventInputs').querySelectorAll('.event'))
                .map(e => {
                  const mark = e.querySelector('.mark')?.value || undefined;
                  const trimmedStart = e.querySelector('.trimmedStart')?.value || undefined;
                  const trimmedEnd = e.querySelector('.trimmedEnd')?.value || undefined;
                  const name = e.querySelector('.name')?.value || undefined;
                  const coords = e.querySelector('.coords')?.value.split(',').map(e => parseFloat(e)) || undefined;
                  const plates = Array.from(e.querySelectorAll('.plate'))?.map?.(p => `${p.querySelector('.plate-state')?.value} ${p.querySelector('.plate-value')?.value}`).filter(p => !p.endsWith('DELETE'));
                  const skip = e.querySelector('.skip')?.checked || undefined;
                  const resi = e.querySelector('.resi')?.checked || undefined;
                  const id = e.querySelector('.id').value;
                  if (name?.toUpperCase().trim() === 'DELETED') {
                    return undefined;
                  }
                  return {
                    id,
                    mark,
                    trimmedStart,
                    trimmedEnd,
                    name,
                    coords,
                    plates: plates.length ? plates : undefined,
                    skip,
                    resi,
                  };
                }).filter(e => e && e.name !== 'DELETE');
              if (e.ctrlKey) {
                console.log(JSON.stringify(updatedEvents, null, '  '));
              } else {
                fetch(`${baseUrl}/date/${year}-${month}-${day}/0/events`, { method: 'put', headers: { 'content-type': 'application/json' }, body: JSON.stringify(updatedEvents) });
              }
            }}>Submit</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function App() {
  const [years, setYears] = useState(null);
  const [dateData, setDateData] = useState(null);

  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedWalk, setSelectedWalk] = useState(0);

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault(); // Prevent default browser zoom
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false }); // Important: passive: false for preventDefault to work

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    fetch(`${baseUrl}/dates`)
      .then(r => r.json())
      .then(r => setYears(r));
  }, [setYears]);

  useEffect(() => {
    if (selectedDay) {
      fetch(`${baseUrl}/date/${selectedYear}-${selectedMonth}-${selectedDay}`)
        .then(r => r.json())
        .then(r => setDateData(JSON.parse(r)));
    }
  }, [selectedYear, selectedMonth, selectedDay, setDateData]);

  return (
    <div className="App" onWheel={(e) => { if (e.ctrlKey) e.preventDefault() } }>
      <header className="App-header">
        <SelectDateComponent
          isVisible={selectedYear === null && years}
          options={years && Object.keys(years)}
          updateValue={setSelectedYear}
        />
        <SelectDateComponent
          isVisible={selectedYear !== null && selectedMonth === null}
          options={selectedYear && Object.keys(years?.[selectedYear])}
          updateValue={setSelectedMonth}
          revert={() => setSelectedYear(null)}
        />
        <SelectDateComponent
          isVisible={selectedYear !== null && selectedMonth !== null && selectedDay === null}
          options={years?.[selectedYear]?.[selectedMonth]}
          updateValue={setSelectedDay}
          revert={() => setSelectedMonth(null)}
        />
        <EventInputs
          year={selectedYear}
          month={selectedMonth}
          day={selectedDay}
          walks={dateData}
          walkIdx={selectedWalk}
          revert={() => setSelectedDay(null)}
        />
      </header>
    </div>
  );
}

export default App;
