export interface GeocodingResult {
  latitude: number;
  longitude: number;
  success: boolean;
  error?: boolean;
  type: 'exact' | 'default';
}

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const defaultCoords: GeocodingResult = { latitude: 25.0478, longitude: 121.517, success: false, error: true, type: 'default' };
  if (!address) return defaultCoords;

  try {
    const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&language=zh-TW`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { latitude: loc.lat, longitude: loc.lng, success: true, error: false, type: 'exact' };
    }
  } catch (err) {
    console.error('Google Geocoding error:', err);
  }
  return defaultCoords;
}

export async function batchGeocode(addresses: string[]): Promise<Record<string, GeocodingResult>> {
  const dictionary: Record<string, GeocodingResult> = {};
  for (const addr of addresses) {
    dictionary[addr] = await geocodeAddress(addr);
  }
  return dictionary;
}