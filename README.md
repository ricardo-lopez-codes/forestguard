# ForestGuard — Forest Environmental Monitoring & Early-Warning System

**ForestGuard** is an environmental telemetry dashboard and early-warning prototype designed for forest fire threat detection. It pairs an **Arduino Nano** edge sensor node (DS18B20 digital temperature probe, MQ-2 analog smoke/gas sensor, and I2C LCD) with a **Python FastAPI** backend telemetry bridge and a responsive **React (Vite)** dashboard.

---

## 1. System Architecture

```
 +--------------------------------------------------------------------------+
 |                              EDGE NODE                                   |
 |  [DS18B20 Temp Probe (D2)]  [MQ-2 Smoke Sensor (A0)]  [I2C LCD (A4/A5)]  |
 |                                |                                         |
 |                       Arduino Nano (ATmega328P)                          |
 +--------------------------------+-----------------------------------------+
                                  | USB Serial (115200 Baud, JSON frames)
                                  v
 +--------------------------------------------------------------------------+
 |                        FORESTGUARD BACKEND (Python)                      |
 |  - Serial Bridge (pyserial / auto-reconnect)                             |
 |  - Rule-Based Alert Evaluator (Dual-condition verification)              |
 |  - Debounce Filter & State Transition Engine                             |
 |  - SQLite Persistence (Telemetry history, incident logs, settings)      |
 |  - Notification Service (ntfy.sh push notifications & generic webhooks)  |
 |  - Real-time WebSocket Broadcaster (/ws/telemetry)                       |
 +--------------------------------+-----------------------------------------+
                                  | WebSocket & REST API
                                  v
 +--------------------------------------------------------------------------+
 |                      FORESTGUARD OPERATOR DASHBOARD                      |
 |  - Minimal, high-contrast, information-dense engineering UI              |
 |  - Operational Status: NORMAL, WATCH, POTENTIAL FIRE ALERT, SENSOR ERROR |
 |  - DS18B20 Time-Series Chart (15m, 1h, 6h, 24h, non-interpolating)      |
 |  - Raw MQ-2 Analog ADC Gauge & Trend Slope Analyzer                      |
 |  - Filterable & Acknowledgeable Incident Log                             |
 |  - Live Hardware vs Explicit Simulation Mode Switcher                    |
 +--------------------------------------------------------------------------+
```

---

## 2. Hardware Wiring & Setup

### Bill of Materials
- **Arduino Nano** (ATmega328P)
- **DS18B20** digital temperature sensor (waterproof probe or TO-92)
- **4.7 kΩ pull-up resistor** (between DS18B20 DATA and 5V)
- **MQ-2** gas / smoke sensor
- **I2C 16x2 LCD Display** (PCF8574 backpack, default address `0x27` or `0x3F`)
- USB cable to host computer

### Pin Mapping

| Peripheral | Sensor Pin | Arduino Nano Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DS18B20** | DATA | **D2** | **Requires 4.7kΩ resistor between D2 and 5V** |
| | VCC | 5V | Power |
| | GND | GND | Ground |
| **MQ-2** | AOUT | **A0** | Raw 10-bit analog conversion (0–1023) |
| | VCC | 5V | Heater requires ~150mA |
| | GND | GND | Ground |
| **I2C LCD** | SDA | **A4** | Hardware I2C data |
| | SCL | **A5** | Hardware I2C clock |
| | VCC / GND | 5V / GND | Power |

### Flashing the Arduino Nano
1. Open the Arduino IDE.
2. Install libraries via **Library Manager**:
   - `OneWire` (by Jim Studt, Paul Stoffregen)
   - `DallasTemperature` (by Miles Burton)
   - `LiquidCrystal I2C` (by Frank de Brabander)
3. Open `arduino/forestguard_nano.ino`.
4. Select **Tools -> Board -> Arduino AVR Boards -> Arduino Nano**.
5. Select **Tools -> Processor -> ATmega328P** (or *ATmega328P (Old Bootloader)* for standard clone boards).
6. Select your COM port and click **Upload**.

---

## 3. Serial Telemetry Protocol

The Arduino Nano emits structured JSON strings at **115200 baud** once per second:

