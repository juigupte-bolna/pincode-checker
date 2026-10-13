const { coordsForPincode, distanceKm } = require("../lib/geo");
const defaultBranches = require("../branches.json");

const DEFAULT_RADIUS_KM = 60;
const PINCODE_RE = /^\d{6}$/;

async function resolveBranches(rawList) {
  const resolved = [];
  const unresolved = [];
  for (const branch of rawList) {
    // Branches imported from Branch_details.csv already carry surveyed
    // coords, which are more accurate than a pincode's area centroid —
    // only fall back to pincode resolution when coords weren't supplied.
    const coords = branch.coords || (await coordsForPincode(branch.pincode));
    if (coords) resolved.push({ ...branch, coords });
    else unresolved.push(branch.pincode);
  }
  return { resolved, unresolved };
}

module.exports = async (req, res) => {
  const { pincode, branch_pincodes, radius_km } = req.query;

  if (!pincode || !PINCODE_RE.test(String(pincode).trim())) {
    return res.status(400).json({
      error: "invalid_pincode",
      result: "That doesn't look like a valid 6-digit pincode. Could you repeat it?",
    });
  }

  const radius = Number(radius_km) > 0 ? Number(radius_km) : DEFAULT_RADIUS_KM;

  const customerCoords = await coordsForPincode(String(pincode).trim());
  if (!customerCoords) {
    return res.status(200).json({
      serviceable: false,
      reason: "unknown_pincode",
      result:
        "I couldn't find that pincode in our records. Could you double check and share it again?",
    });
  }

  // Branches can come from the request (dynamic, per-call) or fall back to
  // the bundled branches.json (static list maintained in this repo).
  let branchList = defaultBranches;
  if (branch_pincodes) {
    branchList = String(branch_pincodes)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ name: p, pincode: p }));
  }

  const { resolved, unresolved } = await resolveBranches(branchList);

  if (resolved.length === 0) {
    return res.status(200).json({
      serviceable: false,
      reason: "no_branches_resolved",
      unresolved_branch_pincodes: unresolved,
      result: "I'm unable to check serviceability right now. Please try again shortly.",
    });
  }

  const nearest = resolved
    .map((b) => ({ ...b, distance_km: distanceKm(customerCoords, b.coords) }))
    .sort((a, b) => a.distance_km - b.distance_km)[0];

  const roundedDistance = Math.round(nearest.distance_km);
  const serviceable = nearest.distance_km <= radius;

  return res.status(200).json({
    serviceable,
    pincode: String(pincode).trim(),
    nearest_branch: nearest.name,
    nearest_branch_pincode: nearest.pincode,
    distance_km: roundedDistance,
    radius_km: radius,
    result: serviceable
      ? `Yes, that pincode is serviceable. The nearest branch is ${nearest.name}, about ${roundedDistance} km away.`
      : `That pincode is outside our ${radius} km service area. The nearest branch is ${nearest.name}, about ${roundedDistance} km away.`,
  });
};
