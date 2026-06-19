/* ===================================================================
   WeatherSphere AI — script.js
   Vanilla JS · Fetch + Async/Await · OpenWeatherMap API
=================================================================== */

"use strict";

/* ----------------------------------------------------------------
   CONFIG
   Get a free key at https://home.openweathermap.org/users/sign_up
   then paste it below. The app will not work without it.
----------------------------------------------------------------- */
const CONFIG = {
  API_KEY: "edb0010f075d5f594b56af21438c0b7e", // <-- paste your OpenWeatherMap key here
  WEATHER_URL: "https://api.openweathermap.org/data/2.5/weather",
  AQI_URL: "https://api.openweathermap.org/data/2.5/air_pollution",
  RECENT_KEY: "weathersphere_recent",
  THEME_KEY: "weathersphere_theme",
  UNIT_KEY: "weathersphere_unit",
  LAST_KEY: "weathersphere_last",
  MAX_RECENT: 6,
};

/* ----------------------------------------------------------------
   STATE
----------------------------------------------------------------- */
const state = {
  unit: "metric", // 'metric' (°C) | 'imperial' (°F)
  theme: "dark",
  rawData: null, // last successful weather payload (always fetched in metric)
  timezoneOffset: null, // seconds, for the searched city
  recent: [], // [{ name, country, lat, lon }]
};

/* ----------------------------------------------------------------
   DOM CACHE
----------------------------------------------------------------- */
const dom = {};

function cacheDom() {
  const ids = [
    "liveClock", "unitToggle", "themeToggle",
    "searchForm", "cityInput", "locationBtn",
    "errorBanner", "errorText", "errorClose",
    "recentWrap", "recentSearches",
    "emptyState", "apiKeyBanner",
    "heroDisplay", "particles", "weatherEmoji",
    "cityName", "countryTag", "localTimeDisplay",
    "temperature", "tempUnitDisplay", "conditionText",
    "feelsLikeMini", "sunriseMini", "sunsetMini",
    "analyticsSection", "metricTemp", "metricFeels",
    "humidityRing", "metricHumidity",
    "windRing", "metricWind",
    "metricVisibility", "metricPressure",
    "aqiDot", "metricAQI", "aqiLabel",
    "insightsSection", "insightsGrid",
    "loadingOverlay", "loaderText", "footerYear",
  ];
  ids.forEach((id) => (dom[id] = document.getElementById(id)));
}

/* ----------------------------------------------------------------
   INIT
----------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheDom();
  dom.footerYear.textContent = new Date().getFullYear();

  initTheme();
  initUnit();
  initRecent();
  checkApiKey();

  startClockTick();
  attachEvents();

  // Quietly restore the last viewed city, if any.
  const last = readJSON(CONFIG.LAST_KEY);
  if (last && last.lat != null && last.lon != null && hasApiKey()) {
    fetchByCoords(last.lat, last.lon, true);
  }
}

function hasApiKey() {
  return Boolean(CONFIG.API_KEY) && CONFIG.API_KEY !== "YOUR_OPENWEATHERMAP_API_KEY";
}

function checkApiKey() {
  dom.apiKeyBanner.hidden = hasApiKey();
}

/* ----------------------------------------------------------------
   EVENTS
----------------------------------------------------------------- */
function attachEvents() {
  dom.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSearch(dom.cityInput.value);
  });

  dom.locationBtn.addEventListener("click", handleUseLocation);
  dom.themeToggle.addEventListener("click", toggleTheme);
  dom.unitToggle.addEventListener("click", toggleUnit);
  dom.errorClose.addEventListener("click", clearError);

  dom.recentSearches.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const lat = parseFloat(chip.dataset.lat);
    const lon = parseFloat(chip.dataset.lon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) fetchByCoords(lat, lon);
  });
}

/* ----------------------------------------------------------------
   THEME (dark / light, persisted)
----------------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY);
  state.theme = saved === "light" ? "light" : "dark";
  document.body.setAttribute("data-theme", state.theme);
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", state.theme);
  localStorage.setItem(CONFIG.THEME_KEY, state.theme);
}

/* ----------------------------------------------------------------
   UNIT (°C / °F, persisted) — pure client-side conversion, no refetch
----------------------------------------------------------------- */
function initUnit() {
  const saved = localStorage.getItem(CONFIG.UNIT_KEY);
  state.unit = saved === "imperial" ? "imperial" : "metric";
  dom.unitToggle.setAttribute("data-unit", state.unit);
}

