import { useMemo, useRef, useState, useEffect } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Map as MapIcon,
  Navigation,
  RefreshCw
} from 'lucide-react';
import L from 'leaflet';
import type { DeliveryItem, SystemSettings } from '../types';
import { batchGeocode } from '../utils/geocoder';

interface RouteAnalysisProps {
  items: DeliveryItem[];
  settings: SystemSettings;
  onUpdateItemCoords: (id: string, lat: number, lng: number, error?: boolean) => void;
}

type CoordinateStop = DeliveryItem & {
  latitude: number;
  longitude: number;
};

type OrderedStop = CoordinateStop & {
  optimizedSeq: number;
  distanceFromPreviousKm: number;
  displayLatitude: number;
  displayLongitude: number;
  displayDistanceFromPreviousKm: number;
  hasOverlappingCoordinate: boolean;
};

interface RoutePlan {
  orderedStops: OrderedStop[];
  optimizedDistanceKm: number;
  originalDistanceKm: number;
  savedDistanceKm: number;
  methodLabel: string;
  hasOverlappingCoordinates: boolean;
  overlappingStopCount: number;
}

const EXACT_ROUTE_LIMIT = 12;
const DEFAULT_FALLBACK_COORDINATE = { latitude: 25.0478, longitude: 121.517 };
const OVERLAP_OFFSET_RADIUS_METERS = 190;

const getCoordinateKey = (stop: Pick<CoordinateStop, 'latitude' | 'longitude'>) => {
  return `${stop.latitude.toFixed(6)},${stop.longitude.toFixed(6)}`;
};

const isDefaultFallbackCoordinate = (item: DeliveryItem) => {
  if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') return false;
  return (
    Math.abs(item.latitude - DEFAULT_FALLBACK_COORDINATE.latitude) < 0.000001 &&
    Math.abs(item.longitude - DEFAULT_FALLBACK_COORDINATE.longitude) < 0.000001
  );
};

const isCoordinateStop = (item: DeliveryItem): item is CoordinateStop => {
  return (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude)
  );
};

const hasReliableCoordinate = (item: DeliveryItem) => {
  return (
    isCoordinateStop(item) &&
    item.geocodingError !== true &&
    item.geocoded !== false &&
    !isDefaultFallbackCoordinate(item)
  );
};

const formatDistance = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return '--';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
};

