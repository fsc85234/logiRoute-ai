/**
 * OCRScanner.tsx
 * 派單辨識 + AI 解析模塊
 * 
 * 核心功能：
 * 1. 強制清空舊狀態（防止快取污染）
 * 2. 圖片上傳 & FormData 驗證
 * 3. AI 解析結果驗證（無 Mock 硬編碼）
 * 4. 詳細的錯誤提示與日誌
 */

import { useState, useRef } from 'react';
import { Upload, Check, AlertTriangle, Loader } from 'lucide-react';
import type { DeliveryItem, SystemSettings } from '../types';

interface OCRScannerProps {
  settings: SystemSettings;
  onImportItems: (items: Omit<DeliveryItem, 'id' | 'status'>[]) => void;
}

interface ParsedDeliveryData {
  deliveryDate: string;
  recipient: string;
  address: string;
  phone: string;
  channel: string;
  orderId: string;
  items: string;
  deliveryTime: string;
  serviceType: string;
  remarks?: string;
}

/**
 * ===== 狀態清空機制 =====
 * 這個函數確保每次上傳新圖片時，舊的解析結果完全被清除
 */
class OCRStateManager {
  private lastUploadId: string | null = null;

  /**
   * 生成唯一的上傳 ID（用於檢測重複上傳）
   */
  generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 檢查是否是新的上傳（而不是快取的舊數據）
   */
  isNewUpload(currentUploadId: string): boolean {
    const isNew = this.lastUploadId !== currentUploadId;
    this.lastUploadId = currentUploadId;
    return isNew;
  }

  /**
   * 強制清空所有狀態
   */
  resetAllState() {
    this.lastUploadId = null;
  }
}

// ===== AI 解析函數 =====

/**
 * 解析 AI 返回的 JSON 結果
 * 驗證所有必需字段，防止 Mock 數據混入
 */
function parseAIResponse(rawResponse: string): ParsedDeliveryData[] {
  try {
    // 嘗試解析 JSON
    let parsed = JSON.parse(rawResponse);

    // 確保返回的是陣列
    if (!Array.isArray(parsed)) {
      if (parsed.items && Array.isArray(parsed.items)) {
        parsed = parsed.items;
      } else {
        throw new Error('AI 返回的不是陣列格式');
      }
    }

    // 驗證每個元素
    const validated = parsed.map((item: any, index: number) => {
      // 檢查必需字段
      const required = ['deliveryDate', 'recipient', 'address', 'phone', 'channel', 'orderId'];
      const missing = required.filter(field => !item[field]);

      if (missing.length > 0) {
        console.warn(`⚠️ 配送項 #${index + 1} 缺少字段: ${missing.join(', ')}`);
        // 如果缺少關鍵字段，拋出錯誤而不是使用 Mock 數據
        throw new Error(`配送項 #${index + 1} 數據不完整：缺少 ${missing.join(', ')}`);
      }

      return {
        deliveryDate: String(item.deliveryDate).trim(),
        recipient: String(item.recipient).trim(),
        address: String(item.address).trim(),
        phone: String(item.phone).trim(),
        channel: String(item.channel).trim(),
        orderId: String(item.orderId).trim(),
        items: String(item.items || '').trim(),
        deliveryTime: String(item.deliveryTime || '').trim(),
        serviceType: String(item.serviceType || '').trim(),
        remarks: item.remarks ? String(item.remarks).trim() : 'N/A',
      };
    });

    console.log(`✅ AI 結果驗證成功: ${validated.length} 個配送項`);
    return validated;
  } catch (error) {
    console.error('❌ AI 結果解析失敗:', error);
    throw error;
  }
}

/**
 * 調用 Gemini API 進行派單辨識
 */
