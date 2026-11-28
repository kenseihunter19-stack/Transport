import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker, Polyline, CircleMarker, Circle } from "leaflet";
import { pointAtRoute, type RouteDto, type RouteStopDto } from "@/lib/luanda-geofence";

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
  busLatLng?: [number, number] | null;
  emergency?: boolean;
  className?: string;
  route?: RouteDto | null;
  routes?: RouteDto[];
  routeCode?: string;
  visibleRouteCodes?: string[];
  multiRouteMode?: boolean;
  enableClustering?: boolean;
  scopeKey?: string;
  darkMode?: boolean;
  showBusMarker?: boolean;
  showZoomControl?: boolean;
  fleetMarkers?: LuandaFleetMarker[];
  selectedVehicleId?: number | null;
  onSelectVehicle?: (vehicleId: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  draftPin?: { lat: number; lng: number; label?: string; radiusM?: number } | null;
}

const LUANDA_DEFAULT_CENTER: [number, number] = [-8.855, 13.234];

export function LuandaMap({
  progress,
  busLatLng = null,
  emergency,
  className = "h-56",
  route = null,
  routes = [],
  routeCode,
  visibleRouteCodes,
  multiRouteMode = false,
  enableClustering = false,
  scopeKey,
  darkMode = false,
  showBusMarker = true,
  showZoomControl = false,
  fleetMarkers = [],
  selectedVehicleId = null,
  onSelectVehicle,
  onMapClick,
  draftPin = null,
}: LuandaMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const bus = useRef<Marker | null>(null);
  const draftMarker = useRef<Marker | null>(null);
  const draftCircle = useRef<Circle | null>(null);
  const fleetLayerMarkers = useRef<Marker[]>([]);
  const routeLines = useRef<Polyline[]>([]);
  const stopMarkers = useRef<CircleMarker[]>([]);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const fleetMarkersRef = useRef(fleetMarkers);
  fleetMarkersRef.current = fleetMarkers;
  const selectedVehicleIdRef = useRef(selectedVehicleId);
  selectedVehicleIdRef.current = selectedVehicleId;
  const enableClusteringRef = useRef(enableClustering);
  enableClusteringRef.current = enableClustering;
  const expandedClusterRef = useRef<string | null>(null);
  const lastScopeKeyRef = useRef<string | undefined>(undefined);

  const allRoutesList = useMemo(() => {
    if (route && !routes.some((r) => r.id === route.id && r.code === route.code)) {
      return [route, ...routes];
    }
    return routes;
  }, [route, routes]);

  const activeRoute = useMemo(() => {
    if (route) return route;
    if (routeCode) {
      const normalized = routeCode.trim().toUpperCase();
      const matched = allRoutesList.find((r) => r.code.trim().toUpperCase() === normalized);
      if (matched) return matched;
    }
    return allRoutesList[0] ?? null;
  }, [route, routeCode, allRoutesList]);

  const resolvedRoutes = useMemo(() => {
    if (multiRouteMode) {
      if (!visibleRouteCodes || visibleRouteCodes.length === 0) {
        return allRoutesList.filter((r) => r.active);
      }
      const allowed = new Set(visibleRouteCodes.map((c) => c.trim().toUpperCase()));
      return allRoutesList.filter((r) => allowed.has(r.code.trim().toUpperCase()));
    }
    return activeRoute ? [activeRoute] : [];
  }, [multiRouteMode, visibleRouteCodes, allRoutesList, activeRoute]);

  const routesRenderKey = useMemo(
    () =>
      resolvedRoutes
        .map(
          (r) =>
            `${r.id}:${r.code}:${r.pathCoordinates.length}:${r.stops
              .map((s) => `${s.id ?? s.position}:${s.latitude}:${s.longitude}:${s.name}`)
              .join("|")}`
        )
        .join(";"),
    [resolvedRoutes]
  );

  const resolvedRoutesRef = useRef(resolvedRoutes);
  resolvedRoutesRef.current = resolvedRoutes;

  const renderRoutes = () => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    routeLines.current.forEach((line) => line.remove());
    routeLines.current = [];
    stopMarkers.current.forEach((sm) => sm.remove());
    stopMarkers.current = [];

    const toDraw = resolvedRoutesRef.current;
    const selectedVehicle = fleetMarkersRef.current.find((f) => f.id === selectedVehicleIdRef.current);
    const highlightedRouteCode = multiRouteMode
      ? selectedVehicle
        ? selectedVehicle.routeCode.trim().toUpperCase()
        : toDraw[0]?.code.trim().toUpperCase() ?? null
      : activeRoute?.code.trim().toUpperCase() ?? null;

    toDraw.forEach((cfg) => {
      const isHighlighted = !multiRouteMode || cfg.code.trim().toUpperCase() === highlightedRouteCode;
      const lineCoords: [number, number][] =
        cfg.pathCoordinates.length >= 2
          ? cfg.pathCoordinates
          : cfg.stops.map((st) => [st.latitude, st.longitude] as [number, number]);

      if (lineCoords.length >= 2) {
        const casing = L.polyline(lineCoords, {
          color: darkMode ? "#ffffff" : "#09090b",
          weight: isHighlighted ? 8 : 5,
          opacity: isHighlighted ? (darkMode ? 0.32 : 0.72) : darkMode ? 0.14 : 0.3,
        }).addTo(m);

        const line = L.polyline(lineCoords, {
          color: isHighlighted ? "#e11d2e" : "#38bdf8",
          weight: isHighlighted ? 5 : 3,
          opacity: isHighlighted ? 0.96 : 0.58,
          dashArray: isHighlighted ? undefined : "6 6",
        })
          .bindTooltip(`${cfg.code} · ${cfg.corridor || cfg.name}`, { sticky: true })
          .addTo(m);

        routeLines.current.push(casing, line);
      }

      if (!multiRouteMode || isHighlighted || toDraw.length <= 2) {
        cfg.stops.forEach((s: RouteStopDto, index: number) => {
          const isEnd = index === cfg.stops.length - 1;
          const marker = L.circleMarker([s.latitude, s.longitude], {
            radius: isHighlighted ? (isEnd ? 7.5 : 5.5) : 4,
            color: "#ffffff",
            weight: isHighlighted ? 2.5 : 1.5,
            fillColor: isEnd ? "#16a34a" : "#09090b",
            fillOpacity: isHighlighted ? 1 : 0.75,
          })
            .bindTooltip(
              `${cfg.code} · ${index + 1}. ${s.name}${s.scheduledTime ? ` (${s.scheduledTime})` : ""}`,
              {
                permanent: false,
                direction: "top",
              }
            )
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
    resolvedRoutesRef.current.forEach((cfg) => {
      if (cfg.pathCoordinates.length > 0) {
        pts.push(...cfg.pathCoordinates);
      }
      cfg.stops.forEach((st) => pts.push([st.latitude, st.longitude]));
    });

    if (pts.length >= 2) {
      m.fitBounds(L.latLngBounds(pts), { padding: [32, 32], maxZoom: 14 });
    } else if (pts.length === 1) {
      m.setView(pts[0]!, 14);
    } else {
      m.setView(LUANDA_DEFAULT_CENTER, 12);
    }
  };

  const busLatLngRef = useRef<[number, number] | null>(busLatLng);
  busLatLngRef.current = busLatLng;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const showBusMarkerRef = useRef(showBusMarker);
  showBusMarkerRef.current = showBusMarker;
  const emergencyRef = useRef(emergency);
  emergencyRef.current = emergency;
  const activeRouteRef = useRef(activeRoute);
  activeRouteRef.current = activeRoute;
  const draftPinRef = useRef(draftPin);
  draftPinRef.current = draftPin;

  const syncSingleBusMarker = () => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    if (!showBusMarkerRef.current) {
      if (bus.current) {
        bus.current.remove();
        bus.current = null;
      }
      return;
    }

    const activePath =
      activeRouteRef.current?.pathCoordinates && activeRouteRef.current.pathCoordinates.length > 0
        ? activeRouteRef.current.pathCoordinates
        : activeRouteRef.current?.stops.map((s) => [s.latitude, s.longitude] as [number, number]) ?? [];

    const pos: [number, number] =
      busLatLngRef.current ??
      (activePath.length > 0 ? pointAtRoute(activePath, progressRef.current) : LUANDA_DEFAULT_CENTER);

    if (!busLatLngRef.current && activePath.length === 0) {
      if (bus.current) {
        bus.current.remove();
        bus.current = null;
      }
      return;
    }

    if (!bus.current) {
      bus.current = L.marker(pos, {
        icon: L.divIcon({
          className: "",
          html: '<div class="tg-bus"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg></div>',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
      }).addTo(m);
    } else {
      bus.current.setLatLng(pos);
    }
    bus.current.getElement()?.querySelector(".tg-bus")?.classList.toggle("tg-sos", !!emergencyRef.current);
  };

  const syncDraftPin = () => {
    const m = map.current;
    const L = leafletRef.current;
    if (!m || !L) return;

    if (draftMarker.current) {
      draftMarker.current.remove();
      draftMarker.current = null;
    }
    if (draftCircle.current) {
      draftCircle.current.remove();
      draftCircle.current = null;
    }

    const pin = draftPinRef.current;
    if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return;

    draftMarker.current = L.marker([pin.lat, pin.lng], {
      zIndexOffset: 950,
      icon: L.divIcon({
        className: "",
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:#e11d2e;border:3px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.55);"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    })
      .bindTooltip(pin.label || "Ponto selecionado", { permanent: false, direction: "top" })
      .addTo(m);

    if (pin.radiusM && pin.radiusM > 0) {
      draftCircle.current = L.circle([pin.lat, pin.lng], {
        radius: pin.radiusM,
        color: "#e11d2e",
        weight: 1.5,
        fillColor: "#e11d2e",
        fillOpacity: 0.12,
      }).addTo(m);
    }
  };

  const activeRouteKey = activeRoute ? `${activeRoute.id}:${activeRoute.code}` : "none";

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

      bus.current = null;
      draftMarker.current = null;
      draftCircle.current = null;
      syncSingleBusMarker();
      syncDraftPin();

      const handleViewportChange = () => {
        if (enableClusteringRef.current) {
          syncFleetMarkers();
        }
      };

      m.on("zoomend", handleViewportChange);
      m.on("moveend", handleViewportChange);
      m.on("click", (evt) => {
        onMapClickRef.current?.(
          Number(evt.latlng.lat.toFixed(6)),
          Number(evt.latlng.lng.toFixed(6))
        );
      });
      syncFleetMarkers();
    });

    return () => {
      cancelled = true;
      fleetLayerMarkers.current = [];
      routeLines.current = [];
      stopMarkers.current = [];
      bus.current = null;
      draftMarker.current = null;
      draftCircle.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [multiRouteMode ? "multi" : activeRouteKey, darkMode, showZoomControl]);

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
  }, [routesRenderKey, selectedVehicleId, scopeKey, darkMode]);

  useEffect(() => {
    syncSingleBusMarker();
  }, [showBusMarker, progress, busLatLng, emergency, activeRouteKey, darkMode, showZoomControl]);

  useEffect(() => {
    syncDraftPin();
  }, [draftPin?.lat, draftPin?.lng, draftPin?.label, draftPin?.radiusM, darkMode]);

  useEffect(() => {
    expandedClusterRef.current = null;
    syncFleetMarkers();
  }, [fleetMarkers, selectedVehicleId, enableClustering, darkMode, showZoomControl]);

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
      className={`overflow-hidden z-0 ${onMapClick ? "cursor-crosshair" : ""} ${
        darkMode ? "bg-[#0d1117] mobuss-map-dark" : "bg-zinc-200"
      } ${className}`}
    />
  );
}