```json
{"temp": 24.38, "mq2": 185, "temp_valid": true, "uptime_ms": 12400}
```

If the temperature probe is disconnected or faults, it immediately signals:
```json
{"temp": null, "mq2": 190, "temp_valid": false, "uptime_ms": 13400}
```

The Python backend automatically parses this format, handles serial reconnects, filters sensor glitches, and streams verified frames to connected dashboards over WebSockets.

---

## 4. Alert Evaluation & State Machine

The alerting engine enforces strict dual-condition verification to prevent false alarms while ensuring elevated anomalies are never silently masked:

$$\text{smoke\_detected} = (\text{mq2\_raw} \ge \text{threshold\_mq2})$$
$$\text{high\_temperature} = (\text{temp\_valid} \land \text{temp\_c} \ge \text{threshold\_temp})$$

### Operational Status Rules

| Evaluated Conditions | System Status | Operator Meaning |
| :--- | :--- | :--- |
| $\neg\text{temp\_valid}$ | **SENSOR ERROR** | Temperature probe failure or wire disconnect. |
| $\text{smoke\_detected} \land \text{high\_temperature}$ | **POTENTIAL FIRE ALERT** | **CRITICAL:** Both smoke and thermal spike confirmed. Dispatches push alarm. |
| $\text{smoke\_detected} \oplus \text{high\_temperature}$ | **WATCH** | Single parameter anomaly. Heightened vigilance required. |
| Both below thresholds | **NORMAL** | Environmental conditions within baseline limits. |
| Telemetry stale $> 5\text{s}$ | **OFFLINE** | Bridge link interrupted or serial cable unplugged. |

### Debouncing & Persistence
To prevent transient ADC noise or single-sample electrical spikes from triggering false alarms, the evaluator requires a configurable number of consecutive samples (default: **3 samples**) before promoting the operational status or dispatching push alarms.

---

## 5. Phone Push Notifications (ntfy.sh & Webhooks)

ForestGuard features an integrated push notification service supporting **ntfy.sh** (zero-setup push to iOS, Android, and Web) and generic HTTP webhooks.

