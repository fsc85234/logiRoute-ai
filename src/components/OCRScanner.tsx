import { useState, useRef } from 'react';
import { 
  Upload, 
  Sparkles, 
  FileImage, 
  Trash2, 
  Database,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  User,
  Phone,
  FileText
} from 'lucide-react';
import type { SystemSettings, DeliveryItem } from '../types';
import { SAMPLES } from '../utils/samples';
import type { SampleSlip } from '../utils/samples';
import { analyzeDeliverySlipImage, getSampleMockData } from '../utils/gemini';

interface OCRScannerProps {
  settings: SystemSettings;
  onImportItems: (newItems: Omit<DeliveryItem, 'id' | 'status'>[]) => void;
}

export default function OCRScanner({ settings, onImportItems }: OCRScannerProps) {
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/png');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // OCR processing states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Parsed results for verification
  const [ocrResults, setOcrResults] = useState<{
    deliveryDate: string;
    items: Omit<DeliveryItem, 'id' | 'status'>[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingStepsText = [
    '正在上傳影像與編碼中...',
    '引導 Gemini 2.5 Flash 進行多模態結構分析...',
    '正在精準提取配送日期與繁體中文地址...',
    '格式化為 JSON 並排查拼音/亂碼地址中...',
    '完成辨識！準備進行數據校對...'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImageMimeType(file.type);
    setSelectedSampleId(null);
    setOcrResults(null);
    setErrorMessage(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageFile(e.target.result as string);
      }
    };
    reader.onerror = () => {
      setErrorMessage('讀取檔案時出錯，請換一張圖片再試一次。');
    };
    reader.readAsDataURL(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    } else {
      setErrorMessage('僅支援上傳圖片檔案 (PNG, JPG, WEBP)！');
    }
  };

  // Click handler to open file browser
  const openFileBrowser = () => {
    fileInputRef.current?.click();
  };

  // Pre-configured Sample loader
  const loadSample = (sample: SampleSlip) => {
    setImageFile(null);
    setSelectedSampleId(sample.id);
    setOcrResults(null);
    setErrorMessage(null);
  };

  // Running OCR parser
  const runOCRAnalysis = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setOcrResults(null);
    
    // Simulate loading steps in UI
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= 3) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    try {
      let result;
      
      // If we selected a sample OR we are explicitly in Mock Mode without keys, pull dummy data
      if (selectedSampleId) {
        setLoadingStep(1);
        await new Promise((r) => setTimeout(r, 1200));
        setLoadingStep(3);
        await new Promise((r) => setTimeout(r, 1000));
        result = getSampleMockData(selectedSampleId);
      } else if (settings.isMockMode) {
        // Fallback to sample 1 mock data if uploading a custom file in mock mode
        setLoadingStep(1);
        await new Promise((r) => setTimeout(r, 1500));
        setLoadingStep(3);
        await new Promise((r) => setTimeout(r, 1200));
        result = getSampleMockData('pchome_excel_screenshot');
      } else {
        // Real production call to Gemini 2.5 Flash
        if (!imageFile) {
          throw new Error('請先上傳圖片或選擇右側的範例配送單。');
        }
        setLoadingStep(1);
        result = await analyzeDeliverySlipImage(
          imageFile,
          settings.geminiApiKey,
          settings.defaultRegion,
          imageMimeType
        );
      }

      setLoadingStep(4);
      await new Promise((r) => setTimeout(r, 600));
      setOcrResults(result);
    } catch (error: any) {
      setErrorMessage(error.message || '辨識失敗，請檢查 API Key 或重試。');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  // Form field update handlers for manual calibration
  const handleResultItemChange = (
    index: number,
    field: keyof Omit<DeliveryItem, 'id' | 'status'>,
    value: any
  ) => {
    if (!ocrResults) return;
    const updatedItems = [...ocrResults.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setOcrResults({
      ...ocrResults,
      items: updatedItems
    });
  };

  const handleGlobalDateChange = (date: string) => {
    if (!ocrResults) return;
    const updatedItems = ocrResults.items.map(item => ({
      ...item,
      deliveryDate: date
    }));
    setOcrResults({
      deliveryDate: date,
      items: updatedItems
    });
  };

  const handleRemoveResultItem = (index: number) => {
    if (!ocrResults) return;
    const updatedItems = ocrResults.items.filter((_, i) => i !== index);
    setOcrResults({
      ...ocrResults,
      items: updatedItems
    });
  };

  const importToDatabase = () => {
    if (!ocrResults || ocrResults.items.length === 0) return;
    onImportItems(ocrResults.items);
    setOcrResults(null);
    setImageFile(null);
    setSelectedSampleId(null);
    alert(`成功導入 ${ocrResults.items.length} 筆配送地址至地址庫！`);
  };

  const clearUploadedImage = () => {
    setImageFile(null);
    setSelectedSampleId(null);
    setOcrResults(null);
    setErrorMessage(null);
  };

  // Render SVG or Image in previewer
  const renderPreview = () => {
    if (selectedSampleId) {
      const sample = SAMPLES.find(s => s.id === selectedSampleId);
      if (sample) {
        return (
          <div 
            dangerouslySetInnerHTML={{ __html: sample.svgString }} 
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
          />
        );
      }
    }

    if (imageFile) {
      return (
        <img 
          src={imageFile} 
          alt="配送單預覽" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
        />
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {errorMessage && (
        <div 
          style={{
            padding: '12px 16px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: '#f87171',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
      
      {!ocrResults ? (
        /* ================= UPLOAD SCREEN ================= */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          
          {/* Uploader Card */}
          <div 
            className={`glass-panel ${isDragOver ? 'animate-glow' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              textAlign: 'center',
              border: isDragOver ? '2px dashed var(--accent-cyan)' : '1px solid var(--card-border)',
              cursor: imageFile || selectedSampleId ? 'default' : 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={imageFile || selectedSampleId ? undefined : openFileBrowser}
          >
            {/* Hidden Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange}
            />

            {isLoading && (
              /* Laser scan animation overlay */
              <div 
                style={{
                  position: 'absolute',
                  left: 0,
                  width: '100%',
                  height: '4px',
                  background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)',
                  boxShadow: '0 0 15px var(--accent-cyan), 0 0 25px var(--accent-cyan)',
                  animation: 'scan-laser 3s infinite ease-in-out',
                  zIndex: 2
                }}
              />
            )}

            {imageFile || selectedSampleId ? (
              /* Image Uploaded/Sample Loaded Preview */
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <div 
                  style={{ 
                    width: '100%', 
                    maxHeight: '320px', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: '#090d16',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '8px'
                  }}
                >
                  {renderPreview()}
                </div>

                {!isLoading && (
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button className="btn btn-secondary" onClick={clearUploadedImage}>
                      <Trash2 size={16} color="var(--accent-rose)" />
                      清除並重新上傳
                    </button>
                    <button className="btn btn-primary" onClick={runOCRAnalysis}>
                      <Sparkles size={16} />
                      開始 AI 智慧解析
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty Dropzone state */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div 
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'var(--glow-cyan)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    boxShadow: '0 0 20px var(--glow-cyan)'
                  }}
                >
                  <Upload size={32} color="var(--accent-cyan)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
                    拖曳配送單圖片或 Excel 截圖至此
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    支援 PNG, JPG, WEBP 等格式，或點擊此處手動瀏覽檔案
                  </p>
                </div>
              </div>
            )}

            {/* Parsing State Card Overlay */}
            {isLoading && (
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(7, 10, 19, 0.85)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '24px',
                  zIndex: 3
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div 
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      border: '4px solid var(--bg-tertiary)',
                      borderTopColor: 'var(--accent-cyan)',
                      animation: 'spin 1.2s infinite linear'
                    }}
                  />
                  <Sparkles 
                    size={20} 
                    color="var(--accent-violet)" 
                    style={{ position: 'absolute', animation: 'pulse 1.5s infinite ease-in-out' }} 
                  />
                </div>
                
                <div style={{ maxWidth: '300px', textAlign: 'center' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px' }}>AI 正在解析您的配送數據</h4>
                  <p 
                    style={{ 
                      fontSize: '12px', 
                      color: 'var(--accent-cyan)',
                      fontWeight: '500',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {loadingStepsText[loadingStep]}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Samples Card Panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileImage size={18} color="var(--accent-indigo)" />
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>快速試用範例單據</h3>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              沒有準備好的物流出貨單？點選下方由真實資料模擬的配送表截圖或簽收聯，直接開始體驗地圖路線與排程！
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => loadSample(sample)}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: selectedSampleId === sample.id ? 'var(--accent-cyan)' : 'var(--card-border)',
                    background: selectedSampleId === sample.id ? 'rgba(6, 182, 212, 0.05)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)',
                    outline: 'none',
                    boxShadow: selectedSampleId === sample.id ? '0 0 10px rgba(6, 182, 212, 0.1)' : 'none'
                  }}
                >
                  <h4 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} color={selectedSampleId === sample.id ? 'var(--accent-cyan)' : 'var(--text-secondary)'} />
                    {sample.name}
                  </h4>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {sample.description}
                  </p>
                </button>
              ))}
            </div>

            {settings.isMockMode && (
              <div 
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.15)',
                  color: 'var(--accent-amber)',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.3
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>目前處於<strong>試用模式</strong>。上傳自訂圖片也會以「PChome配送日報表」作為模擬解析結果，如需辨識自訂圖片，請至「系統設定」關閉試用模式並輸入 API Key。</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= VERIFICATION VIEW ================= */
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 color="var(--accent-emerald)" size={24} />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>AI 數據辨識校對面板</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  請校對與微調 AI 提取的地址、品名與日期，無誤後點擊右側按鈕批次導入。
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Global Date Modifier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <Calendar size={14} color="var(--accent-cyan)" />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>批次修改日期:</span>
                <input 
                  type="date" 
                  value={ocrResults.deliveryDate} 
                  onChange={(e) => handleGlobalDateChange(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <button className="btn btn-secondary" onClick={clearUploadedImage}>
                重新上傳
              </button>
              
              <button className="btn btn-primary" onClick={importToDatabase} style={{ background: 'linear-gradient(135deg, var(--accent-emerald), #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                <Database size={16} />
                導入 {ocrResults.items.length} 筆配送項目
              </button>
            </div>
          </div>

          {/* Grid Layout of calibration */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            
            {/* Sticky Uploaded Slip card preview on Left */}
            <div 
              style={{
                position: 'sticky',
                top: '24px',
                height: 'fit-content',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>上傳單據原始圖像預覽</span>
              <div 
                style={{ 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  border: '1px solid var(--card-border)',
                  background: '#090d16',
                  height: '240px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '8px'
                }}
              >
                {renderPreview()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                💡 貼心提醒：如果 AI 辨識漏掉了公寓樓層，或者商品名稱不全，您可以直接點擊右側的欄位編輯修正。
              </div>
            </div>

            {/* Editable Item List on Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>辨識結果明細 ({ocrResults.items.length} 筆地址)</span>
              
              {ocrResults.items.map((item, idx) => (
                <div 
                  key={idx}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    background: 'rgba(15, 22, 42, 0.4)',
                    border: '1px solid var(--card-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative'
                  }}
                >
                  {/* Sequence Badge and Delete row button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div 
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(6,182,212,0.15)',
                          color: 'var(--accent-cyan)',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {idx + 1}
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        來源管道: <strong>{item.channel}</strong> | 單號: {item.orderId}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleRemoveResultItem(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '4px',
                        borderRadius: '4px',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Inputs Fields Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} color="var(--accent-cyan)" /> 配送地址 (Google Maps 定位地址)
                      </span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.address} 
                        onChange={(e) => handleResultItemChange(idx, 'address', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={11} /> 收件人姓名
                      </span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.recipient} 
                        onChange={(e) => handleResultItemChange(idx, 'recipient', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={11} /> 聯絡電話
                      </span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.phone} 
                        onChange={(e) => handleResultItemChange(idx, 'phone', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={11} /> 配送商品名
                      </span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.items} 
                        onChange={(e) => handleResultItemChange(idx, 'items', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>服務/安裝類型</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.serviceType} 
                        onChange={(e) => handleResultItemChange(idx, 'serviceType', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>配送時段</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.deliveryTime} 
                        onChange={(e) => handleResultItemChange(idx, 'deliveryTime', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>客戶備註 / 注意事項</span>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={item.remarks} 
                        onChange={(e) => handleResultItemChange(idx, 'remarks', e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Global CSS animation spinner keyframe rule inject */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
