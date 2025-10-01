/* Simple, reliable weather app
   Uses OpenWeather free APIs:
   - Current weather: /weather?q={city}
   - 5-day forecast: /forecast?lat={lat}&lon={lon}
*/

const API_KEY = "937f29232de1228186e1db2ebcb81f11"; // your key

// DOM
const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const cityNameEl = document.getElementById("city-name");
const tempEl = document.getElementById("temp");
const descEl = document.getElementById("desc");
const iconEl = document.getElementById("weather-icon");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const forecastCards = document.getElementById("forecast-cards");
const errorEl = document.getElementById("error");

// default load
window.addEventListener("load", () => {
  fetchAndRender("Lahore");
});

// search
searchBtn.addEventListener("click", () => {
  const q = cityInput.value.trim();
  if (q) fetchAndRender(q);
});
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const q = cityInput.value.trim();
    if (q) fetchAndRender(q);
  }
});

async function fetchAndRender(city) {
  clearError();
  try {
    // 1) current weather by city name
    const currentResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`);
    if (!currentResp.ok) throw new Error("City not found");
    const current = await currentResp.json();

    // update current UI (safely)
    const name = current.name + (current.sys && current.sys.country ? ", " + current.sys.country : "");
    cityNameEl.textContent = name;
    tempEl.textContent = current.main && current.main.temp !== undefined ? Math.round(current.main.temp) + "°C" : "--";
    descEl.textContent = (current.weather && current.weather[0] && current.weather[0].description) ? current.weather[0].description : "--";
    humidityEl.textContent = current.main && current.main.humidity !== undefined ? `Humidity: ${current.main.humidity}%` : "Humidity: --";
    windEl.textContent = current.wind && current.wind.speed !== undefined ? `Wind: ${current.wind.speed} m/s` : "Wind: -- m/s";

    const icon = (current.weather && current.weather[0] && current.weather[0].icon) ? current.weather[0].icon : null;
    if (icon) {
      iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
      iconEl.alt = current.weather[0].description || "weather icon";
    } else {
      iconEl.src = "";
      iconEl.alt = "";
    }

    // 2) forecast using coords (5-day, 3-hour intervals)
    if (current.coord && current.coord.lat !== undefined && current.coord.lon !== undefined) {
      await fetchAndRenderForecast(current.coord.lat, current.coord.lon);
    } else {
      // clear forecast
      forecastCards.innerHTML = "";
    }
  } catch (err) {
    showError(err.message || "Something went wrong");
    // clear UI a bit
    // (Keep city name if present)
  }
}

async function fetchAndRenderForecast(lat, lon) {
  try {
    const forecastResp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    if (!forecastResp.ok) throw new Error("Forecast not available");
    const data = await forecastResp.json();

    // Group items by date and pick the item closest to 12:00 for each day
    const byDay = {}; // { "YYYY-MM-DD": { item, diff } }
    data.list.forEach(item => {
      const dt = item.dt * 1000;
      const d = new Date(dt);
      const dateKey = d.toISOString().split("T")[0];
      const hour = d.getHours();
      const diff = Math.abs(hour - 12); // closeness to midday
      if (!byDay[dateKey] || diff < byDay[dateKey].diff) {
        byDay[dateKey] = { item, diff };
      }
    });

    // We want next 5 days excluding today if possible
    const todayKey = new Date().toISOString().split("T")[0];
    const dayKeys = Object.keys(byDay).sort();
    // pick days after or including today, then skip today to show future days (but include if only day available)
    const futureKeys = dayKeys.filter(k => k !== todayKey).slice(0, 5);
    // fallback: if futureKeys is empty (small data), use first 5 keys
    const keysToShow = futureKeys.length ? futureKeys : dayKeys.slice(0, 5);

    // render
    forecastCards.innerHTML = "";
    keysToShow.forEach(k => {
      const itm = byDay[k].item;
      const dt = new Date(itm.dt * 1000);
      const dayName = dt.toLocaleDateString(undefined, { weekday: "short" });
      const temp = itm.main && itm.main.temp ? Math.round(itm.main.temp) : "--";
      const icon = itm.weather && itm.weather[0] && itm.weather[0].icon ? itm.weather[0].icon : null;
      const iconUrl = icon ? `https://openweathermap.org/img/wn/${icon}.png` : "";

      const card = document.createElement("div");
      card.className = "forecast-card";
      card.innerHTML = `
        <p>${dayName}</p>
        <img src="${iconUrl}" alt="${itm.weather && itm.weather[0] ? itm.weather[0].description : ''}">
        <p>${temp}°C</p>
      `;
      forecastCards.appendChild(card);
    });

  } catch (err) {
    // show error, but keep current weather
    showError("Could not load forecast");
    forecastCards.innerHTML = "";
  }
}

/* helpers */
function showError(msg) {
  errorEl.textContent = msg;
}
function clearError() {
  errorEl.textContent = "";
}
const suggestionsEl = document.getElementById("suggestions");

// Autocomplete: fetch city suggestions
cityInput.addEventListener("input", async () => {
  const q = cityInput.value.trim();
  if (!q) {
    suggestionsEl.innerHTML = "";
    return;
  }
  try {
    const resp = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`
    );
    const cities = await resp.json();
    suggestionsEl.innerHTML = "";
    cities.forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.name}, ${c.country}`;
      li.addEventListener("click", () => {
        cityInput.value = c.name;
        suggestionsEl.innerHTML = "";
        fetchAndRender(c.name);
      });
      suggestionsEl.appendChild(li);
    });
  } catch (err) {
    console.error("Autocomplete error", err);
  }
});

// Fix current icon always with @2x
function setCurrentIcon(iconCode, desc) {
  if (iconCode) {
    iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    iconEl.alt = desc || "weather icon";
  } else {
    iconEl.src = "";
    iconEl.alt = "";
  }
}
