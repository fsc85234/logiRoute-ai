import { 
  Scan, 
  Database, 
  Map, 
  Navigation,
  Settings as SettingsIcon, 
  Truck, 
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMockMode: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, isMockMode }: SidebarProps) {
  const menuItems = [
    { id: 'ocr',      label: '智慧辨識', mobileLabel: '辨識', icon: Scan },
    { id: 'database', label: '配送地址庫', mobileLabel: '地址庫', icon: Database },
    { id: 'map',      label: '地圖路徑規劃', mobileLabel: '地圖', icon: Map },
    { id: 'analysis', label: '最佳路徑分析', mobileLabel: '路徑', icon: Navigation },
    { id: 'settings', label: '系統設定', mobileLabel: '設定', icon: SettingsIcon },
  ];

  return (
    <>
      {/* ── Desktop Sidebar (hidden on mobile via CSS) ── */}
      <div
        className="glass-panel sidebar-desktop"
        style={{
          width: 'var(--sidebar-width)',
          height: 'calc(100vh - 32px)',
          margin: '16px',
          padding: '24px 16px',
          flexDirection: 'column',
          gap: '32px',
          borderRadius: '16px',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo))',
            padding: '8px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)',
          }}>
            <Truck size={24} color="#070a13" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', lineHeight: 1, fontFamily: 'var(--font-title)' }}>
              LogiRoute <span style={{ color: 'var(--accent-cyan)' }}>AI</span>
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>
              TAIWAN DELIVERY OCR
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="nav-btn-hover"
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  width: '100%', padding: '12px 16px', borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontSize: '14px', fontWeight: isActive ? '600' : '500',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'var(--transition-smooth)', outline: 'none',
                  boxShadow: isActive ? 'inset 0 0 0 1px rgba(6, 182, 212, 0.2)' : 'none',
                }}
              >
                <Icon size={18} style={{ transition: 'var(--transition-smooth)', flexShrink: 0 }} />
                {item.label}
                {isActive && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--accent-cyan)', marginLeft: 'auto',
                    boxShadow: '0 0 8px var(--accent-cyan)',
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Mode Tag Footer */}
        <div style={{
          padding: '12px', borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--card-border)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color={isMockMode ? 'var(--accent-amber)' : 'var(--accent-emerald)'} />
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
              系統運行模式
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: isMockMode ? 'var(--accent-amber)' : 'var(--accent-emerald)',
              boxShadow: `0 0 8px ${isMockMode ? 'var(--accent-amber)' : 'var(--accent-emerald)'}`,
            }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {isMockMode ? '試用模式 (模擬辨識)' : 'AI 生產模式 (Gemini 2.5)'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation (hidden on desktop via CSS) ── */}
      <nav className="sidebar-mobile">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="mobile-nav-btn"
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '4px', flex: 1, padding: '8px 4px',
                background: 'transparent', border: 'none',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'var(--transition-smooth)',
                outline: 'none', position: 'relative',
              }}
            >
              {/* Active indicator bar at top */}
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '28px', height: '2px',
                  background: 'var(--accent-cyan)',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 0 10px var(--accent-cyan)',
                }} />
              )}
              <div style={{
                padding: '4px 12px',
                borderRadius: '10px',
                background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                transition: 'var(--transition-smooth)',
              }}>
                <Icon size={20} />
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? '600' : '400',
                letterSpacing: '0.01em',
              }}>
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
