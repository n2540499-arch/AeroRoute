// esp32_traffic.ino
#include <WiFi.h>
#include <HTTPClient.h>

//
// === إعدادات الشبكة والـ Backend ===
//
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* backend = "http://YOUR_BACKEND_HOST:4000"; // مثال: http://192.168.1.50:4000 أو https://yourdomain.com

const char* roadId = "road-1";

// === Pins ===
const int trig1Pin = 14;
const int echo1Pin = 27;
const int trig2Pin = 26;
const int echo2Pin = 25;
const int mqPin = 36;      // ADC1_CH0
const int ledRight = 16;   // Emergency (green)
const int ledLeft = 17;    // Normal (yellow)

// Timing
unsigned long lastSensorSend = 0;
const unsigned long SEND_INTERVAL = 1500; // ms
unsigned long lastPollCmd = 0;
const unsigned long POLL_INTERVAL = 1500; // ms

// helper - pulseIn with timeout
long readUltrasonicCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH, 30000); // timeout 30ms
  if (duration == 0) return 9999;
  long cm = duration / 58;
  return cm;
}

// read MQ-135 analog -> raw value 0..4095
int readMQ() {
  int raw = analogRead(mqPin);
  return raw;
}

void setup() {
  Serial.begin(115200);
  pinMode(trig1Pin, OUTPUT);
  pinMode(echo1Pin, INPUT);
  pinMode(trig2Pin, OUTPUT);
  pinMode(echo2Pin, INPUT);
  pinMode(ledRight, OUTPUT);
  pinMode(ledLeft, OUTPUT);
  digitalWrite(ledRight, LOW);
  digitalWrite(ledLeft, LOW);
  analogReadResolution(12);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connect failed");
  }
}

float mapMQtoPercent(int raw) {
  // raw 0..4095 map to approximate MQ-135 scale. We'll map to 100..500 scale used by backend.
  // adjust curve if needed
  float mqVal = map(raw, 0, 4095, 100, 500);
  if (mqVal < 100) mqVal = 100;
  if (mqVal > 500) mqVal = 500;
  // compute percentage 0..100
  float pct = ((mqVal - 100.0) / (400.0)) * 100.0;
  return pct;
}

void sendSensorData(long d1, long d2, int mqRaw) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(backend) + "/api/sensor/" + roadId;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON
  String payload = "{";
  payload += "\"sensorId\":\"esp32-1\",";
  payload += "\"distance1\":" + String(d1) + ",";
  payload += "\"distance2\":" + String(d2) + ",";
  payload += "\"mq_raw\":" + String(mqRaw) + ",";
  payload += "\"mq_pct\":" + String(mapMQtoPercent(mqRaw)) + ",";
  payload += "\"timestamp\":" + String(millis());
  payload += "}";

  int code = http.POST(payload);
  if (code > 0) {
    String resp = http.getString();
    Serial.print("POST resp: ");
    Serial.println(resp);
  } else {
    Serial.print("POST failed, error: ");
    Serial.println(code);
  }
  http.end();
}

void pollLedCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  String url = String(backend) + "/api/led-command/" + roadId;
  http.begin(url);
  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    // Expect JSON like: { "led":"none" } or { "led":"right" } or { "led":"left" }
    Serial.print("LED cmd resp: "); Serial.println(resp);
    if (resp.indexOf("\"right\"") >= 0) {
      digitalWrite(ledRight, HIGH);
      digitalWrite(ledLeft, LOW);
    } else if (resp.indexOf("\"left\"") >= 0) {
      digitalWrite(ledRight, LOW);
      digitalWrite(ledLeft, HIGH);
    } else {
      digitalWrite(ledRight, LOW);
      digitalWrite(ledLeft, LOW);
    }
  }
  http.end();
}

void loop() {
  unsigned long now = millis();
  if (now - lastSensorSend >= SEND_INTERVAL) {
    long d1 = readUltrasonicCM(trig1Pin, echo1Pin);
    long d2 = readUltrasonicCM(trig2Pin, echo2Pin);
    int mqRaw = readMQ();
    Serial.printf("d1=%ld d2=%ld mq=%d\n", d1, d2, mqRaw);
    sendSensorData(d1, d2, mqRaw);
    lastSensorSend = now;
  }

  if (now - lastPollCmd >= POLL_INTERVAL) {
    pollLedCommand();
    lastPollCmd = now;
  }
  delay(10);
}
