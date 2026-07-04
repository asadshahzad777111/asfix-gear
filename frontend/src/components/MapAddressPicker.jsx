import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { SHOP } from '../config/shop';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const DEFAULT_CENTER = [SHOP.lat, SHOP.lng];

export default function MapAddressPicker({ lat, lng, onChange, height = 220 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = Number.isFinite(Number(lat)) ? Number(lat) : DEFAULT_CENTER[0];
    const initialLng = Number.isFinite(Number(lng)) ? Number(lng) : DEFAULT_CENTER[1];

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

    const emit = (position) => {
      onChange?.({ lat: position.lat, lng: position.lng });
    };

    marker.on('dragend', () => {
      emit(marker.getLatLng());
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      emit(e.latlng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - nextLat) < 0.00001 && Math.abs(current.lng - nextLng) < 0.00001) {
      return;
    }
    markerRef.current.setLatLng([nextLat, nextLng]);
    mapRef.current.panTo([nextLat, nextLng]);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      className="map-address-picker"
      style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}
      aria-label="Map pin picker"
    />
  );
}
