// One-off build script: converts data/IN_raw.csv (GeoNames India postal codes)
// into data/pincodes.json, a flat { "<pincode>": [lat, lng] } lookup map.
const fs = require("fs");
const path = require("path");

const raw = fs.readFileSync(path.join(__dirname, "../data/IN_raw.csv"), "utf8");
const lines = raw.split("\n").slice(1).filter(Boolean);

const map = {};
for (const line of lines) {
  const cols = line.split(",");
  const key = cols[0]; // "IN/110001"
  const lat = parseFloat(cols[3]);
  const lng = parseFloat(cols[4]);
  if (!key || Number.isNaN(lat) || Number.isNaN(lng)) continue;
  const pincode = key.split("/")[1];
  map[pincode] = [Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000];
}

// Manually geocoded pincodes missing from the GeoNames dump (via OpenStreetMap
// Nominatim, looked up once offline) — merged last so they always take effect.
const overrides = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/overrides.json"), "utf8")
);
Object.assign(map, overrides);

fs.writeFileSync(
  path.join(__dirname, "../data/pincodes.json"),
  JSON.stringify(map)
);
console.log(`Wrote ${Object.keys(map).length} pincodes to data/pincodes.json`);
