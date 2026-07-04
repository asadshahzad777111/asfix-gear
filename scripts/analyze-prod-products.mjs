const DEFAULT_IMAGES = {
  1: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop&q=80",
  2: "https://images.unsplash.com/photo-1585790050230-5dd28404fcb9?w=600&h=600&fit=crop&q=80",
  3: "https://images.unsplash.com/photo-1583394290456-38d677e27651?w=600&h=600&fit=crop&q=80",
  4: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop&q=80",
  5: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop&q=80",
  6: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop&q=80",
  7: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop&q=80",
  8: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&h=600&fit=crop&q=80",
  9: "https://images.unsplash.com/photo-1612287230202-1ff1d85c1bdf?w=600&h=600&fit=crop&q=80",
  10: "https://images.unsplash.com/photo-1593305843771-9f83c2aeda4f?w=600&h=600&fit=crop&q=80",
  11: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&h=600&fit=crop&q=80",
  12: "https://images.unsplash.com/photo-1626645731056-f792d8338e18?w=600&h=600&fit=crop&q=80",
  13: "https://images.unsplash.com/photo-1598331668826-3c408fb35c19?w=600&h=600&fit=crop&q=80",
  14: "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop&q=80",
  15: "https://images.unsplash.com/photo-1599669454699-248893623440?w=600&h=600&fit=crop&q=80",
  16: "https://images.unsplash.com/photo-1587825140708-aa577f6e947e?w=600&h=600&fit=crop&q=80",
  17: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=600&fit=crop&q=80",
  18: "https://images.unsplash.com/photo-1538488889696-7961cb780c98?w=600&h=600&fit=crop&q=80",
};

const CATEGORY_DEFAULTS = new Set([
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1583394290456-38d677e27651?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1585790050230-5dd28404fcb9?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop&q=80",
]);

const defaultValues = new Set(Object.values(DEFAULT_IMAGES));

function unsplashPhotoId(url) {
  const m = String(url).match(/photo-([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

function isCustom(img, pid) {
  if (!img) return false;
  if (img.startsWith("data:")) return true;
  if (!img.includes("unsplash.com")) return true;
  const defaultImg = DEFAULT_IMAGES[pid];
  if (!defaultImg) {
    // New products (id > 18) may use category fallback — only flag if not any known default photo
    const photo = unsplashPhotoId(img);
    const known = [...CATEGORY_DEFAULTS, ...defaultValues]
      .map(unsplashPhotoId)
      .filter(Boolean);
    return photo ? !known.includes(photo) : true;
  }
  return unsplashPhotoId(img) !== unsplashPhotoId(defaultImg);
}

function imageType(img) {
  if (!img) return "none";
  if (img.startsWith("data:")) return "base64";
  if (img.includes("unsplash")) return "unsplash";
  return "custom_url";
}

async function main() {
  const url = process.argv[2] || "https://asfixgear.com/api/products";
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const products = await res.json();

  console.log("URL:", url);
  console.log("TOTAL:", products.length);
  if (products[0]) console.log("FIELDS:", Object.keys(products[0]).join(", "));

  const byId = [...products].sort((a, b) => (b.id || 0) - (a.id || 0));
  const newest = byId[0];
  console.log("\n=== NEWEST BY ID ===");
  for (const key of ["id", "name", "category", "price", "created_at", "stock"]) {
    if (newest[key] !== undefined) console.log(`  ${key}: ${newest[key]}`);
  }
  const img = newest.image || "";
  console.log("  image_type:", imageType(img));
  console.log("  image_len:", img.length);
  console.log("  image_preview:", img.slice(0, 120) + (img.length > 120 ? "..." : ""));

  const dated = products.filter((p) => p.created_at);
  if (dated.length) {
    const newestDt = dated.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    console.log("\n=== NEWEST BY created_at ===");
    console.log(`  id: ${newestDt.id}, name: ${newestDt.name}, created_at: ${newestDt.created_at}`);
  }

  console.log("\n=== CUSTOM / NON-DEFAULT IMAGES ===");
  const custom = products.filter((p) => isCustom(p.image, p.id));
  for (const p of custom) {
    const preview = (p.image || "").slice(0, 100) + ((p.image || "").length > 100 ? "..." : "");
    console.log(`ID ${p.id}: ${p.name} [${p.category}]`);
    console.log(`  default: ${(DEFAULT_IMAGES[p.id] || "n/a").slice(0, 80)}`);
    console.log(`  actual:  ${preview}`);
    console.log(`  len:     ${(p.image || "").length}`);
  }
  console.log(`\nCustom count: ${custom.length}`);

  const newIds = products.filter((p) => (p.id || 0) > 18);
  console.log(`\nProducts with id > 18: ${newIds.length}`);
  for (const p of newIds) {
    console.log(JSON.stringify({ id: p.id, name: p.name, category: p.category, price: p.price, created_at: p.created_at, stock: p.stock }, null, 2));
    console.log("  image_type:", imageType(p.image));
    console.log("  image_preview:", (p.image || "").slice(0, 120));
  }

  return { products, newest, custom, newIds };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
