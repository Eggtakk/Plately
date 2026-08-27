'use client';
import { useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { BaseMap } from './BaseMap';

export function DetailMap({ coords, label }: { coords: [number, number]; label: string }) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  return (
    <BaseMap
      center={coords}
      zoom={15}
      label={label}
      onReady={(m) => {
        markerRef.current?.remove();
        markerRef.current = new maplibregl.Marker({ color: '#1F6E52' }).setLngLat(coords).addTo(m);
      }}
    />
  );
}
