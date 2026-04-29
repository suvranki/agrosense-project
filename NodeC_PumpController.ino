//nodeC
#include <esp_now.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <esp_wifi.h>

WebServer server(80);

#define pumpPin 5

// ===== NODE B MAC =====
uint8_t nodeBAddress[] = {0xD4,0xE9,0xF4,0xB3,0xF1,0x2C};

// ===== WIFI CREDENTIALS =====
const char* WIFI_SSID = "ECE";
const char* WIFI_PASS = "silicon@123";

// ===== SUPABASE =====
const char* SUPABASE_URL = "https://xewdhcgdueqsgijflkoz.supabase.co/rest/v1/sensor_readings";
const char* SUPABASE_KEY = "sb_publishable_yEH3s94-1hZwEh2tsUih_A_VzfqlA6a";
const char* DEVICE_ID = "NodeC_01";

// ===== TIMERS =====
unsigned long lastReceiveTime = 0;
const unsigned long timeoutLimit = 5000;

unsigned long lastPrintTime = 0;
unsigned long lastUploadTime = 0;
const unsigned long uploadInterval = 10000;

// ===== STATUS =====
bool nodeB_status = false;
bool nodeA_status = false;

bool pumpAuto = true;
bool pumpState = false;

int rssiB_value = 0;
int wifiChannel = 1;

// ===== DATA STRUCT =====
typedef struct {
  int rawValue;
  int moisturePercent;
  char soilStatus[15];
  int rssiA;
  bool nodeA_status;
} struct_message;

struct_message incomingData = {0, 0, "NO DATA", 0, false};

// ===== RSSI QUALITY =====
String getRSSIQuality(int rssi) {
  if (rssi >= -60) return "EXCELLENT";
  else if (rssi >= -70) return "GOOD";
  else if (rssi >= -80) return "FAIR";
  else return "WEAK";
}

// ===== ESP-NOW RECEIVE =====
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *data, int len) {
  memcpy(&incomingData, data, sizeof(incomingData));

  lastReceiveTime = millis();
  nodeB_status = true;
  nodeA_status = incomingData.nodeA_status;
  rssiB_value = info->rx_ctrl->rssi;

  Serial.println("DATA RECEIVED FROM NODE B");

  if (pumpAuto) {
    if (strcmp(incomingData.soilStatus, "DRY") == 0) {
      digitalWrite(pumpPin, HIGH);
      pumpState = true;
    } else {
      digitalWrite(pumpPin, LOW);
      pumpState = false;
    }
  }
}

// ===== SUPABASE UPLOAD =====
void sendToSupabase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Offline - Upload Skipped");
    return;
  }

  HTTPClient http;
  http.begin(SUPABASE_URL);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Prefer", "return=minimal");

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"raw_value\":" + String(incomingData.rawValue) + ",";
  payload += "\"moisture_percent\":" + String(incomingData.moisturePercent) + ",";
  payload += "\"soil_status\":\"" + String(incomingData.soilStatus) + "\",";
  payload += "\"rssi_a\":" + String(incomingData.rssiA) + ",";
  payload += "\"rssi_b\":" + String(rssiB_value) + ",";
  payload += "\"node_a_status\":" + String(nodeA_status ? "true" : "false") + ",";
  payload += "\"node_b_status\":" + String(nodeB_status ? "true" : "false") + ",";
  payload += "\"pump_mode\":\"" + String(pumpAuto ? "AUTO" : "MANUAL") + "\",";
  payload += "\"pump_state\":" + String(pumpState ? "true" : "false");
  payload += "}";

  int code = http.POST(payload);

  Serial.print("Supabase POST Code: ");
  Serial.println(code);

  http.end();
}

