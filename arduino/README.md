# ForestGuard — Arduino Nano Firmware & Hardware Guide

This directory contains the firmware for the **ForestGuard** environmental monitoring node using an Arduino Nano (ATmega328P).

---

## 1. Hardware Bill of Materials

| Component | Description | Connection Pin | Operating Voltage |
| :--- | :--- | :--- | :--- |
| **Arduino Nano** | ATmega328P (Old Bootloader or New Bootloader) | USB Mini/Type-C to PC | 5V |
| **DS18B20** | Digital Temperature Sensor (TO-92 or waterproof probe) | **D2** (OneWire Bus) | 3.3V – 5V |
| **4.7 kΩ Resistor** | Pull-up resistor for DS18B20 | Between **D2 (DATA)** & **5V** | — |
| **MQ-2 Sensor** | Gas / Smoke Analog Sensor | **A0** (Analog Out) | 5V (heater needs ~150mA) |
| **I2C LCD Display** | 16x2 or 20x4 LCD with PCF8574 I2C backpack | **A4** (SDA) / **A5** (SCL) | 5V |

---

## 2. Wiring Schematic

```
           +---------------------------------------+
           |             Arduino Nano              |
           |                                       |
           |  5V   GND   D2    A0    A4(SDA) A5(SCL)
           +---+----+----+-----+-------+-------+---+
               |    |    |     |       |       |
               |    |    |     |       |       |
  [+5V Rail]---+    |    |     |       |       |
  [GND Rail]--------+    |     |       |       |
                         |     |       |       |
  DS18B20 Pinout:        |     |       |       |
    - VCC  ---> 5V       |     |       |       |
    - GND  ---> GND      |     |       |       |
    - DATA ---> D2 <-----+     |       |       |
        (Note: 4.7kΩ resistor  |       |       |
         between 5V and D2)    |       |       |
                               |       |       |
  MQ-2 Pinout:                 |       |       |
    - VCC  ---> 5V             |       |       |
    - GND  ---> GND            |       |       |
    - AOUT ---> A0 <-----------+       |       |
    - DOUT ---> (Not connected)        |       |
                                       |       |
  I2C LCD 16x2:                        |       |
    - VCC  ---> 5V                     |       |
    - GND  ---> GND                    |       |
    - SDA  ---> A4 <-------------------+       |
    - SCL  ---> A5 <---------------------------+
```

> **Important Notes on Sensors:**
> 1. **DS18B20 Pull-up Resistor:** The OneWire bus requires a 4.7 kΩ pull-up resistor between `DATA` (D2) and `5V`. Without this resistor, the sensor will return `-127.00°C` or disconnect errors.
> 2. **MQ-2 Burn-in:** New MQ-2 sensors require an initial pre-heating period (24 hours for stable calibration, or at least 15–20 minutes before taking serious readings). The heater coil will feel warm to the touch.
> 3. **Raw ADC Readings:** MQ-2 values reported are raw ADC steps ($0 - 1023$ for a 10-bit ADC at 5V reference). These represent relative gas concentration, not calibrated PPM.

---

## 3. Required Arduino IDE Libraries

In the Arduino IDE (**Tools -> Manage Libraries...**), install:
1. **OneWire** by Jim Studt, Tom Pollard, Paul Stoffregen
2. **DallasTemperature** by Miles Burton
3. **LiquidCrystal I2C** by Frank de Brabander (or Marco Schwartz)

---

## 4. Flashing Instructions

1. Open `forestguard_nano.ino` in the Arduino IDE.
2. Select Board: **Tools -> Board -> Arduino AVR Boards -> Arduino Nano**.
3. Select Processor: **ATmega328P** (or **ATmega328P (Old Bootloader)** if using common clone boards).
4. Select Port: **Tools -> Port -> COM[x]** (e.g. `COM3` or `COM4` on Windows).
5. Click **Upload**.

---

## 5. Serial Output Format

The firmware streams telemetry at **115200 baud** once every 1000 ms:

```json
{"temp":24.38,"mq2":185,"temp_valid":true,"uptime_ms":12400}
```

If the temperature sensor fails or is unplugged:
```json
{"temp":null,"mq2":188,"temp_valid":false,"uptime_ms":13400}
```

The Python sensor bridge in ForestGuard automatically parses this format, handles reconnects, and streams live data into the dashboard via WebSockets.