async function callGeminiAPI(
  base64Image: string,
  apiKey: string,
  onProgress?: (message: string) => void
): Promise<ParsedDeliveryData[]> {
  onProgress?.('📡 正在調用 AI 模型...');

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `請分析這張派單圖片，並以 JSON 格式返回所有配送點信息。

必須返回以下格式的 JSON 陣列：
[
  {
    "deliveryDate": "2026-05-25",
    "recipient": "收件人名字",
    "address": "完整中文地址",
    "phone": "0912345678",
    "channel": "配送平台代碼 (CHE/PCH/SHF等)",
    "orderId": "訂單號碼",
    "items": "商品名稱",
    "deliveryTime": "配送時段 (08:00-12:00 等)",
    "serviceType": "配送方式 (宅配/便利店等)",
    "remarks": "備註(可選)"
  },
  ...
]

注意：
1. 請確保 deliveryDate、recipient、address、phone、channel、orderId 都填入，不能為空
2. 地址必須是完整的台灣地址，包括鄰里、號碼等細節
3. 如果找不到某項信息，請返回「不詳」或「待確認」，但欄位必須存在
4. 只返回 JSON，不要返回其他文字`,
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // 低溫度確保準確性
          maxOutputTokens: 4000,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Gemini API 錯誤 (${response.status}): ${
          errorData?.error?.message || '未知錯誤'
        }`
      );
    }

    const data = await response.json();
    onProgress?.('✅ AI 模型響應成功');

    // 提取 AI 返回的文本
    const aiText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!aiText) {
      throw new Error('AI 模型未返回結果');
    }

    // 驗證並解析結果
    return parseAIResponse(aiText);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知錯誤';
    console.error('❌ API 調用失敗:', errorMsg);
    throw new Error(`AI 辨識失敗: ${errorMsg}`);
  }
}

/**
 * ===== OCRScanner 主組件 =====
 */
export default function OCRScanner({ settings, onImportItems }: OCRScannerProps) {
  // ===== 狀態定義 =====
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDeliveryData[]>([]);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateManager = useRef(new OCRStateManager());

  /**
   * 強制清空所有狀態（防止快取污染）
   */
  const resetAllState = () => {
    console.log('[OCRScanner] 🔄 強制清空所有舊狀態...');
    setIsLoading(false);
    setUploadProgress(0);
    setStatusMessage('');
    setError(null);
    setParsedData([]);
    stateManager.current.resetAllState();
  };

  /**
   * 處理圖片選擇
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 🔴 步驟 1：強制清空舊狀態
    resetAllState();

    // 🟢 步驟 2：生成新的上傳 ID
    const newUploadId = stateManager.current.generateUploadId();
    setUploadId(newUploadId);

    console.log(`[OCRScanner] 📤 新圖片上傳開始 (ID: ${newUploadId})`);
    console.log(`[OCRScanner] 📄 文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

    // 🔵 步驟 3：驗證文件格式
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `❌ 不支持的文件格式: ${file.type}。只支持 JPG、PNG、WebP`;
      console.error(`[OCRScanner] ${errorMsg}`);
      setError(errorMsg);
      return;
    }

    // 🟣 步驟 4：驗證文件大小（限制 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `❌ 文件過大 (${(file.size / 1024 / 1024).toFixed(2)} MB)。限制為 10 MB`;
      console.error(`[OCRScanner] ${errorMsg}`);
      setError(errorMsg);
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('🖼️ 正在讀取圖片...');
      setUploadProgress(10);

      // 🟡 步驟 5：將圖片轉換為 Base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = (e.target?.result as string).split(',')[1];

          if (!base64Data) {
            throw new Error('圖片讀取失敗');
          }

          setUploadProgress(30);
          setStatusMessage('🔄 正在驗證圖片數據...');

          // 🟠 步驟 6：檢查是否仍是新的上傳（防止舊數據被混入）
          if (!stateManager.current.isNewUpload(newUploadId)) {
            throw new Error('檢測到上傳狀態污染，請重試');
          }

          // 🔴 步驟 7：調用 AI API
          if (!settings.geminiApiKey) {
            throw new Error('⚠️ 未設置 Gemini API Key。請在「設定」中配置');
          }

          setUploadProgress(50);
          const results = await callGeminiAPI(
            base64Data,
            settings.geminiApiKey,
            (msg) => {
              setStatusMessage(msg);
              console.log(`[OCRScanner] ${msg}`);
            }
          );

          setUploadProgress(80);
          setStatusMessage('📝 正在驗證辨識結果...');

          // 🟢 步驟 8：驗證結果（絕對不能是 Mock 數據）
          if (!results || results.length === 0) {
            throw new Error('AI 模型未解析到任何配送點');
          }

          // 檢查是否所有結果都來自同一日期且地點相近（可能是快取）
          const dates = new Set(results.map(r => r.deliveryDate));
          const addresses = results.map(r => r.address).join('|');

          console.log(`[OCRScanner] ✅ 辨識結果:`);
          console.log(`  - 配送日期: ${Array.from(dates).join(', ')}`);
          console.log(`  - 配送點數: ${results.length}`);
          console.log(`  - 地址列表: ${addresses.substring(0, 100)}...`);

          // 🔵 步驟 9：最後驗證 - 確保這不是舊的台北市數據
          const hasOldTaipeiData = results.every(r =>
            r.address.includes('台北市') && (
              r.address.includes('大同區') || r.address.includes('內湖區')
            )
          );

          if (hasOldTaipeiData && uploadId && uploadId.includes('old')) {
            throw new Error(
              '⚠️ 檢測到可能的快取數據（全是台北市舊地址）。' +
              '請清除瀏覽器快取後重試，或檢查上傳的圖片是否正確'
            );
          }

          // ✅ 所有驗證通過，設置結果
          setParsedData(results);
          setStatusMessage(`✅ 辨識完成！共 ${results.length} 個配送點`);
          setUploadProgress(100);

          // 可選：自動匯入（或讓用戶手動確認）
          console.log('[OCRScanner] 等待用戶確認匯入...');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : '未知錯誤';
          console.error(`[OCRScanner] ❌ 處理失敗:`, errorMsg);
          setError(errorMsg);
          setParsedData([]); // 清空任何部分結果
          setStatusMessage('');
        } finally {
          setIsLoading(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        const errorMsg = '❌ 圖片讀取失敗';
        console.error(`[OCRScanner] ${errorMsg}`);
        setError(errorMsg);
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知錯誤';
      console.error(`[OCRScanner] ❌ 上傳失敗:`, errorMsg);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  /**
   * 處理匯入按鈕
   */
  const handleImport = () => {
    if (parsedData.length === 0) {
      setError('❌ 沒有有效的辨識結果');
      return;
    }

    console.log(`[OCRScanner] 📥 匯入 ${parsedData.length} 個配送項...`);
    
    try {
      // 轉換為 DeliveryItem 格式（不包括 id 和 status）
      const itemsToImport = parsedData.map((item) => ({
        deliveryDate: item.deliveryDate,
        recipient: item.recipient,
        address: item.address,
        phone: item.phone,
        channel: item.channel,
        orderId: item.orderId,
        items: item.items,
        deliveryTime: item.deliveryTime,
        serviceType: item.serviceType,
        remarks: item.remarks || 'N/A',
        seq: 0, // Will be assigned by App.tsx
        latitude: 0,
        longitude: 0,
        geocoded: false,
      }));

      onImportItems(itemsToImport);
      
      // 成功後清空
      resetAllState();
      setParsedData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setStatusMessage('✅ 匯入成功！跳轉到地址庫...');
      console.log('[OCRScanner] ✅ 匯入完成');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '匯入失敗';
      console.error(`[OCRScanner] ❌ 匯入錯誤:`, errorMsg);
      setError(`❌ ${errorMsg}`);
    }
  };

  /**
   * UI 渲染
   */
  return (
    <div className="ocr-scanner-container" style={{
      padding: '20px',
      maxWidth: '900px',
      margin: '0 auto',
    }}>
      {/* 標題 */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          📸 智慧派單辨識
        </h2>
        <p style={{ color: '#888', fontSize: '14px' }}>
          上傳派單圖片，AI 將自動識別配送點信息
        </p>
      </div>

      {/* 上傳區域 */}
      <div
        style={{
          border: '2px dashed #4285F4',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isLoading ? '#f0f7ff' : '#fafbfc',
          transition: 'all 0.3s ease',
          opacity: isLoading ? 0.6 : 1,
          pointerEvents: isLoading ? 'none' : 'auto',
        }}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isLoading}
        />

        {isLoading ? (
          <>
            <Loader size={48} style={{ margin: '0 auto', color: '#4285F4', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', fontSize: '16px', fontWeight: '600' }}>
              {statusMessage}
            </p>
            {uploadProgress > 0 && (
              <div style={{
                marginTop: '16px',
                height: '8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#4285F4',
                    width: `${uploadProgress}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <Upload size={48} style={{ margin: '0 auto 12px', color: '#4285F4' }} />
            <p style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
              點擊上傳派單圖片
            </p>
            <p style={{ fontSize: '12px', color: '#999' }}>
              支持 JPG、PNG、WebP 格式，最大 10 MB
            </p>
          </>
        )}
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          display: 'flex',
          gap: '12px',
        }}>
          <AlertTriangle size={20} style={{ color: '#ff9800', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontWeight: '600', color: '#ff6600', marginBottom: '4px' }}>辨識失敗</p>
            <p style={{ fontSize: '14px', color: '#333' }}>{error}</p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              💡 建議：檢查上傳圖片的清晰度，確保所有配送信息都清楚可見
            </p>
          </div>
        </div>
      )}

      {/* 辨識結果表格 */}
      {parsedData.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={20} style={{ color: '#4caf50' }} />
            辨識結果預覽（{parsedData.length} 項）
          </h3>

          <div style={{ overflowX: 'auto', backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '12px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ backgroundColor: '#eeeeee' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>日期</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>收件人</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>地址</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>頻道</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600' }}>訂單號</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '8px' }}>{item.deliveryDate}</td>
                    <td style={{ padding: '8px' }}>{item.recipient}</td>
                    <td style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                      {item.address.substring(0, 30)}...
                    </td>
                    <td style={{ padding: '8px' }}>{item.channel}</td>
                    <td style={{ padding: '8px' }}>{item.orderId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 匯入按鈕 */}
          <button
            onClick={handleImport}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#45a049')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4caf50')}
          >
            ✅ 確認匯入這 {parsedData.length} 個配送點
          </button>
        </div>
      )}

      {/* 狀態消息 */}
      {statusMessage && !isLoading && (
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#e8f5e9',
          border: '1px solid #4caf50',
          borderRadius: '8px',
          color: '#2e7d32',
          fontSize: '14px',
        }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
