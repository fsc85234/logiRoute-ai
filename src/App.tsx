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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('isAuthed') === 'true');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ocr');
  const [items, setItems] = useState<DeliveryItem[]>(() => {
    try { const stored = localStorage.getItem(ITEMS_STORAGE_KEY); return stored ? JSON.parse(stored) : []; } catch { return []; }
  });
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try { const stored = localStorage.getItem(SETTINGS_STORAGE_KEY); if (stored) return JSON.parse(stored); } catch {}
    return { geminiApiKey: '', isMockMode: true, defaultRegion: '台灣' };
  });

  const handleLogin = () => {
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAuthed', 'true');
    } else { alert('密碼錯誤！'); }
  };

  useEffect(() => { localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); }, [settings]);
  
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

  const handleAddItem = (newItem: Omit<DeliveryItem, 'id' | 'status' | 'seq'>) => {
    const sameDateItems = items.filter(x => x.deliveryDate === newItem.deliveryDate);
    setItems(prev => [...prev, { ...newItem, id: generateId(), status: 'pending', seq: sameDateItems.length + 1 }]);
  };

  const handleUpdateItem = (id: string, updated: Partial<DeliveryItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
  };

  const handleDeleteItem = (_id: string) => setItems(prev => prev.filter(i => i.id !== _id));
  const handleDeleteMultipleItems = (_ids: string[]) => setItems(prev => prev.filter(i => !_ids.includes(i.id)));
  const handleReorderItems = (_date: string, _reordered: DeliveryItem[]) => {};
  const handleImportOCRItems = (newItems: Omit<DeliveryItem, 'id' | 'status'>[]) => {
    setItems(prev => {
      // 紀錄目前每個日期的最大站次，避免重複
      const currentCounts: Record<string, number> = {};
      prev.forEach(item => {
        currentCounts[item.deliveryDate] = Math.max(currentCounts[item.deliveryDate] || 0, item.seq);
      });

      // 為每筆新匯入的資料依序自動編號
      const processedItems = newItems.map(item => {
        const date = item.deliveryDate;
        currentCounts[date] = (currentCounts[date] || 0) + 1;
        return {
          ...item,
          id: generateId(),
          status: 'pending' as const,
          seq: currentCounts[date]
        };
      });

      return [...prev, ...processedItems];
    });
    setActiveTab('map');
  };
  const handleUpdateItemCoords = (id: string, lat: number, lng: number, error?: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, latitude: lat, longitude: lng, geocoded: !error, geocodingError: error } : item));
  };
  const handleClearDb = () => setItems([]);

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

  if (!isAuthenticated) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white' }}>
        <h2 style={{ marginBottom: '20px' }}>物流管理系統</h2>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="請輸入密碼" style={{ padding: '10px', color: 'black', width: '250px' }} />
        <button onClick={handleLogin} style={{ marginTop: '10px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#3b82f6', border: 'none', color: 'white' }}>進入系統</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isMockMode={settings.isMockMode} />
      <div className="main-content">
        <Header items={items} activeTab={activeTab} />
        <div className="content-body">{renderActiveTabContent()}</div>
      </div>
    </div>
  );
}