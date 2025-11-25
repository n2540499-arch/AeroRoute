// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory store (for demo). You can replace with DB later.
let roads = {
  // example road id
  "road-1": {
    sensors: [],
    congestion: false,
    lastUpdate: null
  }
};

// Simple logic: if more than N "vehicles" reported in window => congested
const CONGESTION_THRESHOLD = 3; // tweak for demo

// WebSocket server for pushing updates to clients (frontend)
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

// Sensor data endpoint (sensors or simulator POST here)
app.post('/api/sensor/:roadId', (req, res) => {
  const roadId = req.params.roadId || 'road-1';
  const payload = req.body; // e.g. { sensorId, type, distance, mq135, timestamp }
  if (!roads[roadId]) {
    roads[roadId] = { sensors: [], congestion: false, lastUpdate: null };
  }
  // Keep last N readings
  roads[roadId].sensors.push(payload);
  if (roads[roadId].sensors.length > 50) roads[roadId].sensors.shift();

  // Simple detection: count readings where distance < threshold mean => vehicle density
  const recent = roads[roadId].sensors.slice(-10);
  const congestionCount = recent.filter(r => r.distance && r.distance < 50).length;
  const isCongested = congestionCount >= CONGESTION_THRESHOLD;
  roads[roadId].congestion = isCongested;
  roads[roadId].lastUpdate = Date.now();

  // Decide recommended route for vehicle types
  // Emergency => RIGHT, Normal => LEFT (as per your rules)
  const recommendation = {
    roadId,
    congestion: isCongested,
    recommendedFor: {
      emergency: 'right',
      normal: 'left'
    },
    congestionCount,
    timestamp: roads[roadId].lastUpdate
  };

  // Broadcast to connected frontends
  broadcast({ type: 'update', data: recommendation });

  res.json({ status: 'ok', recommendation });
});

// Endpoint for frontend to fetch status
app.get('/api/status/:roadId', (req, res) => {
  const roadId = req.params.roadId || 'road-1';
  const info = roads[roadId] || { congestion: false, sensors: [], lastUpdate: null };
  res.json(info);
});

