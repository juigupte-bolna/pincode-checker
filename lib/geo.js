const fs = require("fs");
const path = require("path");

const PINCODES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/pincodes.json"), "utf8")
);

// In-memory cache for pincodes resolved via the live fallback below. Lives
// only as long as the serverless instance stays warm, but avoids repeat
// network lookups within that window.
const liveCache = new Map();

// Free fallback for pincodes missing from the bundled dataset: OpenStreetMap's
// Nominatim geocoder. No API key, but keep calls infrequent (it's a shared
// public service) — this only fires on a local cache miss.
async function geocodeViaNominatim(pincode) {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`;
  const r = await fetch(url, {
    headers: { "User-Agent": "pincode-checker/1.0" },
  });
  if (!r.ok) return null;
  const results = await r.json();
  if (!results.length) return null;
  return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
}

// Returns [lat, lng] for a pincode, or null if it can't be resolved.
async function coordsForPincode(pincode) {
  if (PINCODES[pincode]) return PINCODES[pincode];
  if (liveCache.has(pincode)) return liveCache.get(pincode);

  let coords = null;
  try {
    coords = await geocodeViaNominatim(pincode);
  } catch {
    coords = null;
  }
  liveCache.set(pincode, coords);
  return coords;
}

// Haversine distance in km between two lat/lng points.
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { coordsForPincode, distanceKm };