function toggleUnit() {
  state.unit = state.unit === "metric" ? "imperial" : "metric";
  dom.unitToggle.setAttribute("data-unit", state.unit);
  localStorage.setItem(CONFIG.UNIT_KEY, state.unit);

  if (state.rawData) {
    renderWeather(state.rawData);
    renderMetrics(state.rawData);
  }
}

/* ----------------------------------------------------------------
   CLOCK — top nav (browser local) + searched city local time
----------------------------------------------------------------- */
function startClockTick() {
  tick();
  setInterval(tick, 1000);
}

function tick() {
  dom.liveClock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (state.timezoneOffset != null) {
    dom.localTimeDisplay.textContent = `Local time ${formatCityClock(state.timezoneOffset)}`;
  }
}

function formatCityClock(offsetSeconds) {
  const cityMs = Date.now() + offsetSeconds * 1000;
  const d = new Date(cityMs);
  return formatUTCFields(d.getUTCHours(), d.getUTCMinutes());
}

function formatSunTime(unixSeconds, offsetSeconds) {
  const cityMs = unixSeconds * 1000 + offsetSeconds * 1000;
  const d = new Date(cityMs);
  return formatUTCFields(d.getUTCHours(), d.getUTCMinutes());
}

function formatUTCFields(hours, minutes) {
  const period = hours >= 12 ? "PM" : "AM";
  let h = hours % 12;
  if (h === 0) h = 12;
  const m = minutes.toString().padStart(2, "0");
  return `${h}:${m} ${period}`;
}

/* ----------------------------------------------------------------
   VALIDATION
----------------------------------------------------------------- */
function validateCity(raw) {
  const value = raw.trim();
  if (!value) return { ok: false, message: "Please enter a city name to search." };
  if (value.length < 2) return { ok: false, message: "City name is too short." };
  const pattern = /^[a-zA-Z\u00C0-\u017F\s'.\-,]+$/;
  if (!pattern.test(value)) {
    return { ok: false, message: "City names can only contain letters, spaces, and basic punctuation." };
  }
  return { ok: true, value };
}

/* ----------------------------------------------------------------
   NETWORKING
----------------------------------------------------------------- */
async function fetchJSON(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Network error — check your internet connection and try again.");
  }

  if (!res.ok) {
    let message = "Something went wrong while fetching weather data.";
    if (res.status === 404) message = "We couldn't find that city. Check the spelling and try again.";
    else if (res.status === 401) message = "Invalid API key. Add a valid OpenWeatherMap key in script.js.";
    else if (res.status === 429) message = "Too many requests right now — please wait a moment and retry.";
    throw new Error(message);
  }
  return res.json();
}

async function handleSearch(rawCity) {
  if (!hasApiKey()) {
    dom.apiKeyBanner.hidden = false;
    showError("Add your OpenWeatherMap API key in script.js to enable live data.");
    return;
  }

  const check = validateCity(rawCity);
  if (!check.ok) {
    showError(check.message);
    return;
  }

  showLoading(`Fetching atmospheric data for ${check.value}…`);
  try {
    const url = `${CONFIG.WEATHER_URL}?q=${encodeURIComponent(check.value)}&units=metric&appid=${CONFIG.API_KEY}`;
    const data = await fetchJSON(url);
    await processWeatherData(data);
    dom.cityInput.value = "";
  } catch (err) {
    showError(err.message);
  } finally {
    hideLoading();
  }
}

async function fetchByCoords(lat, lon, silent = false) {
  if (!hasApiKey()) return;

  if (!silent) showLoading("Fetching atmospheric data…");
  try {
    const url = `${CONFIG.WEATHER_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.API_KEY}`;
    const data = await fetchJSON(url);
    await processWeatherData(data);
  } catch (err) {
    if (!silent) showError(err.message);
  } finally {
    if (!silent) hideLoading();
  }
}

