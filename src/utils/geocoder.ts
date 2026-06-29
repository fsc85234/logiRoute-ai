export interface GeocodingResult {
  latitude: number;   // 配合 RoutePlanner 改回原名
  longitude: number;  // 配合 RoutePlanner 改回原名
  success: boolean;
  error?: boolean;    // 配合 RoutePlanner 補上對應欄位
  type: 'exact' | 'fuzzy' | 'default';
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const uniqueValues = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

function cleanTaiwanAddress(address: string): string {
  let cleaned = address.trim();
  cleaned = cleaned.replace(/\s*[(（].*?[)）]/g, '');
  cleaned = cleaned.replace(/(\d+[\s\S]*?[樓室]|[+-\d]+(?:樓|室|F)).*/i, '$1');
  cleaned = cleaned.replace(/(樓|室|F|之\d+號?).*/g, '');
  cleaned = cleaned.replace(/臨\d+號?/g, '');
  return cleaned;
}

async function lookupAddress(query: string): Promise<GeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&countrycodes=tw&limit=1`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.6'
    }
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data || data.length === 0) return null;

  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
    success: true,
    error: false,
    type: 'exact'
  };
}
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  // 防呆座標：新竹市中心 (若查詢失敗，至少會落在新竹)
  const defaultCoords: GeocodingResult = { latitude: 24.8138, longitude: 120.9675, success: false, error: true, type: 'default' };
  
  if (!address) return defaultCoords;

  try {
    // 直接呼叫 Google API，不需要再做多層遞迴或 delay
    const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&language=zh-TW`;
    
    const response = await fetch(url);
    const data = await response.json();

    // 如果 Google 回傳成功且找到結果
    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { 
        latitude: loc.lat, 
        longitude: loc.lng, 
        success: true, 
        error: false, 
        type: 'exact' 
      };
    }
  } catch (err) {
    console.error('Google Geocoding error:', err);
  }
  
  // 如果 API 沒找到結果，回傳防呆座標
  return defaultCoords;
}
/**
 * 🛠️ 終極防錯多載批次查詢：
 * 容許傳入 3 個參數，完美消化 (addresses, defaultRegion, progressCallback)
 */
export async function batchGeocode(
  addresses: string[],
  arg2: string | ((progress: number) => void), // 自動包容 settings.defaultRegion 參數
  arg3?: (progress: number) => void
): Promise<Record<string, GeocodingResult>> {
  
  // 自動判定第三個參數或第二個參數誰才是進度 Callback
  const onProgress = typeof arg2 === 'function' ? arg2 : arg3;
  const defaultRegion = typeof arg2 === 'string' && arg2.trim() ? arg2 : '台灣';
  const dictionary: Record<string, GeocodingResult> = {};
  
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    if (!dictionary[addr]) {
      dictionary[addr] = await geocodeAddress(addr, defaultRegion);
    }
    
    if (onProgress) {
      const percent = Math.round(((i + 1) / addresses.length) * 100);
      onProgress(percent);
    }
  }
  
  return dictionary;
}
