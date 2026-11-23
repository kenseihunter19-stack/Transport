import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, Polyline, CircleMarker } from "leaflet";
import { LUANDA_ROUTES, pointAtRoute, type RouteStop } from "@/lib/route-luanda";

export interface LuandaFleetMarker {
  id: number;
  fleetNumber: number;
  plate: string;
  routeCode: string;
  driverName: string;
  schoolName?: string;
  statusLabel: string;
  lat: number;
  lng: number;
  isLiveGps: boolean;
  gpsStatus?: "live" | "stale" | "unavailable";
}

interface LuandaMapProps {
  progress: number;
  emergency?: boolean;
  className?: string;
  routeId?: string;
  visibleRouteIds?: string[];
  multiRouteMode?: boolean;
  enableClustering?: boolean;
  scopeKey?: string;
  darkMode?: boolean;
  showBusMarker?: boolean;
  showZoomControl?: boolean;
  fleetMarkers?: LuandaFleetMarker[];
  selectedVehicleId?: number | null;
  onSelectVehicle?: (vehicleId: number) => void;
}

const LUANDA_DEFAULT_CENTER: [number, number] = [-8.855, 13.234];

export function LuandaMap({
  progress,
  emergency,
  className = "h-56",
  routeId = "route_a",
  visibleRouteIds,
  multiRouteMode = false,
  enableClustering = false,
  scopeKey,
  darkMode = false,
  showBusMarker = true,
  showZoomControl = false,
  fleetMarkers = [],
  selectedVehicleId = null,
  onSelectVehicle,
}: LuandaMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const bus = useRef<Marker | null>(null);
  const fleetLayerMarkers = useRef<Marker[]>([]);
  const routeLines = useRef<Polyline[]>([]);
  const stopMarkers = useRef<CircleMarker[]>([]);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;
  const fleetMarkersRef = useRef(fleetMarkers);
  fleetMarkersRef.current = fleetMarkers;
  const selectedVehicleIdRef = useRef(selectedVehicleId);
  selectedVehicleIdRef.current = selectedVehicleId;
  const enableClusteringRef = useRef(enableClustering);
  enableClusteringRef.current = enableClustering;
  const expandedClusterRef = useRef<string | null>(null);
  const lastScopeKeyRef = useRef<string | undefined>(undefined);

  const activeRoute = LUANDA_ROUTES[routeId] || LUANDA_ROUTES.route_a;
  const resolvedRouteIds = multiRouteMode
    ? Array.from(new Set((visibleRouteIds ?? []).filter((id) => Boolean(LUANDA_ROUTES[id]))))
    : [activeRoute.id];
  const resolvedRouteIdsKey = resolvedRouteIds.join(",");

  const renderRoutes = () => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    routeLines.current.forEach((line) => line.remove());
    routeLines.current = [];
    stopMarkers.current.forEach((sm) => sm.remove());
    stopMarkers.current = [];

    const selectedVehicle = fleetMarkersRef.current.find((f) => f.id === selectedVehicleIdRef.current);
    const highlightedRouteId = multiRouteMode
      ? selectedVehicle
        ? Object.values(LUANDA_ROUTES).find((r) => r.code === selectedVehicle.routeCode)?.id ?? null
        : resolvedRouteIds[0] ?? null
      : activeRoute.id;

    resolvedRouteIds.forEach((id) => {
      const cfg = LUANDA_ROUTES[id];
      if (!cfg) return;
      const isHighlighted = !multiRouteMode || id === highlightedRouteId;

      const casing = L.polyline(cfg.path, {
        color: darkMode ? "#ffffff" : "#09090b",
        weight: isHighlighted ? 8 : 5,
        opacity: isHighlighted ? (darkMode ? 0.32 : 0.72) : darkMode ? 0.14 : 0.3,
      }).addTo(m);

      const line = L.polyline(cfg.path, {
        color: isHighlighted ? "#e11d2e" : "#38bdf8",
        weight: isHighlighted ? 5 : 3,
        opacity: isHighlighted ? 0.96 : 0.58,
        dashArray: isHighlighted ? undefined : "6 6",
      })
        .bindTooltip(`${cfg.code} · ${cfg.corridor}`, { sticky: true })
        .addTo(m);

      routeLines.current.push(casing, line);

      if (!multiRouteMode || isHighlighted || resolvedRouteIds.length <= 2) {
        cfg.stops.forEach((s: RouteStop, index: number) => {
          const isEnd = index === cfg.stops.length - 1;
          const marker = L.circleMarker(pointAtRoute(cfg.path, s.at), {
            radius: isHighlighted ? (isEnd ? 7.5 : 5) : 4,
            color: "#ffffff",
            weight: isHighlighted ? 2.5 : 1.5,
            fillColor: isEnd ? "#16a34a" : "#09090b",
            fillOpacity: isHighlighted ? 1 : 0.75,
          })
            .bindTooltip(`${cfg.code} · ${index + 1}. ${s.name}`, {
              permanent: false,
              direction: "top",
            })
            .addTo(m);
          stopMarkers.current.push(marker);
        });
      }
    });
  };

  const buildSingleVehicleMarker = (
    m: LMap,
    L: typeof import("leaflet"),
    item: LuandaFleetMarker,
    latLng: [number, number]
  ) => {
    const isSelected = selectedVehicleIdRef.current === item.id;
    const isLive = item.isLiveGps || item.gpsStatus === "live";
    const badgeBg = isSelected ? "#e11d2e" : isLive ? "#16a34a" : "#3f3f46";
    const ringColor = isSelected ? "#ffffff" : isLive ? "#bbf7d0" : "#fbbf24";
    const liveDot = isLive
      ? `<span style="width:6px;height:6px;border-radius:9999px;background:#dcfce7;display:inline-block;"></span>`
      : `<span style="width:6px;height:6px;border-radius:9999px;background:#fbbf24;display:inline-block;"></span>`;
    const gpsTag = isLive ? "GPS Ao Vivo" : "Última Localização (Desatualizado)";
    const schoolTag = item.schoolName ? ` · ${item.schoolName}` : "";

    return L.marker(latLng, {
      zIndexOffset: isSelected ? 900 : isLive ? 400 : 100,
      icon: L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:8px;background:${badgeBg};color:#fff;border:2px solid ${ringColor};font-family:var(--font-body);font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 6px 16px rgba(0,0,0,0.45);cursor:pointer;">${liveDot}<span>B${item.fleetNumber}</span></div>`,
        iconSize: [52, 26],
        iconAnchor: [26, 13],
      }),
    })
      .bindTooltip(
        `Autocarro ${item.fleetNumber} (${item.plate}) · ${item.routeCode}${schoolTag} · ${item.statusLabel} · ${gpsTag}`,
        { direction: "top", permanent: false }
      )
      .on("click", () => {
        onSelectVehicleRef.current?.(item.id);
      })
      .addTo(m);
  };

  const syncFleetMarkers = () => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    fleetLayerMarkers.current.forEach((mk) => mk.remove());
    fleetLayerMarkers.current = [];

    const items = fleetMarkersRef.current;
    if (!items || items.length === 0) return;

    if (!enableClusteringRef.current || items.length === 1) {
      fleetLayerMarkers.current = items.map((item) =>
        buildSingleVehicleMarker(m, L, item, [item.lat, item.lng])
      );
      return;
    }

    // Zoom-aware screen-space clustering (~44px radius)
    const thresholdPx = 44;
    const clusters: Array<{
      anchorPt: { x: number; y: number };
      items: LuandaFleetMarker[];
    }> = [];

    items.forEach((item) => {
      const pt = m.latLngToContainerPoint([item.lat, item.lng]);
      const match = clusters.find(
        (c) => Math.hypot(c.anchorPt.x - pt.x, c.anchorPt.y - pt.y) <= thresholdPx
      );
      if (match) {
        match.items.push(item);
      } else {
        clusters.push({ anchorPt: { x: pt.x, y: pt.y }, items: [item] });
      }
    });

    const created: Marker[] = [];
    clusters.forEach((cluster) => {
      if (cluster.items.length === 1) {
        const single = cluster.items[0]!;
        created.push(buildSingleVehicleMarker(m, L, single, [single.lat, single.lng]));
        return;
      }

      const clusterKey = cluster.items.map((i) => i.id).sort((a, b) => a - b).join(",");
      const avgLat = cluster.items.reduce((acc, i) => acc + i.lat, 0) / cluster.items.length;
      const avgLng = cluster.items.reduce((acc, i) => acc + i.lng, 0) / cluster.items.length;
      const isExpanded = expandedClusterRef.current === clusterKey;

      if (isExpanded) {
        const centerPt = m.latLngToContainerPoint([avgLat, avgLng]);
        const radiusPx = 30;
        cluster.items.forEach((item, idx) => {
          const angle = (2 * Math.PI * idx) / cluster.items.length - Math.PI / 2;
          const offsetPt = L.point(
            centerPt.x + Math.cos(angle) * radiusPx,
            centerPt.y + Math.sin(angle) * radiusPx
          );
          const latLng = m.containerPointToLatLng(offsetPt);
          created.push(buildSingleVehicleMarker(m, L, item, [latLng.lat, latLng.lng]));
        });
        return;
      }

      const hasSelected = cluster.items.some((i) => i.id === selectedVehicleIdRef.current);
      const liveCount = cluster.items.filter((i) => i.isLiveGps || i.gpsStatus === "live").length;
      const badgeBg = hasSelected ? "#e11d2e" : liveCount > 0 ? "#18181b" : "#27272a";
      const borderCol = hasSelected ? "#ffffff" : liveCount > 0 ? "#22c55e" : "#fbbf24";
      const summaryLines = cluster.items
        .map((i) => `B${i.fleetNumber} (${i.plate}) · ${i.routeCode}`)
        .join("<br/>");

      const clusterMarker = L.marker([avgLat, avgLng], {
        zIndexOffset: hasSelected ? 800 : 300,
        icon: L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;gap:4px;min-width:36px;height:36px;padding:0 9px;border-radius:9999px;background:${badgeBg};color:#fff;border:2.5px solid ${borderCol};font-family:var(--font-body);font-size:12px;font-weight:900;box-shadow:0 8px 20px rgba(0,0,0,0.5);cursor:pointer;"><span>${cluster.items.length}</span></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      })
        .bindTooltip(
          `<div style="font-size:11px;line-height:1.4;"><strong>${cluster.items.length} viaturas próximas</strong><br/>${summaryLines}</div>`,
          { direction: "top", permanent: false }
        )
        .on("click", () => {
          const bounds = L.latLngBounds(cluster.items.map((i) => [i.lat, i.lng] as [number, number]));
          const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
          const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
          if ((latSpan > 0.0005 || lngSpan > 0.0005) && m.getZoom() < 15) {
            expandedClusterRef.current = null;
            m.fitBounds(bounds, { padding: [52, 52], maxZoom: 16 });
          } else {
            expandedClusterRef.current = clusterKey;
            syncFleetMarkers();
          }
        })
        .addTo(m);

      created.push(clusterMarker);
    });

    fleetLayerMarkers.current = created;
  };

  const fitMapToScope = (m: LMap, L: typeof import("leaflet")) => {
    const pts: [number, number][] = [];
    fleetMarkersRef.current.forEach((f) => pts.push([f.lat, f.lng]));
    resolvedRouteIds.forEach((id) => {
      const cfg = LUANDA_ROUTES[id];
      if (cfg) pts.push(...cfg.path);
    });

    if (pts.length >= 2) {
      m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 14 });
    } else if (pts.length === 1) {
      m.setView(pts[0]!, 14);
    } else {
      m.setView(LUANDA_DEFAULT_CENTER, 12);
    }
  };

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      leafletRef.current = L;

      if (map.current) {
        map.current.remove();
        map.current = null;
      }

      const m = L.map(el.current, {
        zoomControl: showZoomControl,
        attributionControl: false,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(m);

      map.current = m;
      fitMapToScope(m, L);
      renderRoutes();

      if (showBusMarker) {
        const currentPos = pointAtRoute(activeRoute.path, progress);
        bus.current = L.marker(currentPos, {
          icon: L.divIcon({
            className: "",
            html: '<div class="tg-bus"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></div>',
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          }),
        }).addTo(m);
      } else {
        bus.current = null;
      }

      const handleViewportChange = () => {
        if (enableClusteringRef.current) {
          syncFleetMarkers();
        }
      };

      m.on("zoomend", handleViewportChange);
      m.on("moveend", handleViewportChange);
      syncFleetMarkers();
    });

    return () => {
      cancelled = true;
      fleetLayerMarkers.current = [];
      routeLines.current = [];
      stopMarkers.current = [];
      bus.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [multiRouteMode ? "multi" : routeId, darkMode, showBusMarker, showZoomControl]);

  // Re-draw visible routes & re-fit bounds when school/filter scope changes
  useEffect(() => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    renderRoutes();

    if (scopeKey !== undefined && lastScopeKeyRef.current !== scopeKey) {
      lastScopeKeyRef.current = scopeKey;
      expandedClusterRef.current = null;
      fitMapToScope(m, L);
    }
  }, [resolvedRouteIdsKey, selectedVehicleId, scopeKey, darkMode]);

  // Update simulator bus position when progress changes
  useEffect(() => {
    if (!bus.current) return;
    const pos = pointAtRoute(activeRoute.path, progress);
    bus.current.setLatLng(pos);
  }, [progress, activeRoute]);

  // SOS pulse animation
  useEffect(() => {
    bus.current?.getElement()?.querySelector(".tg-bus")?.classList.toggle("tg-sos", !!emergency);
  }, [emergency, progress]);

  // Sync real fleet GPS markers
  useEffect(() => {
    expandedClusterRef.current = null;
    syncFleetMarkers();
  }, [fleetMarkers, selectedVehicleId, enableClustering, darkMode, showZoomControl]);

  // Pan smoothly to selected vehicle if it has coordinates
  useEffect(() => {
    const m = map.current;
    if (!m || !selectedVehicleId) return;
    const target = fleetMarkers.find((f) => f.id === selectedVehicleId);
    if (target) {
      m.panTo([target.lat, target.lng], { animate: true, duration: 0.4 });
    }
  }, [selectedVehicleId]);

  return (
    <div
      ref={el}
      className={`overflow-hidden z-0 ${darkMode ? "bg-[#0d1117] mobuss-map-dark" : "bg-zinc-200"} ${className}`}
    />
  );
}
