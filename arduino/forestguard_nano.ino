/*
 * ForestGuard - Arduino Nano Environmental Telemetry Firmware
 * 
 * Hardware Connections:
 * - DS18B20 Temperature Sensor: DATA -> D2 (with 4.7k ohm pull-up to 5V), VCC -> 5V, GND -> GND
 * - MQ-2 Smoke/Gas Sensor: AOUT -> A0, VCC -> 5V, GND -> GND
 * - I2C LCD (16x2 or 20x4): SDA -> A4, SCL -> A5, VCC -> 5V, GND -> GND
 * 
 * Serial Output:
 * Baud rate: 115200 bps
 * Format: Clean single-line JSON string followed by \n
 * Example: {"temp": 24.38, "mq2": 185, "temp_valid": true, "uptime_ms": 12400}
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// Pin definitions
#define ONE_WIRE_BUS 2
#define MQ2_PIN A0

// Sampling interval in milliseconds
const unsigned long SAMPLING_INTERVAL = 1000;
unsigned long lastSampleTime = 0;

// Setup OneWire and Dallas Temperature
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Setup I2C LCD - standard 16x2 address is usually 0x27 or 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2);
bool lcdAvailable = false;

// Dynamic local thresholds for LCD display feedback (customizable via serial from cloud/host)
float localTempThreshold = 50.0;
int localMq2Threshold = 400;

void setup() {
  // Initialize USB Serial communication at 115200 baud
  Serial.begin(115200);
  while (!Serial && millis() < 2000) {
    // Wait briefly for serial on USB-native chips if applicable
  }

  // Initialize temperature sensor
  sensors.begin();
  sensors.setWaitForConversion(true);

  // Initialize I2C LCD
  Wire.begin();
  // Check if LCD is responding at 0x27 or 0x3F
  Wire.beginTransmission(0x27);
  if (Wire.endTransmission() == 0) {
    lcd = LiquidCrystal_I2C(0x27, 16, 2);
    lcd.init();
    lcd.backlight();
    lcdAvailable = true;
  } else {
    Wire.beginTransmission(0x3F);
    if (Wire.endTransmission() == 0) {
      lcd = LiquidCrystal_I2C(0x3F, 16, 2);
      lcd.init();
      lcd.backlight();
      lcdAvailable = true;
    }
  }

  if (lcdAvailable) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ForestGuard v1.0");
    lcd.setCursor(0, 1);
    lcd.print("Init telemetry..");
    delay(1000);
    lcd.clear();
  }

  // Initial ready pulse
  Serial.println(F("{\"system\":\"ForestGuard\",\"firmware\":\"1.0\",\"status\":\"READY\"}"));
}

void loop() {
  // Check for incoming threshold sync commands from host/bridge (e.g. "TH,28.5,250")
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("TH,")) {
      int firstComma = cmd.indexOf(',');
      int secondComma = cmd.indexOf(',', firstComma + 1);
      if (secondComma > firstComma) {
        float newTemp = cmd.substring(firstComma + 1, secondComma).toFloat();
        int newMq2 = cmd.substring(secondComma + 1).toInt();
        if (newTemp >= -40.0 && newTemp <= 125.0) {
          localTempThreshold = newTemp;
        }
        if (newMq2 >= 0 && newMq2 <= 1023) {
          localMq2Threshold = newMq2;
        }
        Serial.print(F("{\"system\":\"ACK_THRESHOLDS\",\"temp_th\":"));
        Serial.print(localTempThreshold, 1);
        Serial.print(F(",\"mq2_th\":"));
        Serial.print(localMq2Threshold);
        Serial.println(F("}"));
      }
    }
  }

  unsigned long currentMillis = millis();

  if (currentMillis - lastSampleTime >= SAMPLING_INTERVAL) {
    lastSampleTime = currentMillis;

    // 1. Read MQ-2 raw analog value (0-1023)
    int mq2Raw = analogRead(MQ2_PIN);

    // 2. Read DS18B20 temperature
    sensors.requestTemperatures();
    float tempC = sensors.getTempCByIndex(0);

    // Validate temperature reading (-127 or 85 on startup error)
    bool tempValid = true;
    if (tempC == DEVICE_DISCONNECTED_C || tempC < -55.0 || tempC > 125.0 || tempC == 85.0) {
      // 85C is DS18B20 power-on reset value before first conversion completes
      // If persistently 85 or -127, treat as invalid
      tempValid = false;
    }

    // 3. Output formatted JSON to USB Serial
    Serial.print(F("{\"temp\":"));
    if (tempValid) {
      Serial.print(tempC, 2);
    } else {
      Serial.print(F("null"));
    }
    Serial.print(F(",\"mq2\":"));
    Serial.print(mq2Raw);
    Serial.print(F(",\"temp_valid\":"));
    Serial.print(tempValid ? F("true") : F("false"));
    Serial.print(F(",\"uptime_ms\":"));
    Serial.print(currentMillis);
    Serial.println(F("}"));

    // 4. Update I2C LCD display
    if (lcdAvailable) {
      // Line 1: Temperature and MQ2 raw
      lcd.setCursor(0, 0);
      lcd.print(F("T:"));
      if (tempValid) {
        if (tempC < 10.0 && tempC >= 0.0) lcd.print(' ');
        lcd.print(tempC, 1);
        lcd.print((char)223); // Degree symbol
        lcd.print(F("C "));
      } else {
        lcd.print(F("ERR   "));
      }

      lcd.print(F("MQ:"));
      lcd.print(mq2Raw);
      // Clear trailing space if mq2 dropped digits
      if (mq2Raw < 100) lcd.print(F("  "));
      else if (mq2Raw < 1000) lcd.print(' ');

      // Line 2: Status overview
      lcd.setCursor(0, 1);
      bool smokeHigh = (mq2Raw >= localMq2Threshold);
      bool tempHigh = (tempValid && tempC >= localTempThreshold);

      if (!tempValid) {
        lcd.print(F("STAT: SENSOR ERR"));
      } else if (smokeHigh && tempHigh) {
        lcd.print(F("STAT: FIRE ALERT"));
      } else if (smokeHigh || tempHigh) {
        lcd.print(F("STAT: WATCH     "));
      } else {
        lcd.print(F("STAT: NORMAL    "));
      }
    }
  }
}
