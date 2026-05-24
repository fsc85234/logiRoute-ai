import { useEffect, useRef, useState } from 'react';
import { 
  Navigation, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  Info,
  Map as MapIcon,
  AlertTriangle
} from 'lucide-react';
import type { DeliveryItem, SystemSettings } from '../types';
import { batchGeocode } from '../utils/geocoder';
import L from 'leaflet';

interface RoutePlannerProps {
  items: DeliveryItem[];
  settings: SystemSettings;
  onUpdateItemCoords: (id: string, lat: number, lng: number, error?: boolean) => void;
}

export default function RoutePlanner({ items, settings, onUpdateItemCoords }: RoutePlannerProps) {
  const uniqueDates = Array.from(new Set(items.map(item => item.deliveryDate))).filter(Boolean).sort();
  const [selectedDate, setSelectedDate] = useState<string>(uniqueDates[0] || new Date().toISOString().split('T')[0]);
  
  // Geocoding progress states
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);

  // Map DOM Element Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Get ordered items for the selected date
  const filteredItems = items
    .filter(item => item.deliveryDate === selectedDate)
    .sort((a, b) => a.seq - b.seq);

  // 1. Batch Geocode addresses that do not have coordinates
  const triggerGeocoding = async () => {
    const unlisted = filteredItems.filter(item => !item.latitude || !item.longitude);
    if (unlisted.length === 0) return;

    setIsGeocoding(true);
    setGeocodeProgress(0);

    try {
      const addressesToGeocode = unlisted.map(item => item.address);
      const results = await batchGeocode(
        addressesToGeocode, 
        settings.defaultRegion,
        (progress) => setGeocodeProgress(progress)
      );

      // Save geocode results back to parent state
      unlisted.forEach(item => {
        const coords = results[item.address];
        if (coords) {
          onUpdateItemCoords(item.id, coords.latitude, coords.longitude, coords.error);
        }
      });
    } catch (err) {
      console.error('Batch Geocoding failed:', err);
    } finally {
      setIsGeocoding(false);
      setGeocodeProgress(0);
    }
  };

  // 2. Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Create map instance if it doesn't exist
    if (!mapInstanceRef.current) {
      // Default center is Taiwan
      const map = L.map(mapContainerRef.current, {
        center: [23.6978, 120.9605],
        zoom: 7,
        zoomControl: true,
        attributionControl: false,
      });

      // Add dark tile layer (we apply dark mode CSS filter in index.css)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Create feature layers
      const markersLayer = L.featureGroup().addTo(map);
      
      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    // Clean up map instance on unmount to prevent leaks and double init errors
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  // 3. Process geocoding and draw markers whenever selectedDate or filteredItems change
  useEffect(() => {
    // Check if there are any un-geocoded addresses
    const hasUngeocoded = filteredItems.some(item => !item.latitude || !item.longitude);
    if (hasUngeocoded && !isGeocoding) {
      triggerGeocoding();
      return;
    }

    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    // Clear previous elements
    markersLayerRef.current.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const validCoordinates: L.LatLngExpression[] = [];

    // Plot markers
    filteredItems.forEach((item) => {
      if (!item.latitude || !item.longitude) return;

      const latLng: L.LatLngExpression = [item.latitude, item.longitude];
      validCoordinates.push(latLng);

      // Determine sequence marker style
      const customIcon = L.divIcon({
        className: '', // Clear default styling
        html: `<div class="custom-map-marker" style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${item.status === 'completed' ? '#10b981' : 'var(--accent-cyan)'}, var(--accent-indigo));
          color: white;
          border: 2px solid #ffffff;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 11px;
          font-family: var(--font-title);
        ">${item.seq}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      // Bind detailed delivery information popup
      const popupContent = `
        <div style="font-family: var(--font-sans); padding: 4px; min-width: 200px;">
          <h4 style="margin: 0 0 6px 0; color: var(--accent-cyan); font-family: var(--font-title); font-size: 14px;">
            第 ${item.seq} 站: ${item.channel} ${item.orderId !== 'N/A' ? `(${item.orderId})` : ''}
          </h4>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;">
            <strong>地址:</strong> ${item.address}
          </div>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;">
            <strong>收件人:</strong> ${item.recipient} ${item.phone !== 'N/A' ? `(${item.phone})` : ''}
          </div>
          <div style="font-size: 12px; color: #e2e8f0; margin-bottom: 4px;">
            <strong>品名:</strong> ${item.items}
          </div>
          <div style="font-size: 12px; color: #a78bfa; margin-bottom: 4px;">
            <strong>時段:</strong> ${item.deliveryTime} | <strong>服務:</strong> ${item.serviceType}
          </div>
          ${item.remarks !== 'N/A' ? `<div style="font-size: 11px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px; font-style: italic;">備註: ${item.remarks}</div>` : ''}
        </div>
      `;

      L.marker(latLng, { icon: customIcon })
        .bindPopup(popupContent)
        .addTo(markersLayerRef.current!);
    });

    // Draw route path line (Polyline)
    if (validCoordinates.length > 1) {
      const polyline = L.polyline(validCoordinates, {
        color: 'var(--accent-cyan)',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 6', // Dotted highway path
      }).addTo(mapInstanceRef.current);

      polylineRef.current = polyline;
    }

    // Zoom fit the map to cover all active markers
    if (validCoordinates.length > 0) {
      const bounds = L.latLngBounds(validCoordinates);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else {
      // Default reset view back to center of Taiwan
      mapInstanceRef.current.setView([23.6978, 120.9605], 7);
    }
  }, [selectedDate, items, isGeocoding]);

  // 4. Generate Multi-Stop Google Maps Route URL
  const getGoogleMapsRouteUrl = () => {
    if (filteredItems.length === 0) return '';
    
    // Address coordinates or direct text addresses mapping
    const routeAddresses = filteredItems.map(item => encodeURIComponent(item.address));
    
    if (routeAddresses.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${routeAddresses[0]}`;
    }

    return `https://www.google.com/maps/dir/${routeAddresses.join('/')}`;
  };

  const launchGoogleMaps = () => {
    const url = getGoogleMapsRouteUrl();
    if (url) {
      // Use window.location.href for better mobile compatibility
      // This works reliably on both desktop and mobile browsers
      window.location.href = url;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Date selector bar */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
        {uniqueDates.map(date => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: selectedDate === date ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-tertiary)',
              color: selectedDate === date ? 'var(--accent-violet)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: selectedDate === date ? 'var(--accent-violet)' : 'var(--card-border)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'var(--transition-smooth)'
            }}
          >
            🗺️ {date} 排程地圖 ({items.filter(x => x.deliveryDate === date).length} 站)
          </button>
        ))}
        {uniqueDates.length === 0 && (
          <div style={{ padding: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            目前尚無定位地址。請先辨識導入或新增數據。
          </div>
        )}
      </div>

      {/* Main planner panels - Responsive Grid */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px', 
          height: 'calc(100vh - 260px)', 
          minHeight: '450px'
        }}
      >
        
        {/* Map Panel */}
        <div style={{ position: 'relative', height: '100%', minHeight: '300px' }}>
          <div 
            ref={mapContainerRef} 
            style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: '16px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.47)',
              zIndex: 1
            }}
          />

          {/* Map loading and Geocoding overlay */}
          {isGeocoding && (
            <div 
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(7, 10, 19, 0.8)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                zIndex: 5,
                borderRadius: '16px'
              }}
            >
              <RefreshCw size={24} className="shimmer-bg" style={{ animation: 'spin 1.5s infinite linear', color: 'var(--accent-cyan)' }} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700' }}>正在獲取配送站點 GPS 座標</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  調用 OSM Nominatim 安全解析地址座標中: {geocodeProgress}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Planner Panel */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            height: '100%',
            overflowY: 'auto',
            minHeight: '350px'
          }}
        >
          {/* Exporter Dashboard */}
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>
              ROUTE NAVIGATOR
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="var(--accent-cyan)" />
              多站導航路徑規劃
            </h3>
          </div>

          {filteredItems.length > 0 ? (
            <>
              {/* Route stop list summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '280px', paddingRight: '4px' }}>
                {filteredItems.map((item, idx) => (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  >
                    <div 
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: item.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
                        color: item.status === 'completed' ? '#10b981' : 'var(--accent-cyan)',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '10px'
                      }}
                    >
                      {item.seq}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.recipient} ({item.channel})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.address}
                      </div>
                    </div>
                    
                    {idx < filteredItems.length - 1 && (
                      <ChevronRight size={14} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Big Action button to launch google maps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                <button 
                  className="btn btn-primary"
                  onClick={launchGoogleMaps}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '10px',
                    transition: 'var(--transition-smooth)',
                    fontWeight: '600'
                  }}
                  onMouseDown={(e) => {
                    // Add press feedback
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                  onTouchStart={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
                  }}
                  onTouchEnd={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  <MapIcon size={16} />
                  一鍵生成 Google Maps 路線
                  <ExternalLink size={14} />
                </button>
                
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px', lineHeight: 1.3 }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>
                    一鍵點擊會將上述所有站點以<strong>最優配送順序</strong>打包載入 Google Maps，提供給司機開啟行動導航或檢視多點配送最佳線路。
                  </span>
                </span>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <AlertTriangle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <span style={{ fontSize: '13px' }}>該日期尚無配送行程，請先切換至「地址庫」管理或新增。</span>
            </div>
          )}

        </div>

      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Mobile responsiveness for map/sidebar layout */
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: auto !important;
          }

          div[style*="height: calc(100vh"] {
            height: auto !important;
            min-height: 300px;
          }
        }
      `}</style>
    </div>
  );
}
