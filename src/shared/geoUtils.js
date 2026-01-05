// Geographic Utility Functions
// Reusable functions for geographic calculations

window.GeoUtils = window.GeoUtils || {};

(function(exports) {
  const EARTH_RADIUS = 6371000; // meters
  const NM_TO_METERS = 1852;

  function toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  function toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  /**
   * Calculate destination point given start point, bearing, and distance
   * @param {number} lat - Starting latitude
   * @param {number} lon - Starting longitude
   * @param {number} bearingDeg - Bearing in degrees
   * @param {number} distanceMeters - Distance in meters
   * @returns {[number, number]} - [latitude, longitude]
   */
  function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
    const angularDistance = distanceMeters / EARTH_RADIUS;
    const bearingRad = toRadians(bearingDeg);
    const latRad = toRadians(lat);
    const lonRad = toRadians(lon);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinAngular = Math.sin(angularDistance);
    const cosAngular = Math.cos(angularDistance);
    const sinLat2 = sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearingRad);
    const lat2 = Math.asin(Math.min(Math.max(sinLat2, -1), 1));
    const y = Math.sin(bearingRad) * sinAngular * cosLat;
    const x = cosAngular - sinLat * sinLat2;
    const lon2 = lonRad + Math.atan2(y, x);
    return [toDegrees(lat2), ((toDegrees(lon2) + 540) % 360) - 180];
  }

  /**
   * Build a sector polygon (pie slice shape)
   * @param {[number, number]} position - [lat, lon]
   * @param {number} radiusMeters - Radius in meters
   * @param {number} startDeg - Start bearing in degrees
   * @param {number} endDeg - End bearing in degrees
   * @returns {Array|null} - Array of [lat, lon] points or null
   */
  function buildSectorPolygon(position, radiusMeters, startDeg, endDeg) {
    if (!Number.isFinite(radiusMeters)) return null;
    const [lat, lon] = position;
    let start = ((startDeg % 360) + 360) % 360;
    let end = ((endDeg % 360) + 360) % 360;
    let sweep = end - start;
    if (sweep <= 0) sweep += 360;
    if (sweep >= 359) return null;
    const steps = Math.max(2, Math.ceil(sweep / 5));
    const stepSize = sweep / steps;
    const points = [[lat, lon]];
    for (let i = 0; i <= steps; i++) {
      const bearing = (start + stepSize * i) % 360;
      const [dLat, dLon] = destinationPoint(lat, lon, bearing, radiusMeters);
      points.push([dLat, dLon]);
    }
    points.push([lat, lon]);
    return points;
  }

  /**
   * Parse nautical miles to meters
   * @param {number|string} rangeNm - Range in nautical miles
   * @returns {number|null} - Range in meters or null
   */
  function parseRangeMeters(rangeNm) {
    const numericRange = typeof rangeNm === "number" ? rangeNm : parseFloat(rangeNm);
    if (!Number.isFinite(numericRange) || numericRange <= 0) return null;
    return numericRange * NM_TO_METERS;
  }

  exports.EARTH_RADIUS = EARTH_RADIUS;
  exports.NM_TO_METERS = NM_TO_METERS;
  exports.toRadians = toRadians;
  exports.toDegrees = toDegrees;
  exports.destinationPoint = destinationPoint;
  exports.buildSectorPolygon = buildSectorPolygon;
  exports.parseRangeMeters = parseRangeMeters;

})(window.GeoUtils);
