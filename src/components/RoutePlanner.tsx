import { useEffect, useRef, useState } from 'react';
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
        (progress: number) => setGeocodeProgress(progress)
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

      // Add dark tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Create feature layers
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

  // 3. Process geocoding and draw markers whenever selectedDate or filteredItems change
  useEffect(() => {
    const hasUngeocoded = filteredItems.some(item => !item.latitude || !item.longitude);
    if (hasUngeocoded && !isGeocoding) {
      triggerGeocoding();
      return;
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
  }, [selectedDate, items, isGeocoding]);

  // 4. Generate Multi-Stop Google Maps Route URL
  const getGoogleMapsRouteUrl = () => {
    if (filteredItems.length === 0) return '';
    const routeAddresses = filteredItems.map(item => encodeURIComponent(item.address));
    if (routeAddresses.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${routeAddresses[0]}`;
    }
    return `https://www.google.com/maps/dir/${routeAddresses.join('/')}`;
  };

  const launchGoogleMaps = () => {
    const url = getGoogleMapsRouteUrl();
    if (url) {
      window.location.href = url;
    }
  };

  // 5. Export route list as CSV
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
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `物流配送清單_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6. Copy route list to clipboard
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
    } catch (err) {
      console.error('Copy failed:', err);
      alert('複製失敗，請重試');
    }
  };

  // 7. Generate KML file for Google Maps import
  const generateKMLAndDownload = () => {
    const itemsWithCoords = filteredItems.filter(
      item => item.latitude && item.longitude && 
               typeof item.latitude === 'number' && 
               typeof item.longitude === 'number'
    );

    if (itemsWithCoords.length === 0) {
      alert(
        '❌ 無法導出：\n\n原因：配送點清單中沒有有效的 GPS 座標。\n\n解決步驟：\n1️⃣ 確認已在「地圖」頁面載入配送點\n2️⃣ 系統應自動地理編碼（將地址轉換為坐標）\n3️⃣ 請等待 5-10 秒讓地理編碼完成\n4️⃣ 確認地圖上已顯示所有配送點位置\n5️⃣ 再試一次下載'
      );
      return;
    }

    if (itemsWithCoords.length < filteredItems.length) {
      const missingCount = filteredItems.length - itemsWithCoords.length;
      alert(`⚠️ 部分配送點缺少座標\n\n將導出 ${itemsWithCoords.length}/${filteredItems.length} 個配送點\n（${missingCount} 個地點無法地理編碼，已排除）\n\n請稍候後重試，讓系統完成所有地理編碼。`);
    }

    const dateShort = selectedDate.slice(-5).replace('-', '');

    const placemarks = itemsWithCoords
      .map((item, index) => {
        const lat = parseFloat(String(item.latitude));
        const lng = parseFloat(String(item.longitude));

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return '';
        }

        return `
      <Placemark>
        <name>第 ${item.seq} 站: ${item.recipient} (${item.channel})</name>
        <description><![CDATA[
<b>📍 配送資訊</b><br/>
<b>收件人：</b>${item.recipient}<br/>
<b>地址：</b>${item.address}<br/>
<b>電話：</b>${item.phone}<br/>
<b>品名：</b>${item.items}<br/>
<b>頻道：</b>${item.channel} (${item.orderId})<br/>
<b>時段：</b>${item.deliveryTime}<br/>
<b>服務：</b>${item.serviceType}<br/>
${item.remarks && item.remarks !== 'N/A' ? `<b>備註：</b>${item.remarks}<br/>` : ''}
<b>序號：</b> ${index + 1}/${itemsWithCoords.length}
        ]]></description>
        <Point>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
        <styleUrl>#stopIcon</styleUrl>
      </Placemark>`;
      })
      .filter(pm => pm !== '')
      .join('\n');

    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>物流配送清單_${dateShort} (${itemsWithCoords.length}站)</name>
    <description>LogiRoute AI 配送點清單
日期: ${selectedDate}
共 ${itemsWithCoords.length} 個配送點
由 LogiRoute AI 智能物流系統生成</description>
    
    <Style id="stopIcon">
      <IconStyle>
        <color>ff4285F4</color>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png</href>
        </Icon>
        <hotSpot x="32" y="32" xunits="pixels" yunits="pixels"/>
        <scale>1.2</scale>
      </IconStyle>
      <LabelStyle>
        <color>ff4285F4</color>
        <scale>1.0</scale>
      </LabelStyle>
      <LineStyle>
        <color>ff4285F4</color>
        <width>2</width>
      </LineStyle>
    </Style>

    <Folder>
      <name>🚚 配送路線 (${itemsWithCoords.length} 站)</name>
      <description>LogiRoute AI 自動規劃的最優配送路線</description>
      <visibility>1</visibility>
${placemarks}
    </Folder>

    <Placemark>
      <name>📍 配送路線</name>
      <description>連接所有配送點的最優配送路線</description>
      <LineString>
        <extrude>0</extrude>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
${itemsWithCoords.map(item => `          ${item.longitude},${item.latitude},0`).join('\n')}
        </coordinates>
      </LineString>
      <styleUrl>#lineStyle</styleUrl>
    </Placemark>

    <Style id="lineStyle">
      <LineStyle>
        <color>ff4285F4</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <fill>0</fill>
      </PolyStyle>
    </Style>

  </Document>
</kml>`;

    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `配送清單_${dateShort}.kml`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`✅ 已成功下載 KML 檔案！\n\n📋 檔案名稱: 配送清單_${dateShort}.kml\n📍 包含配送點: ${itemsWithCoords.length} 個\n\n📱 手機用戶（Google Maps App）：\n1️⃣ 打開 Google Maps App\n2️⃣ 點擊【☰ 選單】→ 【您的地點 (Your Places)】\n3️⃣ 點擊【＋ 新建清單 (Create List)】\n4️⃣ 清單名稱: 配送_${dateShort}\n5️⃣ 點擊【⋮ 選項】→ 【導入地點 (Import places)】\n6️⃣ 選擇下載的 KML 檔案\n7️⃣ ✨ 所有配送點將自動加入清單\n\n💻 電腦用戶（Google My Maps）：\n1️⃣ 前往 https://mymaps.google.com\n2️⃣ 點擊【建立新地圖】\n3️⃣ 左側【導入】→ 選擇 KML 檔案\n4️⃣ ✨ 地圖將自動顯示所有配送點`);
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
      <div className="planner-container">
        
        {/* Map Panel */}
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
        <div className="glass-panel list-container">
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
                      {/* 收件人與管道 */}
                      <div style={{ fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.recipient} ({item.channel})
                      </div>
                      
                      {/* 📍 Google Maps 一鍵導航地址 */}
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                          color: 'var(--text-secondary)', 
                          marginTop: '4px', 
                          fontSize: '11px', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          display: 'block',
                          textDecoration: 'none',
                          transition: 'color 0.2s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--accent-cyan)';
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📍 {item.address}
                      </a>

                      {/* 📞 手機一鍵撥打電話按鈕 */}
                      {item.phone && item.phone !== 'N/A' && item.phone.trim() !== '' && (
                        <a 
                          href={`tel:${item.phone.replace(/[\s-]/g, '')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--accent-emerald)',
                            marginTop: '4px',
                            fontSize: '11px',
                            textDecoration: 'none',
                            padding: '2px 6px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                          }}
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

              {/* Big Action button to launch google maps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
                <button 
                  className="btn btn-primary"
                  onClick={launchGoogleMaps}
                  style={{
                    width: '100%', padding: '12px', fontSize: '14px',
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                    boxShadow: '0 4px 14px rgba(14, 165, 233, 0.3)',
                    border: 'none', cursor: 'pointer', borderRadius: '10px',
                    transition: 'var(--transition-smooth)', fontWeight: '600'
                  }}
                >
                  <MapIcon size={16} />
                  一鍵生成 Google Maps 路線
                  <ExternalLink size={14} />
                </button>

                {/* Export buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={exportRouteListAsCSV}
                    style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-violet)', fontWeight: '600', border: '1px solid var(--card-border)', cursor: 'pointer' }}
                  >
                    📥 下載 CSV
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={copyRouteListToClipboard}
                    style={{ flex: 1, padding: '10px', fontSize: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', fontWeight: '600', border: '1px solid var(--card-border)', cursor: 'pointer' }}
                  >
                    📋 複製清單
                  </button>
                </div>

                {/* 🌟 Neon Green Google Maps Sync Button */}
                <button
                  onClick={generateKMLAndDownload}
                  style={{
                    width: '100%', padding: '14px 16px', fontSize: '13px', fontWeight: '700',
                    borderRadius: '10px', border: '1.5px solid #39ff14',
                    background: 'linear-gradient(135deg, rgba(57, 255, 20, 0.08), rgba(57, 255, 20, 0.04))',
                    color: '#39ff14', cursor: 'pointer', backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 20px rgba(57, 255, 20, 0.3), inset 0 0 20px rgba(57, 255, 20, 0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🗺️</span>
                  一鍵同步至 Google 地圖個人清單
                </button>

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(57, 255, 20, 0.05)',
                    border: '1px solid rgba(57, 255, 20, 0.15)',
                    backdropFilter: 'blur(8px)',
                    fontSize: '11px',
                    color: 'rgba(57, 255, 20, 0.8)',
                    lineHeight: 1.4,
                    fontWeight: '500',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start'
                  }}
                >
                  <span style={{ fontSize: '12px', flexShrink: 0 }}>ℹ️</span>
                  <span>
                    點擊後下載 KML 檔案，在 Google Maps 個人中心建立新清單並匯入，配送點將自動寫入。
                    <strong style={{ display: 'block', marginTop: '4px', color: '#39ff14' }}>
                      格式：配送清單_0523.kml
                    </strong>
                  </span>
                </div>
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

        /* 💻 Desktop Default Layout */
        .planner-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 24px;
          height: calc(100vh - 260px);
          min-height: 450px;
        }

        .map-container {
          position: relative;
          height: 100%;
          min-height: 300px;
        }

        .list-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
          overflow-y: auto;
          min-height: 350px;
        }

        .route-list-scroll {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          overflow-y: auto;
          max-height: 280px;
          padding-right: 4px;
        }

        /* 📱 Mobile Responsive Layout */
        @media (max-width: 768px) {
          .planner-container {
            grid-template-columns: 1fr;
            height: auto;
            min-height: auto;
            padding-bottom: 90px;
          }

          .map-container {
            height: 45vh;
            min-height: 300px;
          }

          .list-container {
            height: auto;
            min-height: auto;
            overflow: visible;
          }

          .route-list-scroll {
            max-height: none;
            overflow-y: visible;
          }
        }
      `}</style>
    </div>
  );
}