const getDistanceKm = (from: CoordinateStop, to: CoordinateStop) => {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lngDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const getPathDistance = (route: number[], distanceMatrix: number[][]) => {
  let distance = 0;
  for (let index = 1; index < route.length; index += 1) {
    distance += distanceMatrix[route[index - 1]][route[index]];
  }
  return distance;
};

const buildDistanceMatrix = (stops: CoordinateStop[]) => {
  return stops.map((from) => stops.map((to) => (from.id === to.id ? 0 : getDistanceKm(from, to))));
};

const getOffsetCoordinate = (stop: CoordinateStop, index: number, count: number) => {
  if (count <= 1) {
    return { displayLatitude: stop.latitude, displayLongitude: stop.longitude };
  }

  const angle = (2 * Math.PI * index) / count;
  const radiusMeters = OVERLAP_OFFSET_RADIUS_METERS + Math.floor(index / 8) * 60;
  const latOffset = (Math.sin(angle) * radiusMeters) / 111_320;
  const lngOffset =
    (Math.cos(angle) * radiusMeters) /
    (111_320 * Math.max(Math.cos((stop.latitude * Math.PI) / 180), 0.2));

  return {
    displayLatitude: stop.latitude + latOffset,
    displayLongitude: stop.longitude + lngOffset
  };
};

const addDisplayCoordinates = (orderedStops: Array<Omit<OrderedStop, 'displayLatitude' | 'displayLongitude' | 'displayDistanceFromPreviousKm' | 'hasOverlappingCoordinate'>>) => {
  const groupedStops = new Map<string, typeof orderedStops>();

  orderedStops.forEach((stop) => {
    const coordinateKey = getCoordinateKey(stop);
    const group = groupedStops.get(coordinateKey) || [];
    group.push(stop);
    groupedStops.set(coordinateKey, group);
  });

  const groupIndexes = new Map<string, number>();
  const withDisplayCoordinates = orderedStops.map((stop) => {
    const coordinateKey = getCoordinateKey(stop);
    const group = groupedStops.get(coordinateKey) || [stop];
    const groupIndex = groupIndexes.get(coordinateKey) || 0;
    groupIndexes.set(coordinateKey, groupIndex + 1);
    const displayPosition = getOffsetCoordinate(stop, groupIndex, group.length);

    return {
      ...stop,
      ...displayPosition,
      displayDistanceFromPreviousKm: stop.distanceFromPreviousKm,
      hasOverlappingCoordinate: group.length > 1
    };
  });

  return withDisplayCoordinates.map((stop, index) => {
    if (index === 0) return stop;

    const previousStop = withDisplayCoordinates[index - 1];
    const displayDistanceFromPreviousKm = stop.distanceFromPreviousKm > 0.001
      ? stop.distanceFromPreviousKm
      : getDistanceKm(
          {
            ...previousStop,
            latitude: previousStop.displayLatitude,
            longitude: previousStop.displayLongitude
          },
          {
            ...stop,
            latitude: stop.displayLatitude,
            longitude: stop.displayLongitude
          }
        );

    return {
      ...stop,
      displayDistanceFromPreviousKm
    };
  });
};

// 【演算法鎖定】：強制窮舉法以 index 0 為起點
const findExactShortestOpenPath = (distanceMatrix: number[][]) => {
  const count = distanceMatrix.length;
  const maskCount = 1 << count;
  const dp = Array.from({ length: maskCount }, () => Array(count).fill(Number.POSITIVE_INFINITY));
  const parent = Array.from({ length: maskCount }, () => Array(count).fill(-1));

  // 鎖定起點：初始化時，只允許 index 0 的距離為 0，其他點一律是無限大
  dp[1][0] = 0; 

  for (let mask = 1; mask < maskCount; mask += 1) {
    for (let last = 0; last < count; last += 1) {
      const currentDistance = dp[mask][last];
      if (!Number.isFinite(currentDistance)) continue;

      for (let next = 0; next < count; next += 1) {
        if ((mask & (1 << next)) !== 0) continue;

        const nextMask = mask | (1 << next);
        const candidateDistance = currentDistance + distanceMatrix[last][next];
        if (candidateDistance < dp[nextMask][next]) {
          dp[nextMask][next] = candidateDistance;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  const fullMask = maskCount - 1;
  let bestLast = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let last = 1; last < count; last += 1) {
    if (dp[fullMask][last] < bestDistance) {
      bestDistance = dp[fullMask][last];
      bestLast = last;
    }
  }

  const route: number[] = [];
  let mask = fullMask;
  let last = bestLast;

  while (last !== -1) {
    route.push(last);
    const previous = parent[mask][last];
    mask ^= 1 << last;
    last = previous;
  }

  return route.reverse();
};

const buildNearestNeighborRoute = (distanceMatrix: number[][], startIndex: number) => {
  const unvisited = new Set<number>();
  for (let index = 0; index < distanceMatrix.length; index += 1) {
    unvisited.add(index);
  }

  const route = [startIndex];
  unvisited.delete(startIndex);

  while (unvisited.size > 0) {
    const current = route[route.length - 1];
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    unvisited.forEach((candidate) => {
      const candidateDistance = distanceMatrix[current][candidate];
      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearest = candidate;
      }
    });

    route.push(nearest);
    unvisited.delete(nearest);
  }

  return route;
};

// 【演算法鎖定】：2-opt 交換法絕對不碰 index 0
const improveRouteWithTwoOpt = (route: number[], distanceMatrix: number[][]) => {
  let bestRoute = [...route];
  let bestDistance = getPathDistance(bestRoute, distanceMatrix);
  let improved = true;
  let attempts = 0;

  while (improved && attempts < 60) {
    improved = false;
    attempts += 1;

    // 鎖死起點：迴圈從 1 開始，不讓 index 0 參與路線交換
    for (let i = 1; i < bestRoute.length - 1; i += 1) {
      for (let j = i + 1; j < bestRoute.length; j += 1) {
        const candidateRoute = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1)
        ];
        const candidateDistance = getPathDistance(candidateRoute, distanceMatrix);

        if (candidateDistance < bestDistance - 0.01) {
          bestRoute = candidateRoute;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
};

// 【演算法鎖定】：大範圍搜索直接指定 0 號站點出發
const findHeuristicShortestOpenPath = (distanceMatrix: number[][]) => {
  // 不再迴圈測試所有起點，直接傳入 0 作為絕對起點
  const nearestRoute = buildNearestNeighborRoute(distanceMatrix, 0);
  const improvedRoute = improveRouteWithTwoOpt(nearestRoute, distanceMatrix);
  return improvedRoute;
};

// 【資料注入】：負責虛擬起點的產生與整合
const buildRoutePlan = (inputStops: CoordinateStop[]): RoutePlan | null => {
  if (inputStops.length === 0) return null;

  const stops = [...inputStops];
  const targetAddress = "文化三路33號";
  const normalize = (str: string) => str.replace(/\s/g, '');
  
  const startIdx = stops.findIndex(s => normalize(s.address).includes(normalize(targetAddress)));
  
  if (startIdx > -1) {
    const startStop = stops[startIdx];
    stops.splice(startIdx, 1);
    stops.unshift(startStop); 
  } else {
    // 【重點修改】若配送單中沒有倉庫地址，我們就「虛擬」一個出來並插在最前面
    const warehouseStop = {
      id: 'warehouse-base',
      seq: 0, 
      orderId: 'N/A',
      channel: '起點',
      address: '桃園市龜山區文化三路33號',
      recipient: '發車中心',
      phone: 'N/A',
      items: 'N/A',
      serviceType: 'N/A',
      deliveryDate: stops[0].deliveryDate, 
      deliveryTime: 'N/A',
      sku: 'N/A',
      remarks: '系統固定預設起點',
      latitude: 25.0588,
      longitude: 121.3665,
      geocoded: true,
      status: 'pending' as any // 加上 as any 強制通過型別檢查
    } as CoordinateStop; // 👈 在大括號後面加上這段，確保不會有其他遺漏的屬性報錯
    stops.unshift(warehouseStop);
  }
  
  if (stops.length === 1) {
    return {
      orderedStops: [{
        ...stops[0],
        optimizedSeq: 1,
        distanceFromPreviousKm: 0,
        displayLatitude: stops[0].latitude,
        displayLongitude: stops[0].longitude,
        displayDistanceFromPreviousKm: 0,
        hasOverlappingCoordinate: false
      }],
      optimizedDistanceKm: 0,
      originalDistanceKm: 0,
      savedDistanceKm: 0,
      methodLabel: '單站路線',
      hasOverlappingCoordinates: false,
      overlappingStopCount: 0
    };
  }

  const coordinateGroupCounts = stops.reduce<Record<string, number>>((groups, stop) => {
    const coordinateKey = getCoordinateKey(stop);
    groups[coordinateKey] = (groups[coordinateKey] || 0) + 1;
    return groups;
  }, {});
  
  const overlappingStopCount = Object.values(coordinateGroupCounts)
    .filter((count) => count > 1)
    .reduce((total, count) => total + count, 0);
    
  const hasOverlappingCoordinates = overlappingStopCount > 0;
  
  const distanceMatrix = buildDistanceMatrix(stops);
  const routeIndexes =
    stops.length <= EXACT_ROUTE_LIMIT
      ? findExactShortestOpenPath(distanceMatrix)
      : findHeuristicShortestOpenPath(distanceMatrix);
      
  const optimizedDistanceKm = getPathDistance(routeIndexes, distanceMatrix);
  const originalRouteIndexes = stops.map((_, index) => index);
  const originalDistanceKm = getPathDistance(originalRouteIndexes, distanceMatrix);

  const orderedStops = addDisplayCoordinates(routeIndexes.map((stopIndex, index) => {
    const previousStopIndex = routeIndexes[index - 1];
    return {
      ...stops[stopIndex],
      optimizedSeq: index + 1,
      distanceFromPreviousKm: index === 0 ? 0 : distanceMatrix[previousStopIndex][stopIndex]
    };
  }));
  
  const displayOptimizedDistanceKm = orderedStops.reduce(
    (total, stop) => total + stop.displayDistanceFromPreviousKm,
    0
  );

  return {
    orderedStops,
    optimizedDistanceKm: Math.max(optimizedDistanceKm, displayOptimizedDistanceKm),
    originalDistanceKm,
    savedDistanceKm: Math.max(0, originalDistanceKm - optimizedDistanceKm),
    methodLabel: [
      stops.length <= EXACT_ROUTE_LIMIT ? '完整搜尋(起點鎖定)' : '最近鄰 + 2-opt(起點鎖定)',
      hasOverlappingCoordinates ? '重疊點展開' : ''
    ].filter(Boolean).join(' / '),
    hasOverlappingCoordinates,
    overlappingStopCount
  };
};

export default function RouteAnalysis({ items, onUpdateItemCoords }: RouteAnalysisProps) {

  const uniqueDates = useMemo(
    () => Array.from(new Set(items.map((item) => item.deliveryDate))).filter(Boolean).sort((a, b) => b.localeCompare(a)),
    [items]
  );
  const [selectedDate, setSelectedDate] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [geocodeMessage, setGeocodeMessage] = useState('');

  const activeDate = selectedDate && uniqueDates.includes(selectedDate)
    ? selectedDate
    : uniqueDates[0] || new Date().toISOString().split('T')[0];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const filteredItems = useMemo(
    () => items.filter((item) => item.deliveryDate === activeDate).sort((a, b) => a.seq - b.seq),
    [activeDate, items]
  );

  const coordinateStops = useMemo(() => filteredItems.filter(isCoordinateStop), [filteredItems]);
  const missingCoordinateCount = filteredItems.length - coordinateStops.length;
  const reliableCoordinateCount = coordinateStops.filter(hasReliableCoordinate).length;
  const unreliableCoordinateCount = coordinateStops.length - reliableCoordinateCount;
  
  const routePlan = useMemo(() => buildRoutePlan(coordinateStops), [coordinateStops]);
  
  const overlappingStopCount = routePlan?.overlappingStopCount || 0;
  const hasNoItems = filteredItems.length === 0;
  const hasNoCoordinates = filteredItems.length > 0 && coordinateStops.length === 0;
  const hasCoordinateWarning = (missingCoordinateCount > 0 || unreliableCoordinateCount > 0 || overlappingStopCount > 0) && !hasNoItems;

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.6978, 120.9605],
      zoom: 7,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = L.featureGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!routePlan || routePlan.orderedStops.length === 0) {
      mapInstanceRef.current.setView([23.6978, 120.9605], 7);
      return;
    }

    const routeCoordinates: L.LatLngExpression[] = routePlan.orderedStops.map((stop) => [
      stop.displayLatitude,
      stop.displayLongitude
    ]);

    routePlan.orderedStops.forEach((stop) => {
      const isReliableStop = hasReliableCoordinate(stop);
      const markerIcon = L.divIcon({
        className: '',
        html: `<div class="custom-map-marker" style="
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: ${isReliableStop ? 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))' : 'linear-gradient(135deg, var(--accent-amber), #f97316)'};
          color: #07110f;
          border: 2px solid #ffffff;
          box-shadow: ${isReliableStop ? '0 0 12px rgba(16, 185, 129, 0.65)' : '0 0 12px rgba(245, 158, 11, 0.68)'};
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 11px;
          font-family: var(--font-title);
        ">${stop.optimizedSeq}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });

      const popupContent = `
        <div style="font-family: var(--font-sans); padding: 4px; min-width: 210px;">
          <h4 style="margin: 0 0 6px 0; color: #34d399; font-family: var(--font-title); font-size: 14px;">
            最短路線第 ${stop.optimizedSeq} 站
          </h4>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;"><strong>原站次:</strong> ${stop.seq}</div>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;"><strong>收件人:</strong> ${stop.recipient}</div>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;"><strong>地址:</strong> ${stop.address}</div>
          <div style="font-size: 12px; color: #a7f3d0;"><strong>前一站距離:</strong> ${stop.optimizedSeq === 1 ? '起點' : formatDistance(stop.displayDistanceFromPreviousKm)}</div>
          ${!isReliableStop ? '<div style="font-size: 11px; color: #fbbf24; margin-top: 4px;">此站目前使用臨時座標，建議重新定位。</div>' : ''}
          ${stop.hasOverlappingCoordinate ? '<div style="font-size: 11px; color: #fbbf24; margin-top: 4px;">此地址與其他站點座標重疊，已在地圖上展開顯示。</div>' : ''}
        </div>
      `;

      L.marker([stop.displayLatitude, stop.displayLongitude], { icon: markerIcon })
        .bindPopup(popupContent)
        .addTo(markersLayerRef.current!);
    });

    if (routeCoordinates.length > 1) {
      polylineRef.current = L.polyline(routeCoordinates, {
        color: '#34d399',
        weight: 4,
        opacity: 0.9
      }).addTo(mapInstanceRef.current);
    }

    const bounds = L.latLngBounds(routeCoordinates);
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [42, 42],
      maxZoom: 15
    });
  }, [routePlan]);

  const handleGeocodeItems = async (targetItems: DeliveryItem[], successMessage: string) => {
    if (targetItems.length === 0) return;

    setIsGeocoding(true);
    setGeocodeProgress(0);
    setGeocodeMessage('');

    try {
      const addresses = targetItems.map((item) => item.address);
      const results = await batchGeocode(addresses);

      targetItems.forEach((item) => {
        const coords = results[item.address];
        if (coords) {
          onUpdateItemCoords(item.id, coords.latitude, coords.longitude, coords.error);
        }
      });

      setGeocodeMessage(successMessage);
    } catch {
      setGeocodeMessage('座標定位失敗，請稍後再試。');
    } finally {
      setIsGeocoding(false);
      setGeocodeProgress(0);
    }
  };

  const handleGeocodeMissing = () => {
    void handleGeocodeItems(
      filteredItems.filter((item) => !isCoordinateStop(item)),
      '座標定位完成，已重新計算最短距離路線。'
    );
  };

  const handleFixUnreliableCoordinates = () => {
    void handleGeocodeItems(
      filteredItems.filter((item) => !hasReliableCoordinate(item)),
      '座標修正完成，已重新計算最短距離路線。'
    );
  };

  const handleRegeocodeAll = () => {
    void handleGeocodeItems(filteredItems, '已重新定位全部站點，並重新計算最短距離路線。');
  };

  const routeChunks = useMemo(() => {
    if (!routePlan) return [];
    const chunks: OrderedStop[][] = [];
    for (let index = 0; index < routePlan.orderedStops.length; index += 10) {
      chunks.push(routePlan.orderedStops.slice(index, index + 10));
    }
    return chunks;
  }, [routePlan]);

  const launchGoogleMapsChunk = (chunkStops: OrderedStop[]) => {
    if (chunkStops.length === 0) return;

    const routeAddresses = chunkStops.map((stop) => encodeURIComponent(stop.address));
    const mapBase = 'https:' + '//' + 'www.google.com' + '/maps';
    const url = routeAddresses.length === 1
      ? `${mapBase}/search/?api=1&query=${routeAddresses[0]}`
      : `${mapBase}/dir/${routeAddresses.join('/')}`;

    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      window.location.assign(url);
      return;
    }

    window.open(url, '_blank');
  };

  const copyOptimizedRoute = async () => {
    if (!routePlan) return;

    const text = [
      '最佳路徑分析',
      `日期: ${activeDate}`,
      `總站點: ${routePlan.orderedStops.length}`,
      `最短距離: ${formatDistance(routePlan.optimizedDistanceKm)}`,
      '',
      ...routePlan.orderedStops.map((stop) => (
        `${stop.optimizedSeq}. ${stop.recipient}｜原第 ${stop.seq} 站｜${stop.address}` +
        `${stop.optimizedSeq === 1 ? '｜起點' : `｜前一站距離 ${formatDistance(stop.displayDistanceFromPreviousKm)}`}` +
        `${hasReliableCoordinate(stop) ? '' : '｜座標待確認'}` +
        `${stop.hasOverlappingCoordinate ? '｜座標重疊已展開' : ''}`
      ))
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('最佳路線順序已複製到剪貼板。');
    } catch {
      alert('複製失敗，請重試。');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
        {uniqueDates.map((date) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: activeDate === date ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-tertiary)',
              color: activeDate === date ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: activeDate === date ? 'rgba(16, 185, 129, 0.45)' : 'var(--card-border)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'var(--transition-smooth)'
            }}
          >
            {date} 最短路線 ({items.filter((item) => item.deliveryDate === date).length} 站)
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}
      >
        {[
          ['最短總距離', routePlan ? formatDistance(routePlan.optimizedDistanceKm) : '--'],
          ['原始路線距離', routePlan ? formatDistance(routePlan.originalDistanceKm) : '--'],
          ['節省距離', routePlan ? formatDistance(routePlan.savedDistanceKm) : '--'],
          ['有效定位站點', `${reliableCoordinateCount}/${filteredItems.length}`]
        ].map(([label, value]) => (
          <div
            key={label}
            className="glass-panel"
            style={{
              padding: '14px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(15, 22, 42, 0.68), rgba(15, 22, 42, 0.86))'
            }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>{label}</div>
            <div style={{ color: '#ffffff', fontSize: '22px', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-title)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {hasCoordinateWarning && (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <AlertTriangle size={18} color="var(--accent-amber)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {[
                missingCoordinateCount > 0 ? `${missingCoordinateCount} 筆地址缺少有效地圖座標` : '',
                unreliableCoordinateCount > 0 ? `${unreliableCoordinateCount} 筆地址使用臨時座標，已先展開顯示` : '',
                overlappingStopCount > 0 ? `${overlappingStopCount} 筆地址座標重疊，已在地圖上展開顯示` : ''
              ].filter(Boolean).join('；')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {missingCoordinateCount > 0 && (
              <button
                className="btn btn-secondary"
                onClick={handleGeocodeMissing}
                disabled={isGeocoding}
                style={{ whiteSpace: 'nowrap', borderRadius: '8px', padding: '9px 12px' }}
              >
                {isGeocoding ? <RefreshCw size={15} style={{ animation: 'spin 1.5s infinite linear' }} /> : <MapIcon size={15} />}
                {isGeocoding ? `定位中 ${geocodeProgress}%` : '取得缺漏座標'}
              </button>
            )}
            {unreliableCoordinateCount > 0 && (
              <button
                className="btn btn-secondary"
                onClick={handleFixUnreliableCoordinates}
                disabled={isGeocoding}
                style={{ whiteSpace: 'nowrap', borderRadius: '8px', padding: '9px 12px' }}
              >
                {isGeocoding ? <RefreshCw size={15} style={{ animation: 'spin 1.5s infinite linear' }} /> : <MapIcon size={15} />}
                修正臨時座標
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleRegeocodeAll}
              disabled={isGeocoding}
              style={{ whiteSpace: 'nowrap', borderRadius: '8px', padding: '9px 12px' }}
            >
              {isGeocoding ? <RefreshCw size={15} style={{ animation: 'spin 1.5s infinite linear' }} /> : <RefreshCw size={15} />}
              重新定位全部站點
            </button>
          </div>
        </div>
      )}

      {geocodeMessage && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{geocodeMessage}</div>
      )}

      <div className="analysis-layout">
        <div className="analysis-map-panel">
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.42)',
              zIndex: 1
            }}
          />
          {isGeocoding && (
            <div className="analysis-map-overlay">
              <RefreshCw size={26} style={{ animation: 'spin 1.5s infinite linear', color: 'var(--accent-cyan)' }} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700 }}>正在定位配送站點</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>解析進度: {geocodeProgress}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel analysis-list-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                SHORTEST ROUTE
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={18} color="var(--accent-emerald)" />
                最短距離路線順序
              </h3>
            </div>
            <span
              style={{
                color: 'var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.22)',
                borderRadius: '999px',
                padding: '5px 9px',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              {routePlan?.methodLabel || '等待座標'}
            </span>
          </div>

          {routePlan && routePlan.orderedStops.length > 0 ? (
            <>
              <div className="analysis-route-scroll">
                {routePlan.orderedStops.map((stop, index) => (
                  <div
                    key={stop.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px'
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.16)',
                        color: 'var(--accent-emerald)',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '11px'
                      }}
                    >
                      {stop.optimizedSeq}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <strong style={{ color: '#ffffff', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stop.recipient} ({stop.channel})
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          原第 {stop.seq} 站
                        </span>
                      </div>
                      <a
                        href={'https:' + '//' + 'www.google.com' + '/maps/search/?api=1&query=' + encodeURIComponent(stop.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          color: 'var(--text-secondary)',
                          fontSize: '11px',
                          lineHeight: 1.5,
                          marginTop: '4px',
                          textDecoration: 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {stop.address}
                      </a>
                      <div style={{ color: 'var(--accent-cyan)', fontSize: '11px', marginTop: '4px', fontWeight: 700 }}>
                        {stop.optimizedSeq === 1 ? '起點' : `距前一站 ${formatDistance(stop.displayDistanceFromPreviousKm)}`}
                        {!hasReliableCoordinate(stop) && (
                          <span style={{ color: 'var(--accent-amber)', marginLeft: '6px' }}>座標待確認</span>
                        )}
                        {stop.hasOverlappingCoordinate && (
                          <span style={{ color: 'var(--accent-amber)', marginLeft: '6px' }}>座標展開</span>
                        )}
                      </div>
                    </div>

                    {index < routePlan.orderedStops.length - 1 && (
                      <ChevronRight size={14} color="var(--text-muted)" style={{ alignSelf: 'center', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--card-border)', paddingTop: '14px' }}>
                {routeChunks.map((chunk) => (
                  <button
                    key={`${chunk[0].id}-${chunk[chunk.length - 1].id}`}
                    className="btn btn-primary"
                    onClick={() => launchGoogleMapsChunk(chunk)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '13px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}
                  >
                    <MapIcon size={16} />
                    {routeChunks.length > 1
                      ? `開啟第 ${chunk[0].optimizedSeq} ~ ${chunk[chunk.length - 1].optimizedSeq} 站`
                      : '用最佳順序開啟 Google Maps'}
                    <ExternalLink size={14} />
                  </button>
                ))}
                <button
                  className="btn btn-secondary"
                  onClick={copyOptimizedRoute}
                  style={{ width: '100%', padding: '11px', fontSize: '13px', borderRadius: '10px', fontWeight: 700 }}
                >
                  <Navigation size={15} />
                  複製最短路線順序
                </button>
              </div>
            </>
          ) : (
            <div className="analysis-empty-state">
              <AlertTriangle size={26} style={{ opacity: 0.55 }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {hasNoItems
                  ? '該日期尚無配送行程，請先新增地址。'
                  : hasNoCoordinates
                    ? '此日期尚無可分析的地圖座標，請先取得座標。'
                    : '等待路徑資料。'}
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .analysis-layout {
          display: grid;
          grid-template-columns: minmax(360px, 1.45fr) minmax(330px, 0.9fr);
          gap: 24px;
          min-height: 520px;
          height: calc(100vh - 320px);
        }
        .analysis-map-panel {
          position: relative;
          height: 100%;
          min-height: 360px;
        }
        .analysis-map-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          background: rgba(7, 10, 19, 0.78);
          backdrop-filter: blur(4px);
          border-radius: 16px;
          z-index: 5;
        }
        .analysis-list-panel {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          height: 100%;
          min-height: 360px;
          overflow: hidden;
        }
        .analysis-route-scroll {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
        }
        .analysis-empty-state {
          flex: 1;
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-align: center;
        }
        @media (max-width: 900px) {
          .analysis-layout {
            grid-template-columns: 1fr;
            height: auto;
            min-height: auto;
            padding-bottom: 90px;
          }
          .analysis-map-panel {
            height: 46vh;
            min-height: 320px;
          }
          .analysis-list-panel {
            height: auto;
            min-height: auto;
            overflow: visible;
          }
          .analysis-route-scroll {
            max-height: none;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
}