// Traffic light control endpoint (simulated) - accepts commands
app.post('/api/traffic-light/:id', (req, res) => {
  const cmd = req.body; // e.g. { action: "setMode", mode: "prioritize_emergency" }
  console.log('Traffic light command', req.params.id, cmd);
  // NOTE: do NOT connect to real signals unless permitted
  broadcast({ type: 'traffic-light-cmd', id: req.params.id, cmd });
  res.json({ status: 'received', cmd });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
node server.js
// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// In-memory store (demo). استبدلي بقاعدة بيانات لو عايزة
let roads = {
  "road-1": {
    sensors: [],
    congestion: false,
    pollution: "0%",
    lastUpdate: null,
    ledCommand: "none", // "none" | "right" | "left"
    pendingRequests: [] // list of {vehicleCode, type, status}
  }
};

// Helper: determine congestion from ultrasonic distances
function isCongestedFromRecent(recent) {
  // simple rule: if many readings where distance < 50 => congested
  const th = 50;
  const window = recent.slice(-10);
  const cnt = window.filter(r => r.distance1 !== undefined && r.distance1 < th).length +
              window.filter(r => r.distance2 !== undefined && r.distance2 < th).length;
  return cnt >= 3;
}

// Map mq_raw or mq_pct to pollution %
function formatPollution(mq_pct) {
  if (!mq_pct && mq_pct !== 0) return "N/A";
  let p = Number(mq_pct);
  return p.toFixed(1) + "%";
}

// Endpoint that sensors POST to
app.post('/api/sensor/:roadId', (req, res) => {
  const roadId = req.params.roadId || "road-1";
  const body = req.body;
  if (!roads[roadId]) {
    roads[roadId] = { sensors: [], congestion: false, pollution: "0%", lastUpdate: null, ledCommand: "none", pendingRequests: [] };
  }

  // Normalize incoming payload
  const entry = {
    sensorId: body.sensorId || 'esp',
    distance1: body.distance1,
    distance2: body.distance2,
    mq_raw: body.mq_raw,
    mq_pct: body.mq_pct,
    timestamp: Date.now()
  };
  roads[roadId].sensors.push(entry);
  if (roads[roadId].sensors.length > 200) roads[roadId].sensors.shift();

  // Evaluate congestion & pollution
  const recent = roads[roadId].sensors.slice(-20);
  const congested = isCongestedFromRecent(recent);
  const pollution = formatPollution(entry.mq_pct);

  roads[roadId].congestion = congested;
  roads[roadId].pollution = pollution;
  roads[roadId].lastUpdate = Date.now();

  // Optionally: auto-clear ledCommand after some time
  // respond with current recommendation
  const recommendation = {
    roadId,
    congestion: congested,
    pollution,
    recommendedFor: {
      emergency: "right",
      normal: "left"
    },
    timestamp: roads[roadId].lastUpdate
  };

  // broadcast simulation: (in real app use websockets)
  console.log("Sensor update:", recommendation);

  res.json({ status: 'ok', recommendation });
});

// Frontend fetch status
app.get('/api/road-status/:roadId?', (req, res) => {
  const roadId = req.params.roadId || "road-1";
  const info = roads[roadId] || {};
  res.json({
    roadId,
    congestion: info.congestion || false,
    pollution: info.pollution || "N/A",
    lastUpdate: info.lastUpdate || null,
    recommendedFor: { emergency: "right", normal: "left" },
    pending: info.pendingRequests || []
  });
});

// Driver requests to pass a road (POST)
// body: { vehicleCode: "ABC123", type: "emergency"|"normal" }
app.post('/api/request-pass/:roadId', (req, res) => {
  const roadId = req.params.roadId || "road-1";
  const { vehicleCode, type } = req.body;
  if (!vehicleCode || !type) return res.status(400).json({ error: "vehicleCode and type required" });
  if (!roads[roadId]) return res.status(404).json({ error: "road not found" });

  // Insert a pending request (simulate verifying code)
  const reqObj = { id: Date.now().toString(), vehicleCode, type, status: "pending", timestamp: Date.now() };
  roads[roadId].pendingRequests.push(reqObj);

  // For demo: auto-verify the code if matches simple rule OR you can keep an allowlist
  // Here we consider vehicleCode length >=3 as valid for demo
  if (vehicleCode.length >= 3) {
    reqObj.status = "approved";
    // set LED command according to type
    roads[roadId].ledCommand = (type === 'emergency') ? 'right' : 'left';
    // optionally clear after some seconds (simulate passage)
    setTimeout(() => {
      // clear led if still same
      if (roads[roadId].ledCommand === (type === 'emergency' ? 'right' : 'left')) {
        roads[roadId].ledCommand = 'none';
      }
    }, 15000); // 15s
    res.json({ status: "approved", led: roads[roadId].ledCommand });
  } else {
    reqObj.status = "rejected";
    res.json({ status: "rejected", reason: "invalid vehicle code" });
  }
});

// Endpoint for ESP polling to get current LED command
app.get('/api/led-command/:roadId', (req, res) => {
  const roadId = req.params.roadId || "road-1";
  const info = roads[roadId] || { ledCommand: 'none' };
  res.json({ led: info.ledCommand });
});

// Optional: endpoint to manually set LED (admin)
app.post('/api/set-led/:roadId', (req, res) => {
  const roadId = req.params.roadId || "road-1";
  const { led } = req.body; // 'left' | 'right' | 'none'
  if (!roads[roadId]) roads[roadId] = { ledCommand: 'none', pendingRequests: [] };
  roads[roadId].ledCommand = led || 'none';
  res.json({ status: 'ok', led: roads[roadId].ledCommand });
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});

// Load saved vehicle codes or use default list
let validCodes = JSON.parse(localStorage.getItem("validCodes")) || {
    "EMG001": "emergency",
    "CAR101": "normal"
};

// Save function
function saveCodes() {
    localStorage.setItem("validCodes", JSON.stringify(validCodes));
}

function validateCode() {
    let code = document.getElementById("vehicleCode").value.trim();
    let status = document.getElementById("codeStatus");

    if (validCodes[code]) {
        let type = validCodes[code];
        status.innerText = "Code accepted! Vehicle type: " + type;
        status.style.color = "green";

        if (type === "emergency") sendDirectionToESP("right");
        if (type === "normal") sendDirectionToESP("left");

    } else {
        status.innerText = "Invalid code!";
        status.style.color = "red";
    }
}



