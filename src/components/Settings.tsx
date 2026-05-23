import { useState } from 'react';
import { 
  Key, 
  ToggleLeft, 
  ToggleRight, 
  MapPin, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import type { SystemSettings } from '../types';

interface SettingsProps {
  settings: SystemSettings;
  setSettings: (settings: SystemSettings) => void;
  onClearDb: () => void;
}

export default function Settings({ settings, setSettings, onClearDb }: SettingsProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      geminiApiKey: e.target.value,
    });
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      defaultRegion: e.target.value,
    });
  };

  const toggleMockMode = () => {
    setSettings({
      ...settings,
      isMockMode: !settings.isMockMode,
    });
  };

  const testApiKey = async () => {
    if (!settings.geminiApiKey) {
      setTestStatus('error');
      setErrorMessage('請先輸入 API Key 再進行測試！');
      return;
    }

    setTestStatus('testing');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }]
        }),
      });

      if (response.ok) {
        setTestStatus('success');
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }
    } catch (error: any) {
      setTestStatus('error');
      setErrorMessage(error.message || '連線測試失敗。請確認金鑰正確性或網路狀態。');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* API Key Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Key color="var(--accent-cyan)" size={20} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Google Gemini AI 金鑰設定</h3>
        </div>
        
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          本系統整合了新一代的 <strong>Gemini 2.5 Flash</strong> 視覺語言模型，能夠以極高精準度解析包含手寫單據、印製單據或複雜的物流 Excel 截圖。
          金鑰將安全儲存在您本機的瀏覽器快取中，不會被傳送到任何第三方伺服器。
        </p>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="api-key-input">Gemini API Key</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              id="api-key-input"
              type="password"
              className="form-input"
              placeholder="AIzaSy..."
              value={settings.geminiApiKey}
              onChange={handleApiKeyChange}
              disabled={settings.isMockMode}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={testApiKey}
              disabled={testStatus === 'testing' || !settings.geminiApiKey || settings.isMockMode}
              style={{ minWidth: '120px' }}
            >
              {testStatus === 'testing' ? (
                <>
                  <RefreshCw size={14} className="shimmer-bg" style={{ animation: 'spin 1s infinite linear' }} />
                  測試中...
                </>
              ) : '測試連線'}
            </button>
          </div>
        </div>

        {/* Connection Results Alerts */}
        {testStatus === 'success' && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '13px'
            }}
          >
            <CheckCircle2 size={16} />
            <span>連線測試成功！API 金鑰有效，且可正常進行 OCR 圖像解析。</span>
          </div>
        )}

        {testStatus === 'error' && (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#f87171',
              fontSize: '13px'
            }}
          >
            <XCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Mode & Region Settings */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MapPin color="var(--accent-violet)" size={20} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>運行與定位配置</h3>
        </div>

        {/* Mock Mode Toggle */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--card-border)'
          }}
        >
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600' }}>無 Key 試用模式 (Mock Mode)</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              啟用後，系統將直接以預載的台灣物流出貨單/Excel表格截圖模擬 OCR 解析，方便您立即體驗。
            </p>
          </div>
          <button 
            onClick={toggleMockMode}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
          >
            {settings.isMockMode ? (
              <ToggleRight size={44} color="var(--accent-amber)" />
            ) : (
              <ToggleLeft size={44} color="var(--text-muted)" />
            )}
          </button>
        </div>

        {/* Default Region Input */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="region-input">預設地理定位區塊</label>
          <input
            id="region-input"
            type="text"
            className="form-input"
            placeholder="例如: 台灣"
            value={settings.defaultRegion}
            onChange={handleRegionChange}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            <Info size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            當辨識出的配送地址缺乏縣市名稱時，系統會自動預加此標籤，以提高地圖定位的準確率。
          </span>
        </div>
      </div>

      {/* Database Management */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trash2 color="var(--accent-rose)" size={20} />
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>資料清理與維護</h3>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          刪除目前暫存在您瀏覽器資料庫的所有配送單地址與經緯度資訊。此操作不可還原，請謹慎操作。
        </p>

        <div>
          <button 
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('確定要清空資料庫內的所有配送地址嗎？這會清除您所有的排程項目！')) {
                onClearDb();
                alert('資料庫已清空！');
              }
            }}
          >
            <Trash2 size={16} />
            清空暫存配送資料庫
          </button>
        </div>
      </div>
      
    </div>
  );
}
