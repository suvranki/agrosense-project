//nodeB
#include <esp_now.h>
#include <WiFi.h>
#include <esp_wifi.h>

// ===== NODE C MAC =====
uint8_t nodeCAddress[] = {0xD4,0xE9,0xF4,0xB4,0xB4,0x94};

// ===== CHANNEL (MATCH NODE C / ROUTER) =====
const int espChannel = 11;

// ===== TIMERS =====
unsigned long lastReceiveTime = 0;
const unsigned long timeoutLimit = 5000;
unsigned long lastPrintTime = 0;

// ===== STATUS =====
bool nodeA_status = false;

// ===== STRUCTURES =====

// From Node A
typedef struct {
  int raw;
} sensor_message;

// To Node C
typedef struct {
  int rawValue;
  int moisturePercent;
  char soilStatus[15];
  int rssiA;
  bool nodeA_status;
} struct_message;

sensor_message incomingData;
struct_message outgoingData = {0, 0, "NO DATA", 0, false};

// ===== SOIL CALCULATION =====
void calculateSoil(int raw) {
  outgoingData.rawValue = raw;
  outgoingData.moisturePercent = map(raw, 4095, 0, 0, 100);

  if (outgoingData.moisturePercent < 30)
    strcpy(outgoingData.soilStatus, "DRY");
  else if (outgoingData.moisturePercent < 60)
    strcpy(outgoingData.soilStatus, "MODERATE");
  else
    strcpy(outgoingData.soilStatus, "WET");
}

// ===== RECEIVE FROM NODE A =====
void OnDataRecv(const esp_now_recv_info *info, const uint8_t *data, int len) {
  memcpy(&incomingData, data, sizeof(incomingData));

  lastReceiveTime = millis();
  nodeA_status = true;

  calculateSoil(incomingData.raw);

  outgoingData.rssiA = info->rx_ctrl->rssi;
  outgoingData.nodeA_status = true;

  Serial.println("DATA RECEIVED FROM NODE A");
}

// ===== SEND STATUS TO NODE C =====
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("Delivery to Node C: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAIL");
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Match router / Node C channel
  esp_wifi_set_channel(espChannel, WIFI_SECOND_CHAN_NONE);

  Serial.print("Node B MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP NOW INIT FAILED");
    return;
  }

  // Add Node C as peer
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, nodeCAddress, 6);
  peerInfo.channel = espChannel;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to Add Node C");
    return;
  }

  esp_now_register_recv_cb(OnDataRecv);
  esp_now_register_send_cb(OnDataSent);

  Serial.println("Node B Ready");
  Serial.print("ESP-NOW Channel: ");
  Serial.println(espChannel);
  Serial.println("Waiting for Node A Data...\n");
}

// ===== LOOP =====
void loop() {

  // Node A timeout
  if (millis() - lastReceiveTime > timeoutLimit) {
    if (nodeA_status) {
      nodeA_status = false;
      outgoingData.nodeA_status = false;
      outgoingData.rssiA = 0;

      Serial.println("⚠ NODE A TIMEOUT");
    }
  }

  // Forward to Node C every 1 sec
  if (millis() - lastPrintTime >= 1000) {
    lastPrintTime = millis();

    Serial.println("------------ NODE B STATUS ------------");

    Serial.print("Raw Value: ");
    Serial.println(outgoingData.rawValue);

    Serial.print("Moisture %: ");
    Serial.println(outgoingData.moisturePercent);

    Serial.print("Soil Status: ");
    Serial.println(outgoingData.soilStatus);

    Serial.print("RSSI A wrt B: ");
    Serial.print(outgoingData.rssiA);
    Serial.println(" dBm");

    Serial.print("Node A Status: ");
    Serial.println(nodeA_status ? "CONNECTED" : "NOT RESPONDING");

    Serial.println("---------------------------------------");

    esp_err_t result = esp_now_send(
      nodeCAddress,
      (uint8_t *)&outgoingData,
      sizeof(outgoingData)
    );

    if (result == ESP_OK)
      Serial.println("Packet Queued to Node C\n");
    else
      Serial.println("ESP-NOW Send Error\n");
  }
}