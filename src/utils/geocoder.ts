export interface GeocodingResult {
  lat: number;
  lng: number;
  success: boolean;
  type: 'exact' | 'fuzzy' | 'default';
}

// 延時函數，確保符合 Nominatim 每秒最多 1 次的嚴格限制
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 台灣地址清洗優化：切除開源地圖看不懂的樓層、之幾、臨等雜訊
 */
function cleanTaiwanAddress(address: string): string {
  let cleaned = address.trim();
  // 移除 括號及其內容 (如平台標記)
  cleaned = cleaned.replace(/\s*[\(\uff08].*?[\)\uff09]/g, '');
  // 移除 室、樓、之几、臨號 等後綴雜訊
  cleaned = cleaned.replace(/(\d+[\s\S]*?[樓室]|[+-\d]+(?:樓|室|F)).*/i, '$1');
  cleaned = cleaned.replace(/(樓|室|F|之\d+號?).*/g, '');
  cleaned = cleaned.replace(/臨\d+號?/g, '');
  return cleaned;
}

/**
 * 地理編碼核心引擎（序列型 Queue 排隊排他機制）
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const defaultCoords = { lat: 25.0478, lng: 121.5170, success: false, type: 'default' as const }; // 台北車站預設防呆
  
  if (!address) return defaultCoords;
  
  // 1. 執行台灣地址深度清洗
  const cleanedAddress = cleanTaiwanAddress(address);
  
  try {
    // 嚴格排隊防護：每次請求強制等待 1200ms，防止被 OpenStreetMap 封鎖 IP
    await delay(1200);

    // 強迫限制台灣區域 countrycodes=tw 以提高精確度
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanedAddress)}&countrycodes=tw&limit=1`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' }
    });
    
    if (!response.ok) throw new Error('Network response error');
    
    const data = await response.json();
    
    // 2. 精確定位成功
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        success: true,
        type: 'exact'
      };
    }
    
    // 3. 精確定位失敗，自動啟動【多級模糊備份方案】（退回到路段/行政區）
    // 嘗試擷取到「號」之前的路名（例如：台北市大同區承德路三段）
    const roadMatch = address.match(/(.*?[路街街首段])\d+號?/);
    if (roadMatch && roadMatch[1]) {
      await delay(1200); // 模糊查詢同樣要排隊
      const fuzzyUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(roadMatch[1])}&countrycodes=tw&limit=1`;
      const fuzzyResp = await fetch(fuzzyUrl, { headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' } });
      
      if (fuzzyResp.ok) {
        const fuzzyData = await fuzzyResp.json();
        if (fuzzyData && fuzzyData.length > 0) {
          return {
            lat: parseFloat(fuzzyData[0].lat),
            lng: parseFloat(fuzzyData[0].lon),
            success: true,
            type: 'fuzzy'
          };
        }
      }
    }
    
    return defaultCoords;
  } catch (error) {
    console.error('Geocoding 發生錯誤:', error);
    return defaultCoords;
  }
}