from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import requests
import os

app = Flask(__name__, static_folder=".")
CORS(app)

WMO_LABELS = {
    0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy Fog", 51: "Light Drizzle", 53: "Moderate Drizzle",
    55: "Dense Drizzle", 61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
    77: "Snow Grains", 80: "Slight Showers", 81: "Moderate Showers",
    82: "Violent Showers", 85: "Slight Snow Showers", 86: "Heavy Snow Showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Heavy Thunderstorm w/ Hail"
}

HEAVY_CODES = [65, 81, 82, 95, 96, 99]

def derive_signal_number(wind_kph, pressure_hpa, wmo_code):
    if pressure_hpa < 900 or wind_kph >= 220:
        return 5
    if pressure_hpa < 930 or wind_kph >= 185:
        return 4
    if pressure_hpa < 960 or wind_kph >= 150:
        return 3
    if pressure_hpa < 980 or wind_kph >= 90:
        return 2
    if pressure_hpa < 995 or wind_kph >= 60:
        return 1
    if pressure_hpa < 1005 and (wmo_code in HEAVY_CODES or wind_kph >= 40):
        return 1
    return 0

def classify(wind_kph, pressure_hpa, wmo_code):
    signal = derive_signal_number(wind_kph, pressure_hpa, wmo_code)
    lpa_condition = pressure_hpa < 1010 and wind_kph >= 30

    if signal >= 1 and wind_kph >= 60:
        return {
            "type": "typhoon",
            "label": "TYPHOON / BAGYO" if signal >= 3 else "TROPICAL STORM",
            "icon": "🌀",
            "signal": signal,
            "desc": (
                f"Typhoon conditions detected. Wind speed of {wind_kph:.0f} kph "
                f"with surface pressure at {pressure_hpa:.1f} hPa indicates an active "
                f"tropical cyclone. Signal No. {signal} protocol applies."
            )
        }

    if lpa_condition or (pressure_hpa < 1008 and wmo_code in HEAVY_CODES):
        return {
            "type": "lpa",
            "label": "LOW PRESSURE AREA",
            "icon": "🌧️",
            "signal": 0,
            "desc": (
                f"Low Pressure Area (LPA) detected. Atmospheric pressure at "
                f"{pressure_hpa:.1f} hPa is below normal (1013 hPa). Expect cloudy skies, "
                f"gusty winds, and intermittent rain. May develop into a tropical cyclone."
            )
        }

    return {
        "type": "clear",
        "label": "NO WEATHER DISTURBANCE",
        "icon": "🌤️",
        "signal": 0,
        "desc": (
            f"Atmospheric conditions are stable. Pressure at {pressure_hpa:.1f} hPa "
            f"is normal. No active LPA or tropical cyclone detected in this area."
        )
    }

def wind_direction(deg):
    dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
    return dirs[round(deg / 22.5) % 16]

def get_cyclone_class(wind_kph):
    if wind_kph < 60:   return "—"
    if wind_kph < 90:   return "TROPICAL DEPRESSION"
    if wind_kph < 120:  return "TROPICAL STORM"
    if wind_kph < 150:  return "SEVERE TROPICAL STORM"
    if wind_kph < 185:  return "TYPHOON"
    if wind_kph < 220:  return "SUPER TYPHOON"
    return "CATEGORY 5+"

def get_pressure_status(pressure_hpa):
    if pressure_hpa < 960:  return "DEEP LOW"
    if pressure_hpa < 980:  return "INTENSE LOW"
    if pressure_hpa < 1005: return "LOW PRESSURE"
    if pressure_hpa < 1013: return "SLIGHTLY LOW"
    return "NORMAL"

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/css/<path:filename>")
def css_files(filename):
    return send_from_directory("css", filename)

@app.route("/js/<path:filename>")
def js_files(filename):
    return send_from_directory("js", filename)

@app.route("/api/weather")
def weather():
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameters"}), 400

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,"
            f"surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m"
            f"&wind_speed_unit=ms&timezone=Asia/Manila"
        )
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        raw = resp.json()

        current = raw.get("current", {})
        wind_kph = (current.get("wind_speed_10m", 0)) * 3.6
        pressure_hpa = current.get("surface_pressure", 1013)
        humidity = current.get("relative_humidity_2m", 0)
        temp = current.get("temperature_2m", 0)
        wmo_code = current.get("weather_code", 0)
        wind_deg = current.get("wind_direction_10m", 0)
        wind_gusts_kph = (current.get("wind_gusts_10m", 0)) * 3.6

        result = classify(wind_kph, pressure_hpa, wmo_code)

        return jsonify({
            "classification": result,
            "metrics": {
                "wind_kph": round(wind_kph, 1),
                "wind_direction": wind_direction(wind_deg),
                "wind_deg": round(wind_deg),
                "wind_gusts_kph": round(wind_gusts_kph, 1),
                "pressure_hpa": round(pressure_hpa, 1),
                "pressure_status": get_pressure_status(pressure_hpa),
                "humidity": round(humidity),
                "temperature": round(temp, 1),
                "wmo_code": wmo_code,
                "wmo_label": WMO_LABELS.get(wmo_code, f"Code {wmo_code}"),
                "cyclone_class": get_cyclone_class(wind_kph),
            }
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "Request to weather API timed out"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Weather API error: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    print("PH Climate Detector running at http://localhost:5000")
    app.run(debug=True, port=5000)
