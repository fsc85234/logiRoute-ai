export interface GeocodingResult {
  latitude: number;   // 配合 RoutePlanner 改回原名
  longitude: number;  // 配合 RoutePlanner 改回原名
  success: boolean;
  error?: boolean;    // 配合 RoutePlanner 補上對應欄位
  type: 'exact' | 'fuzzy' | 'default';
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function cleanTaiwanAddress(address: string): string {
  let cleaned = address.trim();
  cleaned = cleaned.replace(/\s*[\(\uff08].*?[\)\uff09]/g, '');
  cleaned = cleaned.replace(/(\d+[\s\S]*?[樓室]|[+-\d]+(?:樓|室|F)).*/i, '$1');
  cleaned = cleaned.replace(/(樓|室|F|之\d+號?).*/g, '');
  cleaned = cleaned.replace(/臨\d+號?/g, '');
  return cleaned;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  // 預設台北車站防呆座標
  const defaultCoords: GeocodingResult = { latitude: 25.0478, longitude: 121.5170, success: false, error: true, type: 'default' };
  if (!address) return defaultCoords;
  
  const cleanedAddress = cleanTaiwanAddress(address);
  
  try {
    await delay(1200); // 嚴格間隔防止被鎖 IP
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanedAddress)}&countrycodes=tw&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' } });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          success: true,
          error: false,
          type: 'exact'
        };
      }
    }
    
    // 模糊備份機制
    const roadMatch = address.match(/(.*?[路街街首段])\d+號?/);
    if (roadMatch && roadMatch[1]) {
      await delay(1200);
      const fuzzyUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(roadMatch[1])}&countrycodes=tw&limit=1`;
      const fuzzyResp = await fetch(fuzzyUrl, { headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' } });
      if (fuzzyResp.ok) {
        const fuzzyData = await fuzzyResp.json();
        if (fuzzyData && fuzzyData.length > 0) {
          return {
            latitude: parseFloat(fuzzyData[0].lat),
            longitude: parseFloat(fuzzyData[0].lon),
            success: true,
            error: false,
            type: 'fuzzy'
          };
        }
      }
    }
    return defaultCoords;
  } catch (error) {
    return defaultCoords;
  }
}

/**
 * 🛠️ 終極防錯多載批次查詢：
 * 容許傳入 3 個參數，完美消化 (addresses, defaultRegion, progressCallback)
 */
export async function batchGeocode(
  addresses: string[],
  arg2: any, // 自動包容 settings.defaultRegion 參數
  arg3?: (progress: number) => void
): Promise<Record<string, GeocodingResult>> {
  
  // 自動判定第三個參數或第二個參數誰才是進度 Callback
  const onProgress = typeof arg2 === 'function' ? arg2 : arg3;
  const dictionary: Record<string, GeocodingResult> = {};
  
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    if (!dictionary[addr]) {
      dictionary[addr] = await geocodeAddress(addr);
    }
    
    if (onProgress) {
      const percent = Math.round(((i + 1) / addresses.length) * 100);
      onProgress(percent);
    }
  }
  
  return dictionary;
}