import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { SHOP } from '../config/shop';
import { useTranslation } from '../context/LanguageContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const DEFAULT_CENTER = [SHOP.lat, SHOP.lng];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function validCoord(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function MapCanvas({ lat, lng, onPinMove, interactive = true, height = 220 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPinMoveRef = useRef(onPinMove);
  onPinMoveRef.current = onPinMove;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = validCoord(lat, lng) ? Number(lat) : DEFAULT_CENTER[0];
    const initialLng = validCoord(lat, lng) ? Number(lng) : DEFAULT_CENTER[1];

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      scrollWheelZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: interactive }).addTo(map);

    if (interactive) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onPinMoveRef.current?.({ lat: pos.lat, lng: pos.lng });
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        onPinMoveRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    if (!validCoord(lat, lng)) return;
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - nextLat) < 0.00001 && Math.abs(current.lng - nextLng) < 0.00001) {
      return;
    }
    markerRef.current.setLatLng([nextLat, nextLng]);
    mapRef.current.panTo([nextLat, nextLng]);
  }, [lat, lng]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
  }, [height]);

  return (
    <div
      ref={containerRef}
      className="map-address-picker__canvas"
      style={{ height, width: '100%' }}
      aria-hidden={!interactive}
    />
  );
}

export default function MapAddressPicker({
  lat,
  lng,
  onChange,
  previewHeight = 140,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(() => ({
    lat: validCoord(lat, lng) ? Number(lat) : DEFAULT_CENTER[0],
    lng: validCoord(lat, lng) ? Number(lng) : DEFAULT_CENTER[1],
  }));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (validCoord(lat, lng)) {
      setDraft({ lat: Number(lat), lng: Number(lng) });
    }
  }, [lat, lng]);

  const openModal = () => {
    setDraft({
      lat: validCoord(lat, lng) ? Number(lat) : DEFAULT_CENTER[0],
      lng: validCoord(lat, lng) ? Number(lng) : DEFAULT_CENTER[1],
    });
    setSearchQuery('');
    setSearchResults([]);
    setExpanded(true);
  };

  const closeModal = () => {
    setExpanded(false);
    setSearchResults([]);
  };

  const confirmLocation = () => {
    onChange?.({ lat: draft.lat, lng: draft.lng });
    closeModal();
  };

  const runSearch = useCallback(async (query) => {
    const q = query.trim();
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q,
        limit: '5',
        countrycodes: 'pk',
      });
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!expanded) return undefined;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(searchQuery), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, expanded, runSearch]);

  const pickSearchResult = (result) => {
    const nextLat = Number(result.lat);
    const nextLng = Number(result.lon);
    if (!validCoord(nextLat, nextLng)) return;
    setDraft({ lat: nextLat, lng: nextLng });
    setSearchResults([]);
    setSearchQuery(result.display_name || '');
  };

  const previewLat = validCoord(lat, lng) ? Number(lat) : draft.lat;
  const previewLng = validCoord(lat, lng) ? Number(lng) : draft.lng;

  return (
    <div className="map-address-picker">
      <button
        type="button"
        className="map-address-picker__preview"
        onClick={openModal}
        aria-label={t('address.mapExpand')}
      >
        <MapCanvas
          lat={previewLat}
          lng={previewLng}
          interactive={false}
          height={previewHeight}
        />
        <span className="map-address-picker__preview-overlay">
          {t('address.mapExpand')}
        </span>
      </button>
      <p className="address-map-hint">{t('address.mapHint')}</p>

      {expanded && createPortal(
        <div className="map-address-picker__modal" role="dialog" aria-modal="true" aria-label={t('address.mapPickerTitle')}>
          <div className="map-address-picker__modal-backdrop" onClick={closeModal} aria-hidden="true" />
          <div className="map-address-picker__modal-panel">
            <div className="map-address-picker__modal-head">
              <h4>{t('address.mapPickerTitle')}</h4>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>
                {t('common.cancel')}
              </button>
            </div>

            <div className="map-address-picker__search">
              <input
                type="search"
                placeholder={t('address.mapSearchPh')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searching && <p className="map-address-picker__search-status">{t('address.mapSearching')}</p>}
              {searchResults.length > 0 && (
                <ul className="map-address-picker__search-results">
                  {searchResults.map((r) => (
                    <li key={r.place_id}>
                      <button type="button" onClick={() => pickSearchResult(r)}>
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <MapCanvas
              lat={draft.lat}
              lng={draft.lng}
              onPinMove={setDraft}
              interactive
              height={320}
            />

            <p className="map-address-picker__coords">
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>

            <div className="map-address-picker__modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmLocation}>
                {t('address.mapOk')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