function handleUseLocation() {
  if (!hasApiKey()) {
    dom.apiKeyBanner.hidden = false;
    showError("Add your OpenWeatherMap API key in script.js to enable live data.");
    return;
  }
  if (!navigator.geolocation) {
    showError("Geolocation isn't supported in this browser. Try searching for a city instead.");
    return;
  }

  showLoading("Locating you…");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const url = `${CONFIG.WEATHER_URL}?lat=${latitude}&lon=${longitude}&units=metric&appid=${CONFIG.API_KEY}`;
        const data = await fetchJSON(url);
        await processWeatherData(data);
      } catch (err) {
        showError(err.message);
      } finally {
        hideLoading();
      }
    },
    (err) => {
      hideLoading();
      if (err.code === 1) showError("Location access was denied. Search for a city instead.");
      else showError("Couldn't detect your location. Try searching manually.");
    },
    { timeout: 10000 }
  );
}

async function processWeatherData(data) {
  state.rawData = data;
  state.timezoneOffset = data.timezone;

  clearError();
  dom.emptyState.hidden = true;
  dom.heroDisplay.hidden = false;
  dom.analyticsSection.hidden = false;
  dom.insightsSection.hidden = false;

  renderWeather(data);
  renderMetrics(data);
  renderInsights(data);

  addRecent({ name: data.name, country: data.sys.country, lat: data.coord.lat, lon: data.coord.lon });
  writeJSON(CONFIG.LAST_KEY, { lat: data.coord.lat, lon: data.coord.lon });

  try {
    const aqiUrl = `${CONFIG.AQI_URL}?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${CONFIG.API_KEY}`;
    const aqi = await fetchJSON(aqiUrl);
    renderAirQuality(aqi);
  } catch {
    renderAirQuality(null);
  }
}

/* ----------------------------------------------------------------
   CONVERSIONS
----------------------------------------------------------------- */
function cToF(c) { return c * 9 / 5 + 32; }
function msToKmh(ms) { return ms * 3.6; }
function msToMph(ms) { return ms * 2.23694; }
function metersToKm(m) { return m / 1000; }
function metersToMiles(m) { return m / 1609.34; }

function displayTemp(c) {
  return state.unit === "metric" ? Math.round(c) : Math.round(cToF(c));
}
function unitLetter() {
  return state.unit === "metric" ? "C" : "F";
}

/* ----------------------------------------------------------------
   WEATHER VISUALS — theme, emoji, particles
----------------------------------------------------------------- */
const EMOJI_MAP = {
  "01d": "☀️", "01n": "🌙",
  "02d": "⛅", "02n": "☁️",
  "03d": "☁️", "03n": "☁️",
  "04d": "☁️", "04n": "☁️",
  "09d": "🌧️", "09n": "🌧️",
  "10d": "🌦️", "10n": "🌧️",
  "11d": "⛈️", "11n": "⛈️",
  "13d": "❄️", "13n": "❄️",
  "50d": "🌫️", "50n": "🌫️",
};

function getWeatherTheme(main, icon) {
  const isDay = icon.endsWith("d");
  if (!isDay) return "night";
  switch (main) {
    case "Clear": return "sunny";
    case "Rain":
    case "Drizzle":
    case "Thunderstorm": return "rainy";
    case "Snow": return "snow";
    default: return "cloudy"; // Clouds, Mist, Fog, Haze, Dust, Smoke, etc.
  }
}

function renderParticles(main, theme) {
  dom.particles.innerHTML = "";
  let type = null;

  if (["Rain", "Drizzle", "Thunderstorm"].includes(main)) type = "drop";
  else if (main === "Snow") type = "flake";
  else if (theme === "sunny") type = "ray";
  else if (theme === "cloudy") type = "cloud-puff";

  if (!type) return;

  const count = type === "ray" ? 8 : type === "cloud-puff" ? 4 : 22;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = type;

    if (type === "ray") {
      const rot = (360 / count) * i;
      el.style.setProperty("--rot", `${rot}deg`);
      el.style.animationDelay = `${Math.random() * 2}s`;
    } else if (type === "cloud-puff") {
      el.style.top = `${20 + Math.random() * 50}%`;
      el.style.left = `-30px`;
      el.style.animationDuration = `${6 + Math.random() * 4}s`;
      el.style.animationDelay = `${Math.random() * 5}s`;
    } else {
      el.style.left = `${Math.random() * 100}%`;
      el.style.animationDuration = `${type === "drop" ? 0.6 + Math.random() * 0.5 : 3 + Math.random() * 3}s`;
      el.style.animationDelay = `${Math.random() * 2.5}s`;
    }
    dom.particles.appendChild(el);
  }
}

