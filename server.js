const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors());

// ====================
// Pollution Calculation
// ====================
function pollutionPercentage(mqValue) {
    const min = 100;
    const max = 500;
    let val = Math.min(Math.max(mqValue, min), max);
    return ((val - min) / (max - min)) * 100;
}

// ====================
// Fake Weather For Now
// ====================
function getWeather() {
    const list = ["Sunny", "Cold", "Hot", "Windy", "Rainy"];
    return list[Math.floor(Math.random() * list.length)];
}

// =====================
// Sensor Input Endpoint
// =====================
let roadStatus = {
    roadId: 1,
    congestion: false,
    pollution: 0,
    weather: "Sunny",
    recommendedFor: {
        emergency: "right",
        normal: "left"
    }
};

app.post("/api/sensor", (req, res) => {
    const { ultrasonicStart, ultrasonicEnd, mq135 } = req.body;

    // Congestion detection
    const congested = ultrasonicStart < 20 || ultrasonicEnd < 20;

    // Pollution %
    const pollution = pollutionPercentage(mq135);

    roadStatus = {
        roadId: 1,
        congestion: congested,
        pollution: pollution.toFixed(1),
        weather: getWeather(),
        recommendedFor: {
            emergency: "right",
            normal: "left"
        }
    };

    res.json({ message: "Sensor data updated", roadStatus });
});

// =====================
// Frontend Fetch Endpoint
// =====================
app.get("/api/road-status", (req, res) => {
    res.json(roadStatus);
});

// =====================
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
