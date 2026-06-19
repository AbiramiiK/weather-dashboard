# 🌤️ WeatherSphere AI

A premium, glassmorphic weather dashboard built with **pure HTML, CSS, and JavaScript** — no frameworks, no build tools. Search any city for real-time conditions, smart insights, and air quality, wrapped in a SaaS-grade UI inspired by Apple, Linear, Stripe, and Vercel.

![Tech](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![Tech](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![Tech](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Tech](https://img.shields.io/badge/OpenWeatherMap-API-orange)

---

## ✨ Features

- **Live weather search** — current conditions for any city worldwide, plus a "use my location" button (Geolocation API)
- **Dynamic weather-reactive theming** — background gradient and accent colors shift automatically: Sunny (orange/yellow), Rainy (blue), Cloudy (grey), Snow (white/blue), Night (dark purple)
- **Dark / Light mode** with persisted preference (`localStorage`)
- **°C / °F unit toggle** — instant client-side conversion, no extra API calls
- **Animated hero** — floating weather emoji, rotating gradient halo, and condition-aware particles (rain drops, snowflakes, sun rays, drifting clouds)
- **Analytics grid** — Temperature, Feels Like, Humidity (animated progress ring), Wind Speed (animated progress ring), Visibility, Pressure
- **Live Air Quality Index** — pulled from OpenWeatherMap's Air Pollution API, color-coded by severity
- **Smart Insights engine** — rule-based recommendations (umbrella reminder, heat/cold warnings, outdoor activity suggestion, clothing advice) generated from the live data
- **Recent searches** — last 6 cities saved to `localStorage` as clickable chips, re-fetched by coordinates for accuracy
- **Sunrise / sunset / local time** for the searched city, computed from its UTC offset
- **Premium loading state** with a dual-ring animated spinner
- **Robust error handling** — empty input, invalid city, invalid API key, rate limits, and network failures all show friendly inline messages
- **Fully responsive** — desktop, tablet, and mobile layouts
- **Accessible** — semantic markup, `aria-live`/`aria-label` attributes, visible focus states, and `prefers-reduced-motion` support

---

## 🗂️ Project Structure

```
weathersphere-ai/
├── index.html      # Markup & layout
├── style.css        # Design system, glassmorphism, animations, responsiveness
├── script.js         # API calls, state, rendering, localStorage logic
└── README.md
```

No build step, no `node_modules`, no bundler — just three files you can open directly in a browser.

---

## 🚀 Getting Started

### 1. Get a free OpenWeatherMap API key
Sign up at **[home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)** and generate a free API key from your account dashboard.

> ⏳ New keys can take a few minutes up to ~2 hours to activate. If you get a 401 error immediately after signing up, just wait a bit and try again.

### 2. Add your key
Open `script.js` and replace the placeholder near the top:

```js
const CONFIG = {
  API_KEY: "YOUR_OPENWEATHERMAP_API_KEY", // 👈 paste your key here
  ...
};
```

### 3. Run it
No build tools needed — just open `index.html` in a browser, or serve it locally:

```bash
# Option A: just double-click index.html

# Option B: serve with Python
python3 -m http.server 5500

# Option C: serve with the VS Code "Live Server" extension
```

Then visit `http://localhost:5500` (or wherever it's served).

> ⚠️ If you open `index.html` directly via `file://`, the Geolocation ("use my location") button may be blocked by the browser — serving over `http://localhost` avoids this.

---

## 🧠 How It Works

- **`fetchJSON()`** wraps `fetch` with `async/await` and translates HTTP status codes (404, 401, 429) into human-readable error messages.
- Weather data is always requested in **metric units**; the °C/°F toggle converts values client-side (`cToF`, `msToKmh`, `msToMph`, etc.) so switching units is instant and doesn't re-hit the API.
- **`getWeatherTheme()`** maps the OpenWeatherMap condition + icon code (day/night) to one of five visual themes, which is applied via a `data-weather` attribute on `<body>` and read by CSS custom properties.
- **`renderInsights()`** is a small rule engine: it inspects temperature, condition, humidity, wind, and visibility to generate 4 contextual recommendation cards.
- Recent searches and the last-viewed city are stored as **coordinates**, not just names, so re-opening the app or clicking a chip always fetches the exact same location (avoiding "Springfield, which one?" ambiguity).
- Air Quality is fetched as a **secondary request** after the main weather call succeeds, using the coordinates returned by the weather API — if it fails, the card gracefully falls back to "Data unavailable" instead of breaking the page.

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Markup | Semantic HTML5 |
| Styling | CSS3 — custom properties, Grid, Flexbox, `backdrop-filter` glassmorphism, keyframe animations |
| Logic | Vanilla JavaScript (ES2017+) — `async/await`, `fetch`, modular functions |
| Data | [OpenWeatherMap](https://openweathermap.org/api) — Current Weather Data API + Air Pollution API |
| Fonts | [Poppins](https://fonts.google.com/specimen/Poppins) via Google Fonts |
| Persistence | `localStorage` (theme, unit, recent searches, last city) |

---

## 📌 Notes & Limitations

- The free OpenWeatherMap tier has a request-rate limit (60 calls/minute) — more than enough for personal/portfolio use.
- City name search uses OpenWeatherMap's built-in geocoding; very small or ambiguous place names may occasionally resolve to an unexpected match. Using "use my location" or recent-search chips avoids this by relying on coordinates.
- This is a front-end-only project — the API key is visible in client-side code, which is fine for a portfolio/demo but not recommended for production apps with real users (in that case, proxy requests through a backend).

---

## 📄 License

Free to use for learning, portfolio, and internship submission purposes.

---

Built with ☕ and the OpenWeatherMap API — **WeatherSphere AI**