/* ----------------------------------------------------------------
   RENDER — hero
----------------------------------------------------------------- */
function renderWeather(data) {
  const icon = data.weather[0].icon;
  const main = data.weather[0].main;
  const theme = getWeatherTheme(main, icon);

  document.body.setAttribute("data-weather", theme);
  dom.weatherEmoji.textContent = EMOJI_MAP[icon] || "🌤️";
  renderParticles(main, theme);

  dom.cityName.textContent = data.name;
  dom.countryTag.textContent = data.sys.country || "";
  dom.localTimeDisplay.textContent = `Local time ${formatCityClock(data.timezone)}`;

  dom.temperature.textContent = displayTemp(data.main.temp);
  dom.tempUnitDisplay.textContent = `°${unitLetter()}`;
  dom.conditionText.textContent = data.weather[0].description;

  dom.feelsLikeMini.textContent = `${displayTemp(data.main.feels_like)}°`;
  dom.sunriseMini.textContent = formatSunTime(data.sys.sunrise, data.timezone);
  dom.sunsetMini.textContent = formatSunTime(data.sys.sunset, data.timezone);
}

/* ----------------------------------------------------------------
   RENDER — analytics metrics
----------------------------------------------------------------- */
function renderMetrics(data) {
  const u = unitLetter();

  dom.metricTemp.textContent = `${displayTemp(data.main.temp)}°${u}`;
  dom.metricFeels.textContent = `${displayTemp(data.main.feels_like)}°${u}`;

  dom.metricHumidity.textContent = `${data.main.humidity}%`;
  setRing(dom.humidityRing, data.main.humidity);

  const windKmh = msToKmh(data.wind.speed);
  const windDisplay = state.unit === "metric" ? `${Math.round(windKmh)}` : `${Math.round(msToMph(data.wind.speed))}`;
  dom.metricWind.textContent = `${windDisplay} ${state.unit === "metric" ? "km/h" : "mph"}`;
  setRing(dom.windRing, Math.min(100, (windKmh / 60) * 100));

  dom.metricVisibility.textContent =
    state.unit === "metric"
      ? `${metersToKm(data.visibility).toFixed(1)} km`
      : `${metersToMiles(data.visibility).toFixed(1)} mi`;

  dom.metricPressure.textContent = `${data.main.pressure} hPa`;
}

function setRing(circleEl, percent) {
  const circumference = 2 * Math.PI * 26; // r = 26
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  circleEl.style.strokeDasharray = `${circumference} ${circumference}`;
  circleEl.style.strokeDashoffset = offset;
}

/* ----------------------------------------------------------------
   RENDER — air quality
----------------------------------------------------------------- */
const AQI_LEVELS = {
  1: { label: "Good", color: "#34d399" },
  2: { label: "Fair", color: "#a3e635" },
  3: { label: "Moderate", color: "#fbbf24" },
  4: { label: "Poor", color: "#fb923c" },
  5: { label: "Very Poor", color: "#fb7185" },
};

function renderAirQuality(aqiData) {
  if (!aqiData || !aqiData.list || !aqiData.list[0]) {
    dom.metricAQI.textContent = "N/A";
    dom.aqiLabel.textContent = "Data unavailable";
    dom.aqiDot.style.background = "var(--text-tertiary)";
    dom.aqiDot.style.color = "var(--text-tertiary)";
    return;
  }
  const idx = aqiData.list[0].main.aqi;
  const level = AQI_LEVELS[idx] || AQI_LEVELS[3];
  dom.metricAQI.textContent = level.label;
  dom.aqiLabel.textContent = `AQI index ${idx} of 5`;
  dom.aqiDot.style.background = level.color;
  dom.aqiDot.style.color = level.color;
}