// ===== DASHBOARD =====
void handleRoot() {
  if (server.hasArg("mode"))
    pumpAuto = (server.arg("mode") == "auto");

  if (!pumpAuto && server.hasArg("pump")) {
    pumpState = (server.arg("pump") == "on");
    digitalWrite(pumpPin, pumpState ? HIGH : LOW);
  }

  String html = "<html><head><meta http-equiv='refresh' content='1'></head><body>";
  html += "<h2>NODE C DASHBOARD</h2><hr>";

  html += "<b>Raw Value:</b> " + String(incomingData.rawValue) + "<br>";
  html += "<b>Moisture %:</b> " + String(incomingData.moisturePercent) + "%<br>";
  html += "<b>Soil Status:</b> " + String(incomingData.soilStatus) + "<br><br>";

  html += "<b>RSSI B wrt C:</b> " + String(rssiB_value) + " dBm (" + getRSSIQuality(rssiB_value) + ")<br>";
  html += "<b>RSSI A wrt B:</b> " + String(incomingData.rssiA) + " dBm (" + getRSSIQuality(incomingData.rssiA) + ")<br><br>";

  html += "<b>WiFi Channel:</b> " + String(wifiChannel) + "<br>";
  html += "<b>Pump Mode:</b> " + String(pumpAuto ? "AUTO" : "MANUAL") + "<br>";
  html += "<b>Pump State:</b> " + String(pumpState ? "ON" : "OFF") + "<br><br>";

  html += "<a href='/?mode=auto'>AUTO</a> | ";
  html += "<a href='/?mode=manual'>MANUAL</a><br><br>";

  if (!pumpAuto) {
    html += "<a href='/?mode=manual&pump=on'>PUMP ON</a> | ";
    html += "<a href='/?mode=manual&pump=off'>PUMP OFF</a><br><br>";
  }

  html += nodeB_status
    ? "<h3 style='color:green;'>NODE B CONNECTED</h3>"
    : "<h3 style='color:red;'>NODE B NOT RESPONDING</h3>";

  html += nodeA_status
    ? "<h3 style='color:green;'>NODE A CONNECTED</h3>"
    : "<h3 style='color:red;'>NODE A NOT RESPONDING</h3>";

  html += "</body></html>";

  server.send(200, "text/html", html);
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);

  pinMode(pumpPin, OUTPUT);
  digitalWrite(pumpPin, LOW);

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  wifiChannel = WiFi.channel();

  Serial.print("Router / WiFi Channel: ");
  Serial.println(wifiChannel);

  esp_wifi_set_channel(wifiChannel, WIFI_SECOND_CHAN_NONE);

  WiFi.softAP("NodeC_AP", "12345678", wifiChannel);

  Serial.print("Node C MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP NOW INIT FAILED");
    return;
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, nodeBAddress, 6);
  peerInfo.channel = wifiChannel;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to Add Node B");
    return;
  }

  esp_now_register_recv_cb(OnDataRecv);

  server.on("/", handleRoot);
  server.begin();

  Serial.println("Node C Ready");
}

// ===== LOOP =====
void loop() {
  if (millis() - lastReceiveTime > timeoutLimit) {
    nodeB_status = false;
    nodeA_status = false;

    digitalWrite(pumpPin, LOW);
    pumpState = false;
  }

  if (millis() - lastUploadTime >= uploadInterval) {
    lastUploadTime = millis();
    sendToSupabase();
  }

  if (millis() - lastPrintTime >= 1000) {
    lastPrintTime = millis();

    Serial.println("------------ STATUS ------------");
    Serial.print("Raw Value: "); Serial.println(incomingData.rawValue);
    Serial.print("Moisture %: "); Serial.println(incomingData.moisturePercent);
    Serial.print("Soil Status: "); Serial.println(incomingData.soilStatus);
    Serial.print("RSSI B wrt C: "); Serial.println(rssiB_value);
    Serial.print("RSSI A wrt B: "); Serial.println(incomingData.rssiA);
    Serial.print("WiFi Channel: "); Serial.println(wifiChannel);
    Serial.print("Pump Mode: "); Serial.println(pumpAuto ? "AUTO" : "MANUAL");
    Serial.print("Pump State: "); Serial.println(pumpState ? "ON" : "OFF");

    if (!nodeB_status) Serial.println("NODE B NOT RESPONDING");
    if (!nodeA_status) Serial.println("NODE A NOT RESPONDING");

    Serial.println("--------------------------------\n");
  }

  server.handleClient();
}