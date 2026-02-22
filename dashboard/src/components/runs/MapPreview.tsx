import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import type { Circle as LeafletCircle } from 'leaflet';

const US_CENTER: [number, number] = [39.8, -98.6];
const US_ZOOM = 4;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const BRAND = '#3ecfad';

interface MapPreviewProps {
  lat?: number | null;
  lng?: number | null;
  radius: number;
}

function MapController({ lat, lng, radius }: MapPreviewProps) {
  const map = useMap();
  const circleRef = useRef<LeafletCircle | null>(null);

  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.8 });
      setTimeout(() => {
        if (circleRef.current) {
          map.fitBounds(circleRef.current.getBounds().pad(0.3), { animate: true, duration: 0.5 });
        }
      }, 850);
    } else {
      map.flyTo(US_CENTER, US_ZOOM, { duration: 0.8 });
    }
  }, [lat, lng, radius, map]);

  if (lat == null || lng == null) return null;

  return (
    <Circle
      ref={circleRef}
      center={[lat, lng]}
      radius={radius}
      pathOptions={{
        color: BRAND,
        weight: 2,
        fillColor: BRAND,
        fillOpacity: 0.12,
      }}
    />
  );
}

export function MapPreview({ lat, lng, radius }: MapPreviewProps) {
  const hasSelection = lat != null && lng != null;

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        height: '400px',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: hasSelection ? 1 : 0.5,
        transition: 'opacity 0.3s',
      }}
    >
      <MapContainer
        center={US_CENTER}
        zoom={US_ZOOM}
        style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
        dragging={false}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        boxZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url={TILE_URL}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <MapController lat={lat} lng={lng} radius={radius} />
      </MapContainer>

      {!hasSelection && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
          <span className="text-slate-500 text-sm font-medium px-4 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>
            Select a metro to preview location
          </span>
        </div>
      )}
    </div>
  );
}
