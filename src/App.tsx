import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { OCRScanner } from './components/OCRScanner';
import AddressTable from './components/AddressTable';
import RoutePlanner from './components/RoutePlanner';
import RouteAnalysis from './components/RouteAnalysis';
import Settings from './components/Settings';
import type { DeliveryItem, SystemSettings } from './types';

const ITEMS_STORAGE_KEY = 'logistics_delivery_items';
const SETTINGS_STORAGE_KEY = 'logistics_system_settings';

export default function App() {
  // --- 登入驗證狀態 ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('isAuthed') === 'true';
  });
  const [password, setPassword] = useState('');

  // --- 原有狀態 ---
  const [activeTab, setActiveTab] = useState<string>('ocr');
  const [items, setItems] = useState<DeliveryItem[]>(() => {
    try {
      const stored = localStorage.getItem(ITEMS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { geminiApiKey: '', isMockMode: true, defaultRegion: '台灣' };
  });

  // --- 功能邏輯 ---
  const handleLogin = () => {
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthed', 'true');
    } else {
      alert('密碼錯誤！');
    }
  };

  useEffect(() => { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); }, [settings]);
  
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

  const handleAddItem = (newItem: Omit<DeliveryItem, 'id' | 'status' | 'seq'>) => {
    const sameDateItems = items.filter(x => x.deliveryDate === newItem.deliveryDate);
    setItems(prev => [...prev, { ...newItem, id: generateId(), status: 'pending', seq: sameDateItems.length + 1 }]);
  };

  const handleUpdateItem = (id: string, updated: Partial<DeliveryItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const needsReGeocode = updated.address !== undefined && updated.address !== item.address;
        return needsReGeocode ? { ...item, ...updated, latitude: undefined, longitude: undefined, geocoded: false } : { ...item, ...updated };
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => { /* 這裡保持您原本的 handleDeleteItem 實作內容 */ };
  const handleDeleteMultipleItems = (ids: string[]) => { /* 這裡保持您原本的 handleDeleteMultipleItems 實作內容 */ };
  const handleReorderItems = (date: string, reordered: DeliveryItem[]) => { /* 這裡保持您原本的 handleReorderItems 實作內容 */ };
  const handleImportOCRItems = (newItems: Omit<DeliveryItem, 'id' | 'status'>[]) => { setItems(prev => [...prev, ...newItems.map(i => ({...i, id: generateId(), status: 'pending' as const}))]); setActiveTab('map'); };
  const handleUpdateItemCoords = (id: string, lat: number, lng: number, error?: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, latitude: lat, longitude: lng, geocoded: !error, geocodingError: error } : item));
  };
  const handleClearDb = () => { setItems([]); };

  // --- 頁面渲染邏輯 ---
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'ocr': return <OCRScanner settings={settings} onImportItems={handleImportOCRItems} />;
      case 'database': return <AddressTable items={items} onAddItem={handleAddItem} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} onDeleteMultipleItems={handleDeleteMultipleItems} onReorderItems={handleReorderItems} />;
      case 'map': return <RoutePlanner items={items} settings={settings} onUpdateItemCoords={handleUpdateItemCoords} />;
      case 'analysis': return <RouteAnalysis items={items} settings={settings} onUpdateItemCoords={handleUpdateItemCoords} />;
      case 'settings': return <Settings settings={settings} setSettings={setSettings} onClearDb={handleClearDb} />;
      default: return <OCRScanner settings={settings} onImportItems={handleImportOCRItems} />;
    }
  };

  // --- 門禁畫面 (未登入時顯示) ---
  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white' }}>
        <h2 style={{ marginBottom: '20px' }}>物流管理系統 - 請登入</h2>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="請輸入密碼"
          style={{ padding: '10px', borderRadius: '5px', border: 'none', marginBottom: '10px', width: '250px', color: 'black' }}
        />
        <button onClick={handleLogin} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white' }}>
          進入系統
        </button>
      </div>
    );
  }

  // --- 正式系統畫面 (登入後顯示) ---
  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isMockMode={settings.isMockMode} />
      <div className="main-content">
        <Header items={items} activeTab={activeTab} />
        <div className="content-body">
          {renderActiveTabContent()}
        </div>
      </div>
    </div>
  );
}