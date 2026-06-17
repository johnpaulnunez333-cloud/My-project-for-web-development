const WMO_LABELS = {
  0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy Fog", 51: "Light Drizzle", 53: "Moderate Drizzle",
  55: "Dense Drizzle", 61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
  71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
  77: "Snow Grains", 80: "Slight Showers", 81: "Moderate Showers",
  82: "Violent Showers", 85: "Slight Snow Showers", 86: "Heavy Snow Showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Heavy Thunderstorm w/ Hail"
};

function wmoLabel(code) {
  return WMO_LABELS[code] ?? `Code ${code}`;
}


function setStatus(type, text) {
  const alert = document.getElementById("statusAlert");
  const dot = document.getElementById("statusDot");
  const span = document.getElementById("statusText");
  alert.className = "status-alert " + type;
  dot.className = "dot " + (
    type === "clear" ? "green" :
    type === "lpa" ? "yellow" :
    type === "typhoon" ? "red" :
    type === "error" ? "orange" : ""
  );
  span.textContent = text;
}

function buildBarFill(pct, color) {
  return `<div class="metric-bar"><div class="metric-bar-fill" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>`;
}

function buildScaleBlocks(active, total, color) {
  let html = '<div class="scale-row">';
  for (let i = 0; i < total; i++) {
    html += `<div class="scale-block" style="${i < active ? 'background:' + color : ''}"></div>`;
  }
  html += '</div>';
  return html;
}