/* ----------------------------------------------------------------
   RENDER — smart insights
----------------------------------------------------------------- */
function renderInsights(data) {
  const tempC = data.main.temp;
  const main = data.weather[0].main;
  const humidity = data.main.humidity;
  const windKmh = msToKmh(data.wind.speed);
  const visibility = data.visibility;

  const insights = [];

  if (["Rain", "Drizzle", "Thunderstorm"].includes(main)) {
    insights.push({
      icon: "☔",
      title: "Bring an umbrella",
      text: "Rain is falling right now — keep one handy if you're heading out.",
    });
  } else if (humidity > 85) {
    insights.push({
      icon: "☔",
      title: "Rain may be close",
      text: "Humidity is high — a light rain jacket could save the day.",
    });
  }

  if (tempC >= 36) {
    insights.push({
      icon: "🥵",
      title: "Heat warning",
      text: "It's very hot outside. Stay hydrated and avoid direct sun between 12–3 PM.",
    });
  } else if (tempC <= 5) {
    insights.push({
      icon: "🥶",
      title: "Cold alert",
      text: "Temperatures are low — layer up before heading outdoors.",
    });
  }

  if (["Clear", "Clouds"].includes(main) && tempC >= 16 && tempC <= 29 && windKmh < 30) {
    insights.push({
      icon: "🚶",
      title: "Great for outdoors",
      text: "Conditions look ideal for a walk, run, or outdoor plans today.",
    });
  } else if (windKmh >= 30) {
    insights.push({
      icon: "🍃",
      title: "Windy conditions",
      text: "Winds are stronger than usual — secure any loose items outside.",
    });
  }

  let clothing;
  if (tempC < 10) clothing = "A warm jacket or coat is recommended today.";
  else if (tempC < 18) clothing = "A light jacket or sweater should feel comfortable.";
  else if (tempC < 28) clothing = "Light, breathable clothing works well today.";
  else clothing = "Stick to airy fabrics and light colors to stay cool.";
  insights.push({ icon: "👕", title: "What to wear", text: clothing });

  if (insights.length < 4) {
    if (visibility < 4000) {
      insights.push({
        icon: "🌫️",
        title: "Reduced visibility",
        text: "Visibility is low today — drive carefully and use fog lights if needed.",
      });
    } else {
      insights.push({
        icon: "🕶️",
        title: "Comfortable conditions",
        text: "No major weather concerns right now — a good day to be outside.",
      });
    }
  }

  dom.insightsGrid.innerHTML = insights
    .map(
      (item, i) => `
      <div class="insight-card" style="animation-delay:${i * 0.08}s">
        <div class="insight-icon">${item.icon}</div>
        <div class="insight-body">
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(item.text)}</p>
        </div>
      </div>`
    )
    .join("");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ----------------------------------------------------------------
   RECENT SEARCHES (localStorage, capped at 6)
----------------------------------------------------------------- */
function initRecent() {
  state.recent = readJSON(CONFIG.RECENT_KEY) || [];
  renderRecentChips();
}

function addRecent(entry) {
  state.recent = state.recent.filter(
    (item) => !(item.name.toLowerCase() === entry.name.toLowerCase() && item.country === entry.country)
  );
  state.recent.unshift(entry);
  state.recent = state.recent.slice(0, CONFIG.MAX_RECENT);
  writeJSON(CONFIG.RECENT_KEY, state.recent);
  renderRecentChips();
}

function renderRecentChips() {
  if (!state.recent.length) {
    dom.recentWrap.hidden = true;
    return;
  }
  dom.recentWrap.hidden = false;
  dom.recentSearches.innerHTML = state.recent
    .map(
      (item, i) => `
      <button type="button" class="chip" style="animation-delay:${i * 0.05}s"
        data-lat="${item.lat}" data-lon="${item.lon}">
        ${escapeHTML(item.name)}${item.country ? `, ${escapeHTML(item.country)}` : ""}
      </button>`
    )
    .join("");
}

/* ----------------------------------------------------------------
   LOADING / ERROR UI
----------------------------------------------------------------- */
function showLoading(text) {
  dom.loaderText.textContent = text || "Fetching atmospheric data…";
  dom.loadingOverlay.hidden = false;
  dom.searchBtnDisable(true);
}

function hideLoading() {
  dom.loadingOverlay.hidden = true;
  dom.searchBtnDisable(false);
}

// small helper attached to dom for convenience
dom.searchBtnDisable = function (disabled) {
  const btn = document.getElementById("searchBtn");
  if (btn) btn.disabled = disabled;
};

function showError(message) {
  dom.errorText.textContent = message;
  dom.errorBanner.hidden = false;
}

function clearError() {
  dom.errorBanner.hidden = true;
}

/* ----------------------------------------------------------------
   STORAGE HELPERS
----------------------------------------------------------------- */
function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage unavailable — fail silently */
  }
}