// app.js
const BACKEND = 'http://localhost:4000'; // change when deployed
const ROAD_ID = 'road-1';

const ws = new WebSocket('ws://localhost:4000');

ws.addEventListener('open', () => console.log('WS open'));
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === 'update') {
    updateStatus(msg.data);
  }
  if (msg.type === 'traffic-light-cmd') {
    console.log('Traffic light event', msg);
  }
});

const el = (id) => document.getElementById(id);
function updateStatus(data) {
  el('congestion').innerText = data.congestion ? 'CONGESTED' : 'CLEAR';
  el('last-update').innerText = new Date(data.timestamp).toLocaleTimeString();
  el('advice').innerText = `Emergency -> ${data.recommendedFor.emergency.toUpperCase()}, Normal -> ${data.recommendedFor.normal.toUpperCase()}`;
}

async function fetchStatus() {
  const res = await fetch(`${BACKEND}/api/status/${ROAD_ID}`);
  const j = await res.json();
  el('congestion').innerText = j.congestion ? 'CONGESTED' : 'CLEAR';
  el('last-update').innerText = j.lastUpdate ? new Date(j.lastUpdate).toLocaleTimeString() : '-';
}
fetchStatus();

// Buttons
el('emergency-btn').addEventListener('click', () => {
  alert('You are Emergency vehicle. Checking recommendation...');
  // For demo, ask server for latest and show route
  fetch(`${BACKEND}/api/status/${ROAD_ID}`).then(r=>r.json()).then(s=>{
    const rec = s.congestion ? 'RIGHT (avoid main road)' : 'STRAIGHT';
    el('advice').innerText = `For Emergency: go ${rec}`;
  });
});
el('normal-btn').addEventListener('click', () => {
  fetch(`${BACKEND}/api/status/${ROAD_ID}`).then(r=>r.json()).then(s=>{
    const rec = s.congestion ? 'LEFT (detour)' : 'STRAIGHT';
    el('advice').innerText = `For Normal: go ${rec}`;
  });
});

// GPS simulation or real geolocation
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    el('gps').innerText = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
  }, err => {
    el('gps').innerText = 'denied or unavailable (using simulator)';
  });
} else {
  el('gps').innerText = 'not supported';
}
// Function to update UI
function updateUI(data) {
    document.getElementById("roadId").innerText = data.roadId;
    document.getElementById("congestion").innerText = data.congestion ? "Yes" : "No";
    document.getElementById("pollution").innerText = data.pollution + "%";
    document.getElementById("weather").innerText = data.weather;

    // Direction rules
    document.getElementById("emergencyDir").innerText = data.recommendedFor.emergency;
    document.getElementById("normalDir").innerText = data.recommendedFor.normal;
}

// Auto refresh every 2 seconds
setInterval(() => {
    fetch("/api/road-status")
        .then(res => res.json())
        .then(data => updateUI(data))
        .catch(err => console.log("Error:", err));
}, 2000);
const BACKEND = 'http://localhost:4000';
const ROAD = 'road-1';

async function fetchStatus() {
  try {
    const res = await fetch(`${BACKEND}/api/road-status/${ROAD}`);
    const j = await res.json();
    document.getElementById('congestion').innerText = j.congestion ? 'Yes' : 'No';
    document.getElementById('pollution').innerText = j.pollution;
    document.getElementById('lastUpdate').innerText = j.lastUpdate ? new Date(j.lastUpdate).toLocaleTimeString() : '-';
  } catch (e) {
    console.error(e);
  }
}

setInterval(fetchStatus, 2000); // refresh

document.getElementById('requestBtn').addEventListener('click', async () => {
  const type = document.getElementById('vehicleType').value;
  const code = document.getElementById('vehicleCode').value.trim();
  if (!code) {
    alert('Please enter vehicle code');
    return;
  }
  try {
    const res = await fetch(`${BACKEND}/api/request-pass/${ROAD}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleCode: code, type })
    });
    const j = await res.json();
    if (j.status === 'approved') {
      document.getElementById('requestResult').innerText = 'Approved — LED set to: ' + j.led;
    } else {
      document.getElementById('requestResult').innerText = 'Request: ' + JSON.stringify(j);
    }
  } catch (e) {
    console.error(e);
    document.getElementById('requestResult').innerText = 'Error sending request';
  }
});


