// Range Overlay Module
// Handles display of lighthouse range circles and sector arcs on the map

window.RangeOverlay = {
  /**
   * Creates a RangeOverlay manager for the given map
   * @param {L.Map} map - Leaflet map instance
   * @param {Object} colorMap - Color mapping (e.g., { W: "white", R: "red" })
   * @param {Function} buildSectorPolygon - Function to build sector polygon points
   * @returns {Object} Manager with show/hide methods
   */
  create(map, colorMap, buildSectorPolygon) {
    const overlays = new Map();

    function addCircle(position, radiusMeters, color) {
      const circle = L.circle(position, {
        radius: radiusMeters,
        color,
        weight: 1.5,
        opacity: 0,
        fillColor: color,
        fillOpacity: 0.3
      }).addTo(map);
      circle.bringToBack();
      return circle;
    }

    function addSector(position, radiusMeters, start, end, color) {
      const polyPoints = buildSectorPolygon(position, radiusMeters, start, end);
      if (!polyPoints) return null;
      const poly = L.polygon(polyPoints, {
        color,
        weight: 1.5,
        opacity: 0.6,
        fillColor: color,
        fillOpacity: 0.15
      }).addTo(map);
      poly.bringToBack();
      return poly;
    }

    return {
      /**
       * Show range overlays for a lighthouse
       * @param {string} id - Unique identifier
       * @param {Array} position - [lat, lng]
       * @param {number} radiusMeters - Range in meters
       * @param {Array} arcs - Array of { start, end, color } objects
       * @param {string} fallbackColor - Default color if no arcs
       */
      show(id, position, radiusMeters, arcs, fallbackColor) {
        this.hide(id);
        if (!radiusMeters) return;

        const layers = [];

        if (Array.isArray(arcs) && arcs.length > 0) {
          arcs.forEach(arc => {
            const start = Number(arc.start);
            const end = Number(arc.end);
            const cssColor = colorMap[arc.color] || fallbackColor || "gray";

            if (!Number.isFinite(start) || !Number.isFinite(end)) return;

            let sweep = ((end - start) % 360 + 360) % 360;
            if (sweep === 0) sweep = 360;

            if (sweep >= 359) {
              // Full circle
              if (layers.length === 0) {
                layers.push(addCircle(position, radiusMeters, cssColor));
              }
              return;
            }

            const sector = addSector(position, radiusMeters, start, end, cssColor);
            if (sector) layers.push(sector);
          });
        }

        // Fallback to full circle if no arcs rendered
        if (layers.length === 0) {
          layers.push(addCircle(position, radiusMeters, fallbackColor || "gray"));
        }

        overlays.set(id, layers);
      },

      /**
       * Hide range overlays for a lighthouse
       * @param {string} id - Unique identifier
       */
      hide(id) {
        const layers = overlays.get(id);
        if (layers) {
          layers.forEach(layer => map.removeLayer(layer));
          overlays.delete(id);
        }
      }
    };
  }
};
