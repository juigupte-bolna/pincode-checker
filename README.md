# Pincode Checker

Serverless API that checks whether a customer's pincode is within a set
distance (default 60 km, straight-line) of the nearest branch. Built for a
Bolna voice agent function call, deployed on Vercel.

## 1. Branches

`branches.json` is generated from `Branch_details.csv` (the full branch list,
with surveyed lat/long per branch) via:

```
npm run import-branches
```

This writes 226 branches to `branches.json`, each as
`{ "name", "pincode", "coords": [lat, lng] }`. Branches whose CSV row had no
lat/long (8 of them — marked `-,-` in the sheet) are written without a
`coords` field; `api/check-pincode.js` falls back to resolving their pincode
via `data/pincodes.json` / live Nominatim for those only.

Using the CSV's own surveyed coordinates (instead of resolving every branch
pincode to a pincode-area centroid) is more accurate, since a pincode
centroid can be several km from the branch's actual address.

To add/remove/update a branch, edit `Branch_details.csv`, re-run
`npm run import-branches`, and redeploy.

## 2. Deploy to Vercel

```
npx vercel
npx vercel --prod
```

Or connect the repo in the Vercel dashboard and it deploys on every push.
No environment variables or database required.

## 3. API

`GET /api/check-pincode?pincode=411038`

| Param | Required | Default | Notes |
|---|---|---|---|
| `pincode` | yes | — | 6-digit customer pincode to check |
| `radius_km` | no | `60` | Serviceable radius |
| `branch_pincodes` | no | `branches.json` | Comma-separated pincodes to check against instead of the bundled list, e.g. `411038,400059` |

Example response:

```json
{
  "serviceable": true,
  "pincode": "411038",
  "nearest_branch": "Pune - Kothrud",
  "nearest_branch_pincode": "411038",
  "distance_km": 0,
  "radius_km": 60,
  "result": "Yes, that pincode is serviceable. The nearest branch is Pune - Kothrud, about 0 km away."
}
```

The `result` field is plain English — this is what the Bolna agent should
read back to the caller.

## 4. Wire it into Bolna

Add a custom function tool to your agent:

- Name: `check_serviceability`
- Description: "Check if the customer's pincode is within the serviceable distance of a branch."
- Parameter: `pincode` (string, required, 6-digit Indian pincode)
- Method: `GET`
- URL: `https://<your-vercel-app>.vercel.app/api/check-pincode?pincode={{pincode}}`

The agent should speak the `result` field from the response.

## Accuracy notes

- Distance is **straight-line (haversine)**, not road distance. Road
  distance is typically 1.3–1.5x higher. If you need road distance later,
  that's a separate paid API (Google Distance Matrix) — not needed for now.
- Pincode coordinates come from a free GeoNames-based dataset
  (`data/pincodes.json`, ~10.9k pincodes, built from `data/IN_raw.csv` +
  `data/overrides.json` via `npm run build-data`). Coordinates are accurate
  to roughly 5-10 km since they represent a pincode's local area, not an
  exact address point.
- 3 of the 7 branch pincodes (Surat, Navi Mumbai, Indore) weren't in the
  base dataset — they were geocoded once via OpenStreetMap's free Nominatim
  service and stored in `data/overrides.json`.
- Any **customer** pincode not found locally is looked up live via the same
  free Nominatim service as a fallback (`lib/geo.js`), so coverage isn't
  limited to the bundled ~10.9k list. This adds a small amount of latency
  only on a cache miss, and only for the current warm instance — no API key
  or billing involved.
