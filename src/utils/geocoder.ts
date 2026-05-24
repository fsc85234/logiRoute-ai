export interface GeocodingResult {
  lat: number;
  lng: number;
  success: boolean;
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
  const defaultCoords = { lat: 25.0478, lng: 121.5170, success: false, type: 'default' as const };
  if (!address) return defaultCoords;
  
  const cleanedAddress = cleanTaiwanAddress(address);
  
  try {
    await delay(1200); // 嚴格排隊，避免被 Nominatim 鎖 IP
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanedAddress)}&countrycodes=tw&limit=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' } });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), success: true, type: 'exact' };
      }
    }
    
    // 模糊備份方案 (擷取到路段)
    const roadMatch = address.match(/(.*?[路街街首段])\d+號?/);
    if (roadMatch && roadMatch[1]) {
      await delay(1200);
      const fuzzyUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(roadMatch[1])}&countrycodes=tw&limit=1`;
      const fuzzyResp = await fetch(fuzzyUrl, { headers: { 'User-Agent': 'LogiRouteAutomatedLogisticsAssistant/1.0' } });
      if (fuzzyResp.ok) {
        const fuzzyData = await fuzzyResp.json();
        if (fuzzyData && fuzzyData.length > 0) {
          return { lat: parseFloat(fuzzyData[0].lat), lng: parseFloat(fuzzyData[0].lon), success: true, type: 'fuzzy' };
        }
      }
    }
    return defaultCoords;
  } catch (error) {
    return defaultCoords;
  }
}

/**
 * 終極批次處理器：回傳以「地址為 Key」的 Dictionary，完美對接 RoutePlanner 的 results[item.address]
 */
export async function batchGeocode(
  addresses: string[],
  onProgress?: (progress: number) => void
): Promise<Record<string, GeocodingResult>> {
  const dictionary: Record<string, GeocodingResult> = {};
  
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    // 避免重複查詢相同地址
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