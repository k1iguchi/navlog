// Lighthouse Map UI
// Handles map display and lighthouse markers

(() => {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;
  if (typeof L === "undefined") return;
  if (typeof lighthouses === "undefined") return;

  const { parseLightCode, generateSequence, extractColor, colorMap } = window.LighthouseSim;
  const { buildSectorPolygon, parseRangeMeters } = window.GeoUtils;

  // Constants
  const DEFAULT_CENTER = [34.7, 138.5];
  const DEFAULT_ZOOM = 8;

  const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Tile layers
  const tileSources = {
    "標準": "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    "淡色": "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    "写真": "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
  };
  const baseLayers = {};
  Object.entries(tileSources).forEach(([label, url]) => {
    baseLayers[label] = L.tileLayer(url, {
      attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html'>地理院地図</a>",
      maxZoom: 18
    });
  });
  baseLayers["淡色"].addTo(map);
  L.control.layers(baseLayers, null, { position: "topleft", collapsed: false }).addTo(map);

  // Coordinate panel
  const coordinateText = document.getElementById("coordinateText");
  const copyButton = document.getElementById("copyCoordsButton");
  let lastCoordinates = null;

  function updateCoordinates(lat, lng) {
    const latFixed = lat.toFixed(6);
    const lngFixed = lng.toFixed(6);
    if (coordinateText) coordinateText.textContent = `緯度: ${latFixed} / 経度: ${lngFixed}`;
    lastCoordinates = { lat: latFixed, lng: lngFixed };
    if (copyButton) copyButton.disabled = false;
  }

  map.on("click", (event) => {
    updateCoordinates(event.latlng.lat, event.latlng.lng);
  });

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      if (!lastCoordinates) return;
      const formatted = `lat: ${lastCoordinates.lat}, lon: ${lastCoordinates.lng}`;
      try {
        await navigator.clipboard.writeText(formatted);
        copyButton.textContent = "コピーしました";
        setTimeout(() => { copyButton.textContent = "座標コピー"; copyButton.disabled = false; }, 1500);
      } catch (e) {
        console.error(e);
      }
    });
  }

  // Popup simulations and range overlays
  const popupSimulations = new Map();
  const rangeOverlay = window.RangeOverlay.create(map, colorMap, buildSectorPolygon);

  // ========== Popup Simulation Functions ==========
  function resetPopupLight(lightEl) {
    if (!lightEl) return;
    lightEl.classList.remove("on");
    lightEl.style.backgroundColor = "black";
    lightEl.style.color = "";
  }

  function stopPopupSimulation(lightId) {
    const sim = popupSimulations.get(lightId);
    if (sim) {
      clearTimeout(sim.timer);
      resetPopupLight(sim.lightEl);
      popupSimulations.delete(lightId);
    }
  }

  function startPopupSimulation(lightId, code) {
    stopPopupSimulation(lightId);
    const lightEl = document.getElementById(lightId);
    if (!lightEl) return;

    const parsed = parseLightCode(code);
    if (!parsed) {
      resetPopupLight(lightEl);
      return;
    }
    const sequence = generateSequence(parsed);
    if (!sequence.length) {
      resetPopupLight(lightEl);
      return;
    }

    let index = 0;
    const sim = { lightEl, timer: null };
    
    const step = () => {
      const state = sequence[index];
      const cssColor = state.on ? (colorMap[state.color] || "white") : "black";
      
      if (state.on) {
        lightEl.classList.add("on");
        lightEl.style.backgroundColor = cssColor;
        lightEl.style.color = cssColor;
      } else {
        lightEl.classList.remove("on");
        lightEl.style.backgroundColor = "black";
        lightEl.style.color = "";
      }

      sim.timer = setTimeout(() => {
        index = (index + 1) % sequence.length;
        step();
      }, state.duration * 1000);
    };

    resetPopupLight(lightEl);
    step();
    popupSimulations.set(lightId, sim);
  }

  // ========== Plot Lighthouses ==========
  function plotLighthouses() {
    const points = lighthouses.filter(lh => typeof lh.lat === "number" && typeof lh.lon === "number");
    if (points.length === 0) {
      const msg = document.createElement("p");
      msg.textContent = "灯台データが見つかりません。";
      document.body.appendChild(msg);
      return;
    }

    points.forEach((lh, idx) => {
      const colorKey = extractColor(lh.code);
      const color = colorMap[colorKey] || "gray";
      const lightId = `popup-light-${idx}`;
      const rangeMeters = parseRangeMeters(lh.range);

      const marker = L.circleMarker([lh.lat, lh.lon], {
        radius: 6, weight: 2, color: "gray", fillColor: color, fillOpacity: 0.8
      }).addTo(map);

      marker.bindPopup(`
        <div class="popup-content">
          <div class="popup-title"><strong>${lh.name}</strong></div>
          <div>灯質: ${lh.code}</div>
          <div>光達距離: ${lh.range} 海里</div>
          <div class="popup-light-wrapper">
            <div id="${lightId}" class="popup-light"></div>
          </div>
        </div>
      `, { minWidth: 180 });

      marker.on("click", () => {
        updateCoordinates(lh.lat, lh.lon);
      });

      marker.on("popupopen", () => {
        startPopupSimulation(lightId, lh.code);
        rangeOverlay.show(lightId, [lh.lat, lh.lon], rangeMeters, lh.arcs, color);
      });
      marker.on("popupclose", () => {
        stopPopupSimulation(lightId);
        rangeOverlay.hide(lightId);
      });
    });
  }

  plotLighthouses();
})();
