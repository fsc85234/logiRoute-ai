import React, { useState } from 'react';

interface OCRScannerProps {
  onImportItems: (items: any[]) => void;
  settings?: any;  // 加了這個問號，代表「不管有沒有收到 settings 都沒關係，我都收下」
}

export const OCRScanner: React.FC<OCRScannerProps> = ({ onImportItems }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. 從瀏覽器暫存抓取你在「設定」填寫的 API Key
      // (涵蓋三種常見命名，確保一定抓得到)
     const apiKey = 'AIzaSyDcKMxa6QQCDKiC0BSvQrVmpPEvvoOzgz4'; // 請把這裡換成你複製的完整金鑰
      
      if (!apiKey) {
        throw new Error('⚠️ 辨識失敗：未設置 Gemini API Key。請先在「設定」頁面中填寫金鑰。');
      }

      // 2. 將圖片轉換為 Base64 格式
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // 拔掉前綴，只留純 base64
        };
        reader.onerror = (error) => reject(error);
      });

      // 3. 呼叫 Gemini 1.5 Flash 視覺模型進行智慧解析
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "你是一個專業的物流單據解析系統。請解析這張派單圖片，提取出所有的配送點資訊。請回傳一個純 JSON 陣列（Array），每個物件必須包含以下字串欄位：deliveryDate, recipient, address, phone, channel, orderId, items, deliveryTime, serviceType, remarks。以及數字欄位：seq。不要輸出任何 Markdown 標記或額外文字。" },
              { inline_data: { mime_type: file.type, data: base64Image } }
            ]
          }],
          // 強制要求 AI 輸出乾淨的 JSON 格式
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (!response.ok) {
        throw new Error('API 請求失敗，請檢查 API Key 是否正確，或是網路連線狀態。');
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error('AI 回傳的資料格式異常');

      const parsedItems = JSON.parse(rawText);

      // 4. 【最關鍵的修復】：映射資料並強制補上 sku 欄位，徹底解決 TS2345 錯誤
      const formattedItems = parsedItems.map((item: any, index: number) => ({
        deliveryDate: item.deliveryDate || "",
        recipient: item.recipient || "",
        address: item.address || "",
        phone: item.phone || "",
        channel: item.channel || "",
        orderId: item.orderId || "",
        items: item.items || "",
        // 解決報錯的核心：確保 sku 必定存在！
        sku: item.sku || item.items || item.productName || "一般包裹", 
        deliveryTime: item.deliveryTime || "",
        serviceType: item.serviceType || "",
        remarks: item.remarks || "",
        seq: item.seq || index + 1,
        geocoded: false
      }));

      // 將資料傳遞給主系統
      onImportItems(formattedItems);

    } catch (error: any) {
      console.error('OCR 處理錯誤:', error);
      setErrorMsg(error.message || '圖片辨識過程中發生未知錯誤');
    } finally {
      setIsLoading(false);
      // 清空 input 讓同一張圖可以重複上傳
      e.target.value = ''; 
    }
  };

  return (
    <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
      <h3 className="text-xl font-bold text-white mb-2">📷 智慧派單辨識 (Gemini AI)</h3>
      <p className="text-slate-400 text-sm mb-6">上傳任何全新的派單圖片，AI 將為您自動解析所有配送點</p>
      
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm text-left">
          {errorMsg}
        </div>
      )}

      <label className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg cursor-pointer transition-all shadow-lg shadow-indigo-500/20">
        {isLoading ? '⏳ AI 正在拼命辨識中 (約需 5~10 秒)...' : '📤 點我上傳最新派單圖片'}
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileUpload} 
          disabled={isLoading}
        />
      </label>
    </div>
  );
};