export interface DeliveryItem {
  id: string;
  seq: number;
  orderId: string;
  channel: string;
  address: string;
  recipient: string;
  phone: string;
  items: string;
  serviceType: string; // e.g. "基本安裝", "純配送(不安裝)"
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // e.g. "0900~1200"
  sku: string;
  remarks: string;
  status: 'pending' | 'processing' | 'completed';
  latitude?: number;
  longitude?: number;
  geocoded?: boolean;
  geocodingError?: boolean;
}

export interface SystemSettings {
  geminiApiKey: string;
  isMockMode: boolean;
  defaultRegion: string; // Default search region (e.g., "台灣")
}

export interface OCRResult {
  deliveryDate: string;
  items: Omit<DeliveryItem, 'id' | 'status'>[];
}
