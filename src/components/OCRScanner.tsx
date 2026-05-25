import React, { useState } from 'react';

interface OCRScannerProps {
  onImportItems: (items: any[]) => void;
  settings?: any;
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
      // 🎯 【請在這裡填寫金鑰】直接把密碼貼在雙引號內，不要留空白
      const apiKey = "AIzaSyDcKMxa6QQCDKiC0BSvQrVmpPEvvoOzgz4";

      if (!apiKey || apiKey.includes('請把這裡換成')) {
        throw new Error('⚠️ 尚未填寫金鑰：請在程式碼中填入真實的 API Key！');
      }

      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
      });

      // 使用最標準的字串相加，絕對不會踩到引號陷阱
      const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "你是一個專業的物流單據解析系統。請解析這張派單圖片，提取出所有的配送點資訊。請回傳一個純 JSON 陣列（Array），每個物件必須包含以下字串欄位：deliveryDate, recipient, address, phone, channel, orderId, items, deliveryTime, serviceType, remarks。以及數字欄位：seq。不要輸出任何 Markdown 標記或額外文字。" },
              { inline_data: { mime_type: file.type, data: base64Image } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      // 🚨 如果又失敗，這次會把 Google 拒絕的「真實原因」印在畫面上
      if (!response.ok) {
        const errDetails = await response.text();
        console.error("Google API 拒絕原因:", errDetails);
        throw new Error(`API 請求失敗 (狀態碼: ${response.status})。請按 F12 查看主控台紅字原因。`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('AI 回傳的資料格式異常');

      const parsedItems = JSON.parse(rawText);

      const formattedItems = parsedItems.map((item: any, index: number) => ({
        deliveryDate: item.deliveryDate || "",
        recipient: item.recipient || "",
        address: item.address || "",
        phone: item.phone || "",
        channel: item.channel || "",
        orderId: item.orderId || "",
        items: item.items || "",
        sku: item.sku || item.items || item.productName || "一般包裹", 
        deliveryTime: item.deliveryTime || "",
        serviceType: item.serviceType || "",
        remarks: item.remarks || "",
        seq: item.seq || index + 1,
        geocoded: false
      }));

      onImportItems(formattedItems);

    } catch (error: any) {
      console.error('OCR 處理錯誤:', error);
      setErrorMsg(error.message || '圖片辨識過程中發生未知錯誤');
    } finally {
      setIsLoading(false);
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
        {isLoading ? '⏳ AI 正在拼命辨識中...' : '📤 點我上傳最新派單圖片'}
        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>
    </div>
  );
};