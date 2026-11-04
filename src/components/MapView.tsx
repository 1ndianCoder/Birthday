import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ago, escapeHtml, LIVE_SECONDS, secondsSince } from '../lib/format';
import type { Player, PlayerLocation, Team } from '../lib/types';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: 'start' | 'done' | 'finish' | 'host' | 'host-ok';
  text: string; // short marker text, e.g. sequence number
  radius?: number;
}

interface Props {
  players: Player[];
  teams?: Team[];
  locations: Record<string, PlayerLocation>;
  meId?: string;
  waypoints: Waypoint[];
  now: number;
  className?: string;
  /** Route editor: show a draggable-by-tap pin and report taps. */
  pick?: { lat: number; lng: number; radius: number } | null;
  onPick?: (lat: number, lng: number) => void;
}

const SYDNEY: L.LatLngExpression = [-33.8688, 151.2093];

export function MapView({ players, teams = [], locations, meId, waypoints, now, className = '', pick, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const playerLayer = useRef<L.LayerGroup | null>(null);
  const wpLayer = useRef<L.LayerGroup | null>(null);
  const pickLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(SYDNEY, 14);
    // CARTO "Dark Matter" basemap, built on OpenStreetMap data.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20, subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(m);
    wpLayer.current = L.layerGroup().addTo(m);
    playerLayer.current = L.layerGroup().addTo(m);
    pickLayer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    map.current = m;
    // Leaflet needs a size recalculation when shown inside tabs/sheets.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; fitted.current = false; };
  }, []);

  // Waypoints (start, discovered destinations, finish, or the host's full route)
  useEffect(() => {
    const layer = wpLayer.current;
    if (!layer) return;
    layer.clearLayers();
    waypoints.forEach((w) => {
      if (w.radius && (w.kind === 'host' || w.kind === 'host-ok')) {
        L.circle([w.lat, w.lng], { radius: w.radius, color: w.kind === 'host-ok' ? '#35D69B' : '#8C94A9', weight: 1, fillOpacity: 0.08 }).addTo(layer);
      }
      const cls = w.kind === 'host-ok' ? 'host ok' : w.kind;
      L.marker([w.lat, w.lng], {
        icon: L.divIcon({ className: '', html: `<div class="wp ${cls}">${escapeHtml(w.text)}</div>`, iconSize: [0, 0] }),
        zIndexOffset: w.kind === 'finish' ? 500 : 0,
      }).bindPopup(`<strong>${escapeHtml(w.label)}</strong>`).addTo(layer);
    });
  }, [waypoints]);

  // Player markers — rebuilt each tick so the "updated Xs ago" labels stay honest.
  useEffect(() => {
    const layer = playerLayer.current;
    if (!layer) return;
    layer.clearLayers();
    players.forEach((p) => {
      const loc = locations[p.id];
      if (!loc || !p.sharing_location) return;
      const age = secondsSince(loc.updated_at, now);
      const stale = age > LIVE_SECONDS;
      const team = teams.find((t) => t.id === p.team_id);
      const ring = team?.color ?? (p.is_host ? '#E9EDF6' : '#2E8BFF');
      const label = `${escapeHtml(p.username)}${stale ? ` · ${ago(loc.updated_at, now)}` : ''}`;
      if (p.id === meId && loc.accuracy) {
        L.circle([loc.lat, loc.lng], { radius: Math.min(loc.accuracy, 200), color: '#FF8A1F', weight: 1, fillOpacity: 0.06 }).addTo(layer);
      }
      L.marker([loc.lat, loc.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div class="pm ${p.id === meId ? 'me' : ''} ${stale ? 'stale' : ''} ${p.needs_help ? 'help' : ''}" style="--ring:${ring}">
                   <span class="pm-av">${escapeHtml(p.avatar)}</span><span class="pm-name">${label}</span></div>`,
          iconSize: [0, 0],
        }),
        zIndexOffset: p.id === meId ? 1000 : 100,
      }).bindPopup(`<strong>${escapeHtml(p.username)}</strong><br/>${stale ? 'Last known position' : 'Live'} · updated ${ago(loc.updated_at, now)}${loc.accuracy ? `<br/>Accuracy about ${Math.round(loc.accuracy)} m` : ''}`)
        .addTo(layer);
    });
  }, [players, teams, locations, meId, now]);

  // Route-editor pin
  useEffect(() => {
    const layer = pickLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (pick) {
      L.circle([pick.lat, pick.lng], { radius: pick.radius, color: '#FF8A1F', weight: 2, fillOpacity: 0.12 }).addTo(layer);
      L.marker([pick.lat, pick.lng], { icon: L.divIcon({ className: '', html: '<div class="wp pick">◎</div>', iconSize: [0, 0] }) }).addTo(layer);
    }
  }, [pick]);

  // Fit to everything once, the first time there's something to show.
  useEffect(() => {
    if (fitted.current || !map.current) return;
    const pts: L.LatLngExpression[] = waypoints.map((w) => [w.lat, w.lng]);
    Object.values(locations).forEach((l) => pts.push([l.lat, l.lng]));
    if (pick) pts.push([pick.lat, pick.lng]);
    if (pts.length === 0) return;
    fitted.current = true;
    if (pts.length === 1) map.current.setView(pts[0], 16);
    else map.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }, [waypoints, locations, pick]);

  const fitAll = () => {
    if (!map.current) return;
    const pts: L.LatLngExpression[] = waypoints.map((w) => [w.lat, w.lng]);
    Object.values(locations).forEach((l) => pts.push([l.lat, l.lng]));
    if (pts.length) map.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  };
  const toMe = () => {
    const l = meId ? locations[meId] : undefined;
    if (l && map.current) map.current.setView([l.lat, l.lng], 17);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={el} className="absolute inset-0" />
      <div className="absolute right-3 top-3 z-[400] flex flex-col gap-2">
        <button onClick={fitAll} className="h-10 rounded-xl bg-deck2/95 border border-line px-3 text-[12px] font-bold">Show all</button>
        {meId && locations[meId] && (
          <button onClick={toMe} className="h-10 rounded-xl bg-deck2/95 border border-line px-3 text-[12px] font-bold text-flare">Find me</button>
        )}
      </div>
    </div>
  );
}
