import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Navigation, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
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

export default function RoutePlanner({ items, onUpdateItemCoords }: RoutePlannerProps) {
  // 🔄 改為降冪排序 (由新到舊)，讓最新辨識的日期永遠排在第一個
  const uniqueDates = useMemo(
    () => Array.from(new Set(items.map(item => item.deliveryDate)))
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a)),
    [items]
  );
  const [selectedDate, setSelectedDate] = useState<string>(uniqueDates[0] || new Date().toISOString().split('T')[0]);
  
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.FeatureGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const filteredItems = useMemo(
    () => items
      .filter(item => item.deliveryDate === selectedDate)
      .sort((a, b) => a.seq - b.seq),
    [items, selectedDate]
  );

  const triggerGeocoding = useCallback(async () => {
    const unlisted = filteredItems.filter(item => !item.latitude || !item.longitude);
    if (unlisted.length === 0) return;

    setIsGeocoding(true);
    setGeocodeProgress(0);

    try {
      const addressesToGeocode = unlisted.map(item => item.address);
      const results = await batchGeocode(addressesToGeocode);

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
  }, [filteredItems, onUpdateItemCoords]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.6978, 120.9605],
        zoom: 7,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.featureGroup().addTo(map);
      
      mapInstanceRef.current = map;
      markersLayerRef.current = markersLayer;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const hasUngeocoded = filteredItems.some(item => !item.latitude || !item.longitude);
    if (hasUngeocoded && !isGeocoding) {
      const timeoutId = window.setTimeout(() => {
        void triggerGeocoding();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    const validCoordinates: L.LatLngExpression[] = [];

    filteredItems.forEach((item) => {
      if (!item.latitude || !item.longitude) return;

      const latLng: L.LatLngExpression = [item.latitude, item.longitude];
      validCoordinates.push(latLng);

      const customIcon = L.divIcon({
        className: '', 
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

    if (validCoordinates.length > 1) {
      const polyline = L.polyline(validCoordinates, {
        color: 'var(--accent-cyan)',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 6',
      }).addTo(mapInstanceRef.current);
      polylineRef.current = polyline;
    }

    if (validCoordinates.length > 0) {
      const bounds = L.latLngBounds(validCoordinates);
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else {
      mapInstanceRef.current.setView([23.6978, 120.9605], 7);
    }
  }, [filteredItems, isGeocoding, triggerGeocoding]);

 // 🚚 4. 智慧分段導航：將所有站點自動切成「每 10 站一組」的陣列
  const getRouteChunks = () => {
    const chunks = [];
    for (let i = 0; i < filteredItems.length; i += 10) {
      chunks.push(filteredItems.slice(i, i + 10));
    }
    return chunks;
  };

  // 🚀 執行特定區塊的跳轉
  const launchGoogleMapsChunk = (chunkItems: DeliveryItem[]) => {
    if (chunkItems.length === 0) return;
    
    const routeAddresses = chunkItems.map(item => encodeURIComponent(item.address));
    const mapBase = "https:" + "//" + "www.google.com" + "/maps";
    
    const url = routeAddresses.length === 1
      ? mapBase + "/search/?api=1&query=" + routeAddresses[0]
      : mapBase + "/dir/" + routeAddresses.join('/');

    // 📱 雙裝置智慧偵測
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.assign(url); // 手機：直接喚醒 APP
    } else {
      window.open(url, '_blank'); // 電腦：開新分頁防覆蓋
    }
  };

  const exportRouteListAsCSV = () => {
    if (filteredItems.length === 0) return;
    const headers = ['站次', '收件人', '頻道', '訂單號', '地址', '電話', '品名', '時段', '服務類型', '備註'];
    const csvContent = [
      headers.join(','),
      ...filteredItems.map(item => [
        item.seq,
        `"${item.recipient}"`,
        item.channel,
        item.orderId,
        `"${item.address}"`,
        item.phone,
        `"${item.items}"`,
        item.deliveryTime,
        item.serviceType,
        `"${item.remarks}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `物流配送清單_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyRouteListToClipboard = async () => {
    if (filteredItems.length === 0) return;
    const textContent = [
      `=== 物流配送清單 ===`,
      `日期: ${selectedDate}`,
      `共 ${filteredItems.length} 個站點`,
      ``,
      ...filteredItems.map(item => 
        `第 ${item.seq} 站: ${item.recipient}\n` +
        `├─ 地址: ${item.address}\n` +
        `├─ 頻道: ${item.channel} (${item.orderId})\n` +
        `├─ 電話: ${item.phone}\n` +
        `├─ 品名: ${item.items}\n` +
        `├─ 時段: ${item.deliveryTime}\n` +
        `├─ 服務: ${item.serviceType}\n` +
        `└─ 備註: ${item.remarks}\n`
      ).join('\n')
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textContent);
      alert('清單已複製到剪貼板！');
    } catch {
      alert('複製失敗，請重試');
    }
  };

  const generateKMLAndDownload = () => {
    const itemsWithCoords = filteredItems.filter(item => item.latitude && item.longitude);
    if (itemsWithCoords.length === 0) {
      alert('❌ 配送點清單中沒有有效的 GPS 座標。');
      return;
    }
    const dateShort = selectedDate.slice(-5).replace('-', '');
    const placemarks = itemsWithCoords.map((item) => {
        return `
      <Placemark>
        <name>第 ${item.seq} 站: ${item.recipient}</name>
        <description><![CDATA[<b>地址：</b>${item.address}]]></description>
        <Point><coordinates>${item.longitude},${item.latitude},0</coordinates></Point>
      </Placemark>`;
      }).join('\n');

    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>物流配送清單_${dateShort}</name>
    <Folder>
      <name>🚚 配送路線</name>
${placemarks}
    </Folder>
  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `配送清單_${dateShort}.kml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
      </div>

      <div className="planner-container">
        <div className="map-container">
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
          {isGeocoding && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(7, 10, 19, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: 5, borderRadius: '16px' }}>
              <RefreshCw size={24} style={{ animation: 'spin 1.5s infinite linear', color: 'var(--accent-cyan)' }} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700' }}>正在獲取配送站點 GPS 座標</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>解析進度: {geocodeProgress}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel list-container">
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>ROUTE NAVIGATOR</span>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="var(--accent-cyan)" />
              多站導航路徑規劃
            </h3>
          </div>

          {filteredItems.length > 0 ? (
            <>
              <div className="route-list-scroll">
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
                    <div style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: item.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(6,182,212,0.15)',
                        color: item.status === 'completed' ? '#10b981' : 'var(--accent-cyan)',
                        fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: '10px'
                      }}
                    >
                      {item.seq}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.recipient} ({item.channel})
                      </div>
                      
                      <a 
                        href={"https:" + "//" + "www.google.com" + "/maps/search/?api=1&query=" + encodeURIComponent(item.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          color: 'var(--text-secondary)', marginTop: '4px', fontSize: '11px', 
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: 'block', textDecoration: 'none', transition: 'color 0.2s ease', cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-cyan)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.textDecoration = 'none'; }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📍 {item.address}
                      </a>

                      {item.phone && item.phone !== 'N/A' && item.phone.trim() !== '' && (
                        <a 
                          href={`tel:${item.phone.replace(/[\s-]/g, '')}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            color: 'var(--accent-emerald)', marginTop: '4px', fontSize: '11px',
                            textDecoration: 'none', padding: '2px 6px',
                            background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px',
                            transition: 'all 0.2s ease', fontWeight: '600'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                          onClick={(e) => e.stopPropagation()}
                        >
                          📞 撥打: {item.phone}
                        </a>
                      )}
                    </div>
                    
                    {idx < filteredItems.length - 1 && (
                      <ChevronRight size={14} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getRouteChunks().map((chunk, index) => {
                    const startSeq = chunk[0].seq;
                    const endSeq = chunk[chunk.length - 1].seq;
                    const isMulti = getRouteChunks().length > 1;
                    
                    return (
                      <button 
                        key={index}
                        className="btn btn-primary"
                        onClick={() => launchGoogleMapsChunk(chunk)}
                        style={{ 
                          width: '100%', padding: '12px', fontSize: '14px', 
                          background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                          border: 'none', cursor: 'pointer', borderRadius: '10px', fontWeight: '600',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                      >
                        <MapIcon size={16} />
                        {isMulti 
                          ? `📍 導航第 ${startSeq} ~ ${endSeq} 站路線` 
                          : `一鍵生成 Google Maps 路線`}
                        <ExternalLink size={14} />
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={exportRouteListAsCSV} style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-violet)', fontWeight: '600', border: '1px solid var(--card-border)' }}>📥 下載 CSV</button>
                  <button className="btn btn-secondary" onClick={copyRouteListToClipboard} style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', fontWeight: '600', border: '1px solid var(--card-border)' }}>📋 複製清單</button>
                </div>
                <button
                  onClick={generateKMLAndDownload}
                  style={{ width: '100%', padding: '14px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '10px', border: '1.5px solid #39ff14', background: 'rgba(57, 255, 20, 0.08)', color: '#39ff14', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span style={{ fontSize: '16px' }}>🗺️</span>一鍵同步至 Google 地圖個人清單
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <AlertTriangle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <span style={{ fontSize: '13px' }}>該日期尚無配送行程，請先新增。</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .planner-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; height: calc(100vh - 260px); min-height: 450px; }
        .map-container { position: relative; height: 100%; min-height: 300px; }
        .list-container { padding: 20px; display: flex; flex-direction: column; gap: 20px; height: 100%; overflow-y: auto; min-height: 350px; }
        .route-list-scroll { display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; max-height: 280px; padding-right: 4px; }
        @media (max-width: 768px) {
          .planner-container { grid-template-columns: 1fr; height: auto; min-height: auto; padding-bottom: 90px; }
          .map-container { height: 45vh; min-height: 300px; }
          .list-container { height: auto; min-height: auto; overflow: visible; }
          .route-list-scroll { max-height: none; overflow-y: visible; }
        }
      `}</style>
    </div>
  );
}