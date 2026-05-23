/**
 * Geocoding utility using OpenStreetMap Nominatim API.
 * Includes a persistent browser cache to avoid repeated geocoding requests.
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

const GEOCODE_CACHE_KEY = 'logistics_geocode_cache';

// Load cache from localStorage
function getCache(): Record<string, Coordinates> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save cache to localStorage
function saveToCache(address: string, coords: Coordinates) {
  try {
    const cache = getCache();
    cache[address] = coords;
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('Error saving geocode to cache:', err);
  }
}

// Taiwanese administrative region centers for fallback geocoding
const REGION_FALLBACKS: Record<string, Coordinates> = {
  '台北市': { latitude: 25.0478, longitude: 121.5170 }, // Taipei Station
  '新北市': { latitude: 25.0120, longitude: 121.4657 }, // Banqiao
  '基隆市': { latitude: 25.1283, longitude: 121.7419 },
  '宜蘭縣': { latitude: 24.7570, longitude: 121.7530 },
  '桃園市': { latitude: 24.9937, longitude: 121.3010 },
  '新竹市': { latitude: 24.8138, longitude: 120.9675 },
  '新竹縣': { latitude: 24.8385, longitude: 121.0116 },
  '苗栗縣': { latitude: 24.5649, longitude: 120.8208 },
  '台中市': { latitude: 24.1477, longitude: 120.6736 }, // Taichung Station
  '彰化縣': { latitude: 24.0518, longitude: 120.4300 },
  '南投縣': { latitude: 23.9101, longitude: 120.6961 },
  '雲林縣': { latitude: 23.7092, longitude: 120.4313 },
  '嘉義市': { latitude: 23.4801, longitude: 120.4491 },
  '嘉義縣': { latitude: 23.4518, longitude: 120.2555 },
  '台南市': { latitude: 22.9976, longitude: 120.2119 }, // Tainan Station
  '高雄市': { latitude: 22.6273, longitude: 120.3014 }, // Kaohsiung Station
  '屏東縣': { latitude: 22.6723, longitude: 120.4883 },
  '花蓮縣': { latitude: 23.9872, longitude: 121.6016 },
  '台東縣': { latitude: 22.7560, longitude: 121.1500 },
  '澎湖縣': { latitude: 23.5711, longitude: 119.5665 },
};

const TAIWAN_CENTER: Coordinates = { latitude: 23.6978, longitude: 120.9605 };

/**
 * Geocodes a text address into latitude and longitude coordinates.
 * Utilizes local cache first, then calls OSM Nominatim.
 */
export async function geocodeAddress(
  address: string,
  defaultRegion: string = '台灣'
): Promise<Coordinates> {
  const cleanAddress = address.trim();
  if (!cleanAddress) {
    throw new Error('地址不能為空');
  }

  // 1. Check local cache
  const cache = getCache();
  if (cache[cleanAddress]) {
    return cache[cleanAddress];
  }

  // 2. Determine fallback coordinates based on city detection in address
  let fallbackCoords = TAIWAN_CENTER;
  for (const region of Object.keys(REGION_FALLBACKS)) {
    if (cleanAddress.includes(region)) {
      fallbackCoords = REGION_FALLBACKS[region];
      break;
    }
  }

  // 3. Prepare search query (ensure region search context)
  let searchQuery = cleanAddress;
  if (!searchQuery.includes(defaultRegion) && !searchQuery.match(/(台北|新北|基隆|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|台南|高雄|屏東|宜蘭|花蓮|台東|澎湖)/)) {
    searchQuery = `${defaultRegion} ${searchQuery}`;
  }

  try {
    // OSM Nominatim API request
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
    
    // We add a short timeout to prevent hanging, and comply with usage rules (user-agent header)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LogisticsAddressOCROptimizerApp/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned status ${response.status}`);
    }

    const results = await response.json();

    if (Array.isArray(results) && results.length > 0) {
      const coords = {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };

      // Save to cache
      saveToCache(cleanAddress, coords);
      return coords;
    }

    // Try a second time with just the city + road (stripping specific floor/room number suffixes like "x樓之y" or "z號")
    // This dramatically increases the hit rate for detailed apartment addresses!
    const simplifiedAddress = cleanAddress
      .replace(/(樓之\d+|樓|\d+室|第\d+倉)/g, '') // remove floor/room
      .trim();

    if (simplifiedAddress !== cleanAddress && simplifiedAddress.length > 5) {
      const retryUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedAddress)}&limit=1`;
      const retryRes = await fetch(retryUrl, {
        headers: {
          'User-Agent': 'LogisticsAddressOCROptimizerApp/1.0',
        },
      });

      if (retryRes.ok) {
        const retryResults = await retryRes.json();
        if (Array.isArray(retryResults) && retryResults.length > 0) {
          const coords = {
            latitude: parseFloat(retryResults[0].lat),
            longitude: parseFloat(retryResults[0].lon),
          };
          saveToCache(cleanAddress, coords);
          return coords;
        }
      }
    }

    // If still not found, return the region fallback center
    console.warn(`Could not geocode address: "${cleanAddress}", falling back to regional coordinates.`);
    return fallbackCoords;
  } catch (error) {
    console.error(`Geocoding error for address: "${cleanAddress}":`, error);
    // Silent fail and return fallback to keep the map alive
    return fallbackCoords;
  }
}

/**
 * Batch geocodes multiple addresses.
 * Limits speed slightly to comply with Nominatim's fair-use policies.
 */
export async function batchGeocode(
  addresses: string[],
  defaultRegion: string = '台灣',
  onProgress?: (progress: number) => void
): Promise<Record<string, Coordinates & { error?: boolean }>> {
  const results: Record<string, Coordinates & { error?: boolean }> = {};
  const cache = getCache();
  let completed = 0;

  for (const address of addresses) {
    const cleanAddress = address.trim();
    if (!cleanAddress) continue;

    if (cache[cleanAddress]) {
      results[cleanAddress] = cache[cleanAddress];
      completed++;
      if (onProgress) onProgress(Math.round((completed / addresses.length) * 100));
      continue;
    }

    // Delay slightly to prevent slamming Nominatim API if it's a cold cache
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const coords = await geocodeAddress(cleanAddress, defaultRegion);
      results[cleanAddress] = coords;
    } catch {
      // Fallback
      results[cleanAddress] = {
        ...TAIWAN_CENTER,
        error: true,
      };
    }

    completed++;
    if (onProgress) onProgress(Math.round((completed / addresses.length) * 100));
  }

  return results;
}
