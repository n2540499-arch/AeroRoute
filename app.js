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