async function runScan() {
  const select = document.getElementById("locationSelect");
  const btn = document.getElementById("scanBtn");
  const [lat, lon] = select.value.split(",");
  const locationName = select.options[select.selectedIndex].text;

  btn.disabled = true;
  btn.textContent = "SCANNING...";
  setStatus("loading", `Scanning atmospheric data for ${locationName}...`);

  document.getElementById("mainDisplay").innerHTML = `
    <div class="placeholder-state">
      <div class="spinner"></div>
      <div class="placeholder-text">FETCHING SYNOPTIC DATA...</div>
    </div>
  `;
  document.getElementById("signalGrid").style.display = "none";

  try {
    const res = await fetch(`https://my-project-for-web-development-1.onrender.com/api/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Server error: " + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderFromBackend(data, locationName);
  } catch (err) {
    setStatus("error", "ERROR: Unable to fetch data. Check your internet connection.");
    document.getElementById("mainDisplay").innerHTML = `
      <div class="placeholder-state">
        <div class="placeholder-icon">⚠️</div>
        <div class="placeholder-text">CONNECTION FAILED — ${err.message}</div>
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.textContent = "SCAN";
  }
}

function renderFromBackend(data, location) {
  const { classification: result, metrics: m } = data;
  const signal = result.signal;

  setStatus(result.type,
    result.type === "typhoon" ? `⚠ ACTIVE TROPICAL CYCLONE DETECTED — ${location.toUpperCase()}` :
    result.type === "lpa"    ? `⚡ LOW PRESSURE AREA DETECTED — ${location.toUpperCase()}` :
                               `✔ NO WEATHER DISTURBANCE — ${location.toUpperCase()}`
  );

  const pressurePct = Math.max(0, Math.min(100, (1050 - m.pressure_hpa) / (1050 - 880) * 100));
  const windPct = Math.min(100, m.wind_kph / 250 * 100);

  const pressureColor = m.pressure_hpa < 960 ? "var(--red)" : m.pressure_hpa < 995 ? "var(--orange)" : m.pressure_hpa < 1010 ? "var(--yellow)" : "var(--green)";
  const windColor = m.wind_kph >= 150 ? "var(--red)" : m.wind_kph >= 90 ? "var(--orange)" : m.wind_kph >= 40 ? "var(--yellow)" : "var(--green)";

  const signalClass = `s${Math.min(signal, 5)}`;
  const signalNames = ["SIGNAL 0 — SAFE","SIGNAL 1 — ALERT","SIGNAL 2 — WARNING","SIGNAL 3 — DANGER","SIGNAL 4 — CRITICAL","SIGNAL 5 — EXTREME"];
  const signalColors = ["var(--green)","var(--yellow)","var(--orange)","var(--red)","var(--red)","var(--red)"];

  document.getElementById("mainDisplay").innerHTML = `
    <div class="big-card ${result.type}">
      <div class="status-icon">${result.icon}</div>
      <div class="status-info">
        <div class="status-tag ${result.type}">${result.label}</div>
        <div class="status-desc">${result.desc}</div>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-label">SURFACE PRESSURE</div>
      <div class="metric-value">${m.pressure_hpa}</div>
      <div class="metric-unit">hPa · normal: 1013.25</div>
      ${buildBarFill(pressurePct, pressureColor)}
    </div>
    <div class="metric-card">
      <div class="metric-label">WIND SPEED</div>
      <div class="metric-value">${m.wind_kph}</div>
      <div class="metric-unit">km/h · ${m.wind_direction} (${m.wind_deg}°)</div>
      ${buildBarFill(windPct, windColor)}
    </div>
    <div class="metric-card">
      <div class="metric-label">WIND GUSTS</div>
      <div class="metric-value">${m.wind_gusts_kph}</div>
      <div class="metric-unit">km/h maximum gust</div>
      ${buildBarFill(Math.min(100, m.wind_gusts_kph / 250 * 100), windColor)}
    </div>
    <div class="metric-card">
      <div class="metric-label">TEMPERATURE</div>
      <div class="metric-value">${m.temperature}</div>
      <div class="metric-unit">°C surface air temperature</div>
      ${buildBarFill(Math.min(100, (m.temperature + 10) / 60 * 100), "var(--orange)")}
    </div>
    <div class="metric-card">
      <div class="metric-label">HUMIDITY</div>
      <div class="metric-value">${m.humidity}</div>
      <div class="metric-unit">% relative humidity</div>
      ${buildBarFill(m.humidity, "var(--accent)")}
    </div>
    <div class="metric-card">
      <div class="metric-label">WEATHER CONDITION</div>
      <div class="metric-value" style="font-size:16px;margin-top:4px">${m.wmo_label}</div>
      <div class="metric-unit">WMO Code ${m.wmo_code}</div>
      ${buildBarFill(m.wmo_code > 50 ? 80 : m.wmo_code > 2 ? 40 : 15, "var(--accent2)")}
    </div>
  `;

  document.getElementById("signalGrid").style.display = "grid";
  document.getElementById("signalGrid").innerHTML = `
    <div class="signal-card">
      <div class="signal-label">PAGASA SIGNAL</div>
      <div class="signal-number ${signalClass}">${signal > 0 ? "#" + signal : "—"}</div>
      <div class="signal-name">${signalNames[signal]}</div>
    </div>
    <div class="signal-card">
      <div class="signal-label">CYCLONE CLASS</div>
      <div style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:${signalColors[signal]};padding:16px 0;text-align:center;line-height:1.3">${m.cyclone_class}</div>
      <div class="signal-name">CLASSIFICATION</div>
    </div>
    <div class="signal-card">
      <div class="signal-label">PRESSURE STATUS</div>
      <div style="font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;color:${pressureColor};padding:16px 0;text-align:center;line-height:1.3">${m.pressure_status}</div>
      <div class="signal-name">${m.pressure_hpa} hPa</div>
    </div>
    <div class="signal-card">
      <div class="signal-label">WIND THREAT LEVEL</div>
      ${buildScaleBlocks(Math.ceil(windPct / 25), 4, windColor)}
      <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:700;color:${windColor};margin-top:8px">
        ${m.wind_kph < 30 ? "CALM" : m.wind_kph < 60 ? "MODERATE" : m.wind_kph < 120 ? "HIGH" : "EXTREME"}
      </div>
    </div>
    <div class="signal-card">
      <div class="signal-label">RAIN POTENTIAL</div>
      ${buildScaleBlocks(m.wmo_code >= 80 ? 4 : m.wmo_code >= 60 ? 3 : m.wmo_code >= 50 ? 2 : m.wmo_code >= 3 ? 1 : 0, 4, "var(--accent)")}
      <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:700;color:var(--accent);margin-top:8px">
        ${m.wmo_code >= 80 ? "HEAVY" : m.wmo_code >= 60 ? "MODERATE" : m.wmo_code >= 50 ? "LIGHT" : m.wmo_code >= 3 ? "LOW" : "NONE"}
      </div>
    </div>
    <div class="signal-card">
      <div class="signal-label">OVERALL RISK</div>
      ${buildScaleBlocks(
        result.type === "typhoon" ? (signal >= 3 ? 4 : 3) : result.type === "lpa" ? 2 : 1,
        4,
        result.type === "typhoon" ? "var(--red)" : result.type === "lpa" ? "var(--yellow)" : "var(--green)"
      )}
      <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:700;color:${result.type === "typhoon" ? "var(--red)" : result.type === "lpa" ? "var(--yellow)" : "var(--green)"};margin-top:8px">
        ${result.type === "typhoon" ? "DANGER" : result.type === "lpa" ? "MODERATE" : "LOW"}
      </div>
    </div>
  `;

  document.getElementById("lastScan").textContent =
    "LAST SCAN: " + new Date().toLocaleTimeString("en-PH", { hour12: true }).toUpperCase();
}
