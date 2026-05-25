import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { OCRScanner } from './components/OCRScanner';
import AddressTable from './components/AddressTable';
import RoutePlanner from './components/RoutePlanner';
import Settings from './components/Settings';
import type { DeliveryItem, SystemSettings } from './types';

const ITEMS_STORAGE_KEY = 'logistics_delivery_items';
const SETTINGS_STORAGE_KEY = 'logistics_system_settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('ocr');

  // Load items from local storage
  const [items, setItems] = useState<DeliveryItem[]>(() => {
    try {
      const stored = localStorage.getItem(ITEMS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load settings from local storage
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    
    // Default fallback settings
    return {
      geminiApiKey: '',
      isMockMode: true,
      defaultRegion: '台灣'
    };
  });

  // Save items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Helper to generate custom unique IDs
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  };

  // CRUD Handler: Add Address Manually
  const handleAddItem = (newItem: Omit<DeliveryItem, 'id' | 'status' | 'seq'>) => {
    // Determine the next sequence number for this specific date
    const sameDateItems = items.filter(x => x.deliveryDate === newItem.deliveryDate);
    const nextSeq = sameDateItems.length + 1;

    const fullItem: DeliveryItem = {
      ...newItem,
      id: generateId(),
      status: 'pending',
      seq: nextSeq
    };

    setItems(prev => [...prev, fullItem]);
  };

  // CRUD Handler: Edit Address inline or from verification table
  const handleUpdateItem = (id: string, updated: Partial<DeliveryItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        // If delivery date changes, we will need to resequence it later
        return { ...item, ...updated };
      }
      return item;
    }));

    // If the delivery date has been changed, trigger a batch re-sequence for both dates
    if (updated.deliveryDate) {
      const oldItem = items.find(x => x.id === id);
      if (oldItem && oldItem.deliveryDate !== updated.deliveryDate) {
        setTimeout(() => {
          resequenceAllDates();
        }, 100);
      }
    }
  };

  // CRUD Handler: Delete single address and close sequence gaps
  const handleDeleteItem = (id: string) => {
    const itemToDelete = items.find(x => x.id === id);
    if (!itemToDelete) return;

    setItems(prev => {
      const remaining = prev.filter(item => item.id !== id);
      
      // Resequence remaining items for that specific date
      const dateToResequence = itemToDelete.deliveryDate;
      const sameDateItems = remaining
        .filter(item => item.deliveryDate === dateToResequence)
        .sort((a, b) => a.seq - b.seq)
        .map((item, idx) => ({ ...item, seq: idx + 1 }));

      const otherItems = remaining.filter(item => item.deliveryDate !== dateToResequence);
      return [...otherItems, ...sameDateItems];
    });
  };

  // CRUD Handler: Delete multiple selected addresses
  const handleDeleteMultipleItems = (ids: string[]) => {
    if (ids.length === 0) return;
    
    // Find affected dates
    const affectedDates = Array.from(
      new Set(items.filter(item => ids.includes(item.id)).map(item => item.deliveryDate))
    );

    setItems(prev => {
      const remaining = prev.filter(item => !ids.includes(item.id));
      
      // Resequence all affected dates
      let updated = [...remaining];
      affectedDates.forEach(date => {
        const sameDateItems = updated
          .filter(item => item.deliveryDate === date)
          .sort((a, b) => a.seq - b.seq)
          .map((item, idx) => ({ ...item, seq: idx + 1 }));

        const otherItems = updated.filter(item => item.deliveryDate !== date);
        updated = [...otherItems, ...sameDateItems];
      });

      return updated;
    });
  };

  // Resequence entire dates in the database
  const resequenceAllDates = () => {
    setItems(prev => {
      const dates = Array.from(new Set(prev.map(x => x.deliveryDate)));
      let updated: DeliveryItem[] = [];

      dates.forEach(date => {
        const sorted = prev
          .filter(x => x.deliveryDate === date)
          .sort((a, b) => a.seq - b.seq)
          .map((item, idx) => ({ ...item, seq: idx + 1 }));
        
        updated = [...updated, ...sorted];
      });

      return updated;
    });
  };

  // CRUD Handler: Reorder rows inside address table
  const handleReorderItems = (date: string, reordered: DeliveryItem[]) => {
    setItems(prev => {
      const others = prev.filter(item => item.deliveryDate !== date);
      return [...others, ...reordered];
    });
  };

  // CRUD Handler: Import all verified items from OCR scan
  const handleImportOCRItems = (newItems: Omit<DeliveryItem, 'id' | 'status'>[]) => {
    // Group new items by their target date to assign sequences properly
    setItems(prev => {
      let currentItems = [...prev];

      newItems.forEach(item => {
        const sameDateCount = currentItems.filter(x => x.deliveryDate === item.deliveryDate).length;
        const fullItem: DeliveryItem = {
          ...item,
          id: generateId(),
          status: 'pending',
          seq: sameDateCount + 1
        };
        currentItems.push(fullItem);
      });

      return currentItems;
    });

    // ✨ Auto-jump to map to view newly imported addresses with auto-geocoding!
    setActiveTab('map');
  };

  // Map Handler: Save geocode results back to the database
  const handleUpdateItemCoords = (id: string, lat: number, lng: number, error?: boolean) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          latitude: lat,
          longitude: lng,
          geocoded: !error,
          geocodingError: error
        };
      }
      return item;
    }));
  };

  // System Settings: Wipe entire DB
  const handleClearDb = () => {
    setItems([]);
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'ocr':
        return (
          <OCRScanner 
            settings={settings} 
            onImportItems={handleImportOCRItems} 
          />
        );
      case 'database':
        return (
          <AddressTable
            items={items}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onDeleteMultipleItems={handleDeleteMultipleItems}
            onReorderItems={handleReorderItems}
          />
        );
      case 'map':
        return (
          <RoutePlanner
            items={items}
            settings={settings}
            onUpdateItemCoords={handleUpdateItemCoords}
          />
        );
      case 'settings':
        return (
          <Settings
            settings={settings}
            setSettings={setSettings}
            onClearDb={handleClearDb}
          />
        );
      default:
        return (
          <OCRScanner 
            settings={settings} 
            onImportItems={handleImportOCRItems} 
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isMockMode={settings.isMockMode} 
      />

      {/* Main viewport */}
      <div className="main-content">
        {/* Core dynamic Header */}
        <Header items={items} activeTab={activeTab} />
        
        {/* Scrollable content pane */}
        <div className="content-body">
          {renderActiveTabContent()}
        </div>
      </div>
    </div>
  );
}
