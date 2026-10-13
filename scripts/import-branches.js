// One-off import: converts Branch_details.csv (235 real branches with
// surveyed lat/long) into branches.json, replacing the old hand-maintained
// 7-branch list. Branches with real coords skip pincode->coords resolution
// entirely in api/check-pincode.js; branches missing coords (marked "-" in
// the CSV) keep only their pincode so the existing pincode lookup/geocode
// fallback still covers them.
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "../Branch_details.csv");
const OUT_PATH = path.join(__dirname, "../branches.json");

// Minimal RFC4180 CSV parser: handles quoted fields with embedded commas
// and newlines, which plain split(",") can't (several addresses in this
// file contain both).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const raw = fs.readFileSync(CSV_PATH, "utf8");
const rows = parseCsv(raw);
const header = rows[0];
const dataRows = rows.slice(1);

const branches = [];
const missingCoords = [];

for (const cols of dataRows) {
  const [name, state, address, pincode, latRaw, lngRaw] = cols;
  if (!name || !pincode) continue;

  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);
  const entry = { name: name.trim(), pincode: pincode.trim() };

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    entry.coords = [lat, lng];
  } else {
    missingCoords.push(`${name.trim()} (${pincode.trim()})`);
  }
  branches.push(entry);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(branches, null, 2) + "\n");

console.log(`Wrote ${branches.length} branches to branches.json`);
if (missingCoords.length) {
  console.log(
    `${missingCoords.length} branches have no lat/long in the CSV (will fall back to pincode lookup):`
  );
  missingCoords.forEach((b) => console.log(`  - ${b}`));
}
