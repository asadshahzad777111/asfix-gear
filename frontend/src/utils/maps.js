/** Google Maps pin link from coordinates (works on mobile + desktop). */
export function googleMapsUrl(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return `https://www.google.com/maps?q=${la},${ln}`;
}

/** OpenStreetMap link from coordinates. */
export function osmMapsUrl(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${ln}#map=16/${la}/${ln}`;
}

/** Static OSM preview tile (no API key). */
export function osmStaticPreviewUrl(lat, lng, { width = 400, height = 120, zoom = 15 } = {}) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  const params = new URLSearchParams({
    center: `${la},${ln}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    markers: `${la},${ln},red-pushpin`,
  });
  return `https://staticmap.openstreetmap.de/staticmap.php?${params}`;
}
