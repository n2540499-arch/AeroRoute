
# simulate_sensors.py
# Python 3 script to simulate sensors posting JSON to backend
import requests
import time
import random

BACKEND = "http://localhost:4000"
ROAD_ID = "road-1"

def send_sample():
    payload = {
        "sensorId": f"sensor-{random.randint(1,3)}",
        "type": "ultrasonic",
        # distance in cm (smaller -> car near sensor)
        "distance": random.choice([20, 25, 35, 60, 120]),
        # MQ-135 approximate air quality number
        "mq135": random.uniform(100, 450),
        "timestamp": int(time.time()*1000)
    }
    url = f"{BACKEND}/api/sensor/{ROAD_ID}"
    try:
        r = requests.post(url, json=payload, timeout=2)
        print("sent", payload, "->", r.status_code)
    except Exception as e:
        print("error:", e)

if __name__ == "__main__":
    while True:
        send_sample()
        time.sleep(1.5)  # simulate frequent readings

