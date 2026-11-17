import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, Polyline, CircleMarker } from "leaflet";
import { LUANDA_ROUTES, pointAtRoute, type RouteStop } from "@/lib/route-luanda";

interface LuandaMapProps {
  progress: number;
  emergency?: boolean;
  className?: string;
  routeId?: string;
  darkMode?: boolean;
}

export function LuandaMap({
  progress,
  emergency,
  className = "h-56",
  routeId = "route_a",
  darkMode = false,
}: LuandaMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const bus = useRef<Marker | null>(null);
  const polyline = useRef<Polyline | null>(null);
  const stopMarkers = useRef<CircleMarker[]>([]);
  const activeRoute = LUANDA_ROUTES[routeId] || LUANDA_ROUTES.route_a;

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;

      // Clean existing map instance if any
      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      const m = L.map(el.current, {
        zoomControl: false,
        attributionControl: false,
      }).fitBounds(L.latLngBounds(activeRoute.path), {
        padding: [24, 24],
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(m);

      // Outer casing for crisp Uber/Yango/Waze route contrast
      L.polyline(activeRoute.path, {
        color: darkMode ? "#ffffff" : "#09090b",
        weight: 8,
        opacity: darkMode ? 0.35 : 0.75,
      }).addTo(m);

      polyline.current = L.polyline(activeRoute.path, {
        color: "#e11d2e",
        weight: 5,
        opacity: 0.98,
      }).addTo(m);

      stopMarkers.current = activeRoute.stops.map((s: RouteStop, index: number) => {
        const isEnd = index === activeRoute.stops.length - 1;
        const marker = L.circleMarker(pointAtRoute(activeRoute.path, s.at), {
          radius: isEnd ? 8 : 5.5,
          color: "#ffffff",
          weight: 3,
          fillColor: isEnd ? "#16a34a" : "#09090b",
          fillOpacity: 1,
        })
          .bindTooltip(`${index + 1}. ${s.name}`, {
            permanent: false,
            direction: "top",
          })
          .addTo(m);
        return marker;
      });

      const currentPos = pointAtRoute(activeRoute.path, progress);
      bus.current = L.marker(currentPos, {
        icon: L.divIcon({
          className: "",
          html: '<div class="tg-bus"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      }).addTo(m);

      map.current = m;
    });

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [routeId, darkMode]);

  // Update bus position when progress changes
  useEffect(() => {
    if (!bus.current) return;
    const pos = pointAtRoute(activeRoute.path, progress);
    bus.current.setLatLng(pos);
  }, [progress, activeRoute]);

  // SOS pulse animation
  useEffect(() => {
    bus.current?.getElement()?.querySelector(".tg-bus")?.classList.toggle("tg-sos", !!emergency);
  }, [emergency, progress]);

  return (
    <div
      ref={el}
      className={`overflow-hidden z-0 ${darkMode ? "bg-[#0d1117] mobuss-map-dark" : "bg-zinc-200"} ${className}`}
    />
  );
}
