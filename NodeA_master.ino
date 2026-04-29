//nodeA
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#define MOISTURE_PIN 34

uint8_t nodeBAddress[] = {0xD4,0xE9,0xF4,0xB3,0xF1,0x2C};

const int espChannel = 11;

typedef struct {
  int raw;
} sensor_message;

sensor_message data;

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("Delivery to Node B: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "SUCCESS" : "FAIL");
}

void setup() {
  Serial.begin(115200);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  esp_wifi_set_channel(espChannel, WIFI_SECOND_CHAN_NONE);

  Serial.print("Node A MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP NOW INIT FAILED");
    return;
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, nodeBAddress, 6);
  peerInfo.channel = espChannel;
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to Add Node B");
    return;
  }

  esp_now_register_send_cb(OnDataSent);

  Serial.println("Node A Ready");
}

void loop() {
  data.raw = analogRead(MOISTURE_PIN);

  esp_now_send(nodeBAddress, (uint8_t *)&data, sizeof(data));

  Serial.print("Raw Moisture: ");
  Serial.println(data.raw);

  delay(2000);
}
