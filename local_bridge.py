"""
ForestGuard - Local Hardware Gateway Bridge
-------------------------------------------
Streams live telemetry from your local USB Arduino Nano to your Render-hosted website.

Usage:
    python local_bridge.py --url https://your-forestguard.onrender.com --port COM17
"""

import argparse
import json
import time
import requests
import serial
import serial.tools.list_ports

def parse_line(line: str):
    line = line.strip()
    if line.startswith("{") and line.endswith("}"):
        try:
            data = json.loads(line)
            if "temp" in data and "mq2" in data:
                return {
                    "temperature_c": float(data["temp"]) if data["temp"] is not None else None,
                    "mq2_raw": int(data["mq2"]),
                    "temp_valid": bool(data.get("temp_valid", True)),
                    "uptime_ms": data.get("uptime_ms"),
                    "serial_port": "REMOTE_ARDUINO_NANO"
                }
        except Exception:
            pass
    return None

def main():
    parser = argparse.ArgumentParser(description="ForestGuard Local Hardware Gateway")
    parser.add_argument("--url", required=True, help="Render website URL (e.g. https://forestguard.onrender.com)")
    parser.add_argument("--port", default="AUTO", help="COM port (e.g. COM17 or AUTO)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default: 115200)")
    args = parser.parse_args()

    api_url = f"{args.url.rstrip('/')}/api/telemetry/push"

    target_port = args.port
    if target_port == "AUTO":
        ports = serial.tools.list_ports.comports()
        nano_ports = [p.device for p in ports if any(k in p.description.lower() for k in ["ch340", "ftdi", "serial", "nano", "arduino", "usb"])]
        if nano_ports:
            target_port = nano_ports[0]
        elif ports:
            target_port = ports[0].device
        else:
            print("Error: No COM ports detected. Please plug in your Arduino Nano.")
            return

    print(f"Connecting to Arduino Nano on {target_port} at {args.baud} baud...")
    try:
        ser = serial.Serial(target_port, args.baud, timeout=1.0)
        # Flush any stale power-on noise from buffer
        ser.reset_input_buffer()
    except Exception as e:
        print(f"Failed to open {target_port}: {e}")
        return

    print(f"Streaming telemetry from {target_port} -> {api_url}")
    print("Press Ctrl+C to stop.\n")

    session = requests.Session()
    last_synced_temp = None
    last_synced_mq2 = None

    while True:
        try:
            # Drain any buffered backlog to guarantee we read the latest real-time frame
            line = ser.readline().decode("utf-8", errors="ignore")
            while ser.in_waiting > 0:
                fresh_line = ser.readline().decode("utf-8", errors="ignore")
                if fresh_line.strip().startswith("{") and fresh_line.strip().endswith("}"):
                    line = fresh_line

            packet = parse_line(line)
            if packet:
                res = session.post(api_url, json=packet, timeout=3.5)
                if res.status_code == 200:
                    res_json = res.json()
                    th_temp = res_json.get("threshold_temp")
                    th_mq2 = res_json.get("threshold_mq2")
                    if th_temp is not None and th_mq2 is not None:
                        if th_temp != last_synced_temp or th_mq2 != last_synced_mq2:
                            try:
                                ser.write(f"TH,{th_temp:.1f},{int(th_mq2)}\n".encode("utf-8"))
                                last_synced_temp = th_temp
                                last_synced_mq2 = th_mq2
                                print(f"[{time.strftime('%X')}] Synced custom thresholds to Arduino: Temp={th_temp:.1f}°C, MQ-2={th_mq2}")
                            except Exception as sync_err:
                                print(f"[{time.strftime('%X')}] Arduino threshold sync error: {sync_err}")

                    temp_display = f"{packet['temperature_c']:.1f}°C" if packet['temperature_c'] is not None else "FAULT"
                    print(f"[{time.strftime('%X')}] Forwarded: Temp={temp_display}, MQ-2={packet['mq2_raw']} -> Render OK")
                else:
                    print(f"[{time.strftime('%X')}] Render HTTP error: {res.status_code}")
        except KeyboardInterrupt:
            print("\nStopped.")
            break
        except Exception as e:
            print(f"[{time.strftime('%X')}] Network glitch: {e}")
            # Flush serial buffer after network delays to prevent lag buildup
            try:
                ser.reset_input_buffer()
            except Exception:
                pass
            time.sleep(0.5)

    ser.close()

if __name__ == "__main__":
    main()
