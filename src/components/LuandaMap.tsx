import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, Polyline, CircleMarker } from "leaflet";
import { LUANDA_ROUTES, pointAtRoute, type RouteStop } from "@/lib/route-luanda";

interface LuandaMapProps {
  progress: number;
  emergency?: boolean;
  className?: string;
  routeId?: string;
}

export function LuandaMap({
  progress,
  emergency,
  className = "h-56",
  routeId = "route_a",
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

      polyline.current = L.polyline(activeRoute.path, {
        color: "#f2b705",
        weight: 6,
        opacity: 0.95,
      }).addTo(m);

      stopMarkers.current = activeRoute.stops.map((s: RouteStop, index: number) => {
        const isEnd = index === activeRoute.stops.length - 1;
        const marker = L.circleMarker(pointAtRoute(activeRoute.path, s.at), {
          radius: isEnd ? 8 : 6,
          color: isEnd ? "#10b981" : "#ffffff",
          weight: 3,
          fillColor: isEnd ? "#059669" : "#1b2540",
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
          html: '<div class="tg-bus">🚌</div>',
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
  }, [routeId]);

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

  return <div ref={el} className={`rounded-3xl overflow-hidden bg-slide-line z-0 shadow-inner ${className}`} />;
}
