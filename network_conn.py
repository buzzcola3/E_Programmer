import network
import time

SSID = "BetakNET3"
PASSWORD = "Marian228"
AP_SSID = "e-P falsher"

def connect_wifi():
    station = network.WLAN(network.STA_IF)
    station.active(True)
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        print(f"Attempt {attempt}: Connecting to WiFi...")
        try:
            station.connect(SSID, PASSWORD)
        except OSError as e:
            print("WiFi connection error:", e)
            time.sleep(1)
            continue

        for _ in range(10):
            if station.isconnected():
                break
            time.sleep(1)

        if station.isconnected():
            print("Connected to WiFi:", station.ifconfig())
            return

    print("Failed to connect after multiple attempts.")
    enable_ap()

def enable_ap():
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid=AP_SSID)
    print("AP mode enabled:", ap.ifconfig())