### 30-Second Phone Setup with ntfy
1. Install the free **ntfy** app from Google Play Store or Apple App Store (or open [https://ntfy.sh](https://ntfy.sh) in your browser).
2. Tap **+ (Subscribe to topic)** and enter a unique topic name, for example: `forestguard-alert-node1`.
3. In the ForestGuard Dashboard, click **Settings -> Push Notifications**.
4. Check **Enable Phone Notifications**, set Provider to **ntfy**, and enter your topic name (`forestguard-alert-node1`).
5. Click **Send Test Notification**. Your phone will immediately ring and display a confirmed push alert!

### Notification Lifecycle
- **Alert Dispatch:** Sends an urgent high-priority alarm with loud sound when first entering `POTENTIAL FIRE ALERT`.
- **Deduplication:** Prevents notification spam while the alert condition continues.
- **Resolution Dispatch:** Dispatches a cleared notification when conditions stabilize and return to `NORMAL`.
- **Delivery Logging:** Every attempt records provider HTTP response codes in the database and never marks delivered unless confirmed.

---

## 6. Installation & Quick Start (Windows)

### Prerequisites
- Python 3.10+ (Python 3.13 tested)
- Node.js 18+ (Node.js 24 tested) and npm

### Step 1: Clone or Navigate to the Project
```powershell
cd C:\Users\knigh\.gemini\antigravity\scratch\forestguard
```

### Step 2: Set Up Python Backend
```powershell
cd backend
python -m pip install -r requirements.txt
```

### Step 3: Run Backend & Dashboard
You can launch the complete system in one command:
```powershell
python run.py
```
Open your browser to:
```
http://localhost:8000
```
> **Note:** The backend automatically serves the pre-compiled production frontend from `http://localhost:8000`.

### Step 4: (Optional) Frontend Development Server
If you wish to modify frontend React components with instant hot-module-reloading:
```powershell
cd ../frontend
npm install
npm run dev
```
Open your browser to `http://localhost:3000`.

---

## 7. Testing & Verification

ForestGuard includes both an automated test suite and an interactive scenario simulation panel for end-to-end verification without requiring physical hardware.

### Automated Unit & Integration Tests
Run pytest in the backend directory:
```powershell
cd backend
python -m pytest tests/ -v
```
All 20 test cases verify:
- Core rule evaluation (Normal, Watch Smoke, Watch Temp, Fire Alert, Sensor Error)
- Debounce filter noise suppression
- Serial packet parser (JSON & CSV fallback, bounds validation, malformed frame recovery)
- REST API endpoints and database persistence
- Notification state deduplication

### Interactive Scenario Simulator
In the dashboard header or inside **Settings -> Hardware & Serial**, select any test scenario to observe live dashboard reactions:
1. **Normal (Clear):** Temperature ~24°C, MQ-2 ~160. Status: `NORMAL`.
2. **Watch (High Smoke Only):** Smoke ramps to 650, Temp stays 24°C. Status: `WATCH`.
3. **Watch (High Temp Only):** Temp ramps to 56°C, Smoke stays 170. Status: `WATCH`.
4. **Fire Alert (Both Breached):** Temp ramps to 58.5°C, Smoke ramps to 680. Status: `POTENTIAL FIRE ALERT` (triggers push alarm).
5. **Sensor Error:** Simulates DS18B20 wire disconnect (`temp_valid: false`). Status: `SENSOR ERROR`.
6. **Cooling / Recovery:** Returns to baseline. Status transitions back to `NORMAL` (triggers resolved notification).

---

## 8. Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Status shows OFFLINE** | Serial cable unplugged, wrong COM port, or bridge not running. | Check **Settings -> Hardware**, verify the COM port, or switch to **Simulation Mode** if testing without hardware. |
| **Temperature displays -127°C or SENSOR ERROR** | Missing pull-up resistor on DS18B20. | Connect a 4.7 kΩ resistor between `D2 (DATA)` and `5V`. Ensure proper ground connection. |
| **MQ-2 reading is 1023 continuously** | Sensor not warmed up or shorted to 5V. | MQ-2 requires a 15–20 minute warm-up period. Ensure analog output is connected to `A0`. |
| **COM port Access Denied on Windows** | Port is opened by Arduino Serial Monitor or another program. | Close the Arduino IDE Serial Monitor before connecting the ForestGuard bridge. |
| **Notifications not arriving on phone** | Incorrect ntfy topic or phone do-not-disturb mode. | Check `Settings -> Notification Logs`. Ensure your phone ntfy app is subscribed to the exact case-sensitive topic. |

---

## 9. Project File Structure

```
forestguard/
├── arduino/
│   ├── forestguard_nano.ino       # Arduino Nano firmware (DS18B20, MQ-2, I2C LCD, JSON serial)
│   └── README.md                  # Arduino hardware guide, pinouts, and library requirements
├── backend/
│   ├── app/
│   │   ├── models/                # SQLAlchemy models (telemetry, event, settings, notification)
│   │   ├── routers/               # REST & WebSocket endpoints (telemetry, events, settings, serial, ws)
│   │   ├── services/
│   │   │   ├── alert_evaluator.py # Dual-condition alert evaluation & debounce persistence
│   │   │   ├── sensor_bridge.py   # USB serial reader & deterministic scenario simulator
│   │   │   └── notifications/     # Notification service (ntfy provider & webhook provider)
│   │   ├── config.py              # Application settings and threshold defaults
│   │   ├── database.py            # SQLite database initialization
│   │   └── main.py                # FastAPI ASGI application & static frontend mount
│   ├── tests/                     # 20 automated pytest test cases
│   ├── requirements.txt           # Python backend dependencies
│   ├── run.py                     # Single-command server launcher
│   └── .env.example               # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/            # Header, OverallStatus, TemperatureSection, SmokeSection, EventHistory, SettingsModal
│   │   ├── hooks/useTelemetry.ts  # Real-time WebSocket hook with fallback polling
│   │   ├── services/api.ts        # Typed REST API service
│   │   ├── types.ts               # Domain TypeScript definitions
│   │   ├── index.css              # Minimal, high-contrast engineering CSS design system
│   │   └── App.tsx                # Main responsive dashboard layout
│   ├── package.json
│   └── vite.config.ts             # Vite configuration with API & WebSocket proxy
└── README.md                      # Comprehensive system documentation
```
