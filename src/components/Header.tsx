import { 
  FileText, 
  Clock, 
  CheckCircle, 
  Calendar
} from 'lucide-react';
import type { DeliveryItem } from '../types';

interface HeaderProps {
  items: DeliveryItem[];
  activeTab: string;
}

export default function Header({ items, activeTab }: HeaderProps) {
  // Stat calculations
  const totalCount = items.length;
  const pendingCount = items.filter(item => item.status === 'pending').length;
  const processingCount = items.filter(item => item.status === 'processing').length;
  const completedCount = items.filter(item => item.status === 'completed').length;
  
  // Count unique dates
  const uniqueDates = Array.from(new Set(items.map(item => item.deliveryDate))).filter(Boolean);
  const dateCount = uniqueDates.length;

  const getTitle = () => {
    switch (activeTab) {
      case 'ocr':
        return '智慧辨識導入 (AI Slip OCR Scanner)';
      case 'database':
        return '配送地址庫 (Delivery Address List)';
      case 'map':
        return '地圖路徑規劃 (Route Planner & Visualizer)';
      case 'analysis':
        return '最佳路徑分析 (Best Route Analysis)';
      case 'settings':
        return '系統設定 (System Configurations)';
      default:
        return '控制面板 (Dashboard)';
    }
  };

  const getSubtitle = () => {
    switch (activeTab) {
      case 'analysis':
        return '分析地圖上的配送點座標，依最短距離重新排序並列出建議行車路線';
      default:
        return '透過 AI 影像辨識將物流配送單或 Excel 截圖自動轉換為 Google Maps 最佳多站導航路徑';
    }
  };

  const statCards = [
    {
      label: '總配送筆數',
      value: totalCount,
      icon: FileText,
      color: 'var(--accent-cyan)',
      glow: 'var(--glow-cyan)'
    },
    {
      label: '待配送項目',
      value: pendingCount + processingCount,
      icon: Clock,
      color: 'var(--accent-violet)',
      glow: 'var(--glow-violet)'
    },
    {
      label: '已配送完畢',
      value: completedCount,
      icon: CheckCircle,
      color: 'var(--accent-emerald)',
      glow: 'var(--glow-emerald)'
    },
    {
      label: '配送日期分組',
      value: dateCount,
      icon: Calendar,
      color: 'var(--accent-indigo)',
      glow: 'rgba(99, 102, 241, 0.15)'
    }
  ];

  return (
    <header 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px 24px 0 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '20px'
      }}
    >
      {/* Title & Date */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h1 
            style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              fontFamily: 'var(--font-title)',
              letterSpacing: '-0.01em'
            }}
          >
            {getTitle()}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {getSubtitle()}
          </p>
        </div>
        <div 
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Calendar size={14} color="var(--accent-cyan)" />
          <span>今天日期: {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div 
              key={i}
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, rgba(15, 22, 42, 0.6) 0%, rgba(15, 22, 42, 0.8) 100%)`
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                  {card.label}
                </span>
                <h3 
                  style={{ 
                    fontSize: '24px', 
                    fontWeight: '800', 
                    marginTop: '4px',
                    fontFamily: 'var(--font-title)',
                    color: '#ffffff'
                  }}
                >
                  {card.value}
                </h3>
              </div>
              <div 
                style={{
                  background: card.glow,
                  padding: '10px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid rgba(255, 255, 255, 0.05)`,
                  boxShadow: `0 0 10px ${card.glow}`
                }}
              >
                <Icon size={20} color={card.color} />
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
