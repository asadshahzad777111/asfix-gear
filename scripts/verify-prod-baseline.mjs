/**
 * Compare production products against a saved baseline (post-redeploy check).
 * Usage: node scripts/verify-prod-baseline.mjs [url]
 */
const BASELINE = {
  total: 19,
  newestId: 19,
  newestName: "Cover",
  customIds: [9, 10, 11, 12, 13],
};

const DEFAULT_IMAGES = {
  9: "photo-1612287230202-1ff1d85c1bdf",
  10: "photo-1593305843771-9f83c2aeda4f",
  11: "photo-1593640408182-31c70c8268f5",
  12: "photo-1626645731056-f792d8338e18",
  13: "photo-1598331668826-3c408fb35c19",
};

function sig(p) {
  const img = p.image || "";
  if (img.startsWith("data:")) return `base64:${img.length}`;
  const m = img.match(/photo-([a-z0-9-]+)/i);
  return m ? `unsplash:${m[1]}` : `url:${img.slice(0, 40)}`;
}

async function main() {
  const url = process.argv[2] || "https://asfixgear.com/api/products";
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const products = await res.json();

  const byId = [...products].sort((a, b) => b.id - a.id);
  const newest = byId[0];
  const customPresent = BASELINE.customIds.filter((id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return false;
    const img = p.image || "";
    if (id === 9 || id === 11 || id === 13) return img.startsWith("data:");
    if (id === 10) return img.includes("photo-1542751371");
    if (id === 12) return img.includes("photo-1552820728");
    return false;
  });

  const checks = {
    total: products.length === BASELINE.total,
    newestId: newest?.id === BASELINE.newestId,
    newestName: newest?.name === BASELINE.newestName,
    customImages: customPresent.length === BASELINE.customIds.length,
  };

  console.log(JSON.stringify({ url, checks, total: products.length, newest, customPresent, customIds: BASELINE.customIds }, null, 2));
  const pass = Object.values(checks).every(Boolean);
  console.log(pass ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
