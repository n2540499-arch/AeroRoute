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

