import React, { useState } from 'react';

interface OCRScannerProps {
  onImportItems: (items: any[]) => void;
  settings?: any;
}

export const OCRScanner: React.FC<OCRScannerProps> = ({ onImportItems, settings }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 🛡️ 動態安全抓取金鑰
      let apiKey = '';
      if (settings) apiKey = settings.apiKey || settings.geminiApiKey || '';
      if (!apiKey) {
        try {
          const localSettings = JSON.parse(localStorage.getItem('settings') || '{}');
          apiKey = localSettings.apiKey || localSettings.geminiApiKey || '';
        } catch(err) {}
      }
      if (!apiKey) apiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('geminiApiKey') || localStorage.getItem('apiKey') || '';

      if (!apiKey) {
        throw new Error('⚠️ 辨識失敗：未設置 Gemini API Key。請先在「設定」頁面中填寫金鑰。');
      }

      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
      });

      const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

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

      if (!response.ok) {
        const errDetails = await response.text();
        console.error("API 錯誤細節:", errDetails);
        throw new Error(`API 請求失敗 (狀態碼: ${response.status})。`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('AI 回傳資料異常');

      const parsedItems = JSON.parse(rawText);

// 🚀 1. 映射資料並自動【切除樓層與干擾字眼】
      const formattedItems = parsedItems.map((item: any, index: number) => {
        let cleanAddress = item.address || "";
        
        // 1. 切除樓層 (只保留從開頭到「號」為止的字串)
        if (cleanAddress.includes("號")) {
          cleanAddress = cleanAddress.substring(0, cleanAddress.indexOf("號") + 1);
        }
        
        // 2. 🧹 移除會讓 OSM 地圖引擎錯亂的「村、里、鄰」
        // 這會把 "錦山里" 變成 "錦山"，"21鄰" 直接刪掉
        cleanAddress = cleanAddress.replace(/村/g, '').replace(/里/g, '').replace(/\d+鄰/g, '');

        return {
          deliveryDate: item.deliveryDate || "",
          recipient: item.recipient || "",
          address: cleanAddress, // 使用雙重過濾後的乾淨地址
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
        };
      });
      // 🚀 2. 地址去重與合併濾網 (同址多單合併)
      const uniqueItems = formattedItems.reduce((acc: any[], current: any) => {
        const existing = acc.find(item => item.address === current.address);

        if (existing) {
          existing.items = `${existing.items} + ${current.items}`;
          existing.sku = `${existing.sku} + ${current.sku}`;
          if (current.orderId) existing.orderId = `${existing.orderId}, ${current.orderId}`;
          if (current.remarks) existing.remarks = `${existing.remarks} | ${current.remarks}`;
        } else {
          acc.push({ ...current });
        }
        return acc;
      }, []);

      onImportItems(uniqueItems);

    } catch (error: any) {
      setErrorMsg(error.message || '辨識過程中發生錯誤');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
      <h3 className="text-xl font-bold text-white mb-2">📷 智慧派單辨識 (Gemini AI)</h3>
      <p className="text-slate-400 text-sm mb-6">上傳任何全新的派單圖片，AI 將為您自動解析所有配送點</p>
      {errorMsg && <div className="mb-4 p-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm text-left">{errorMsg}</div>}
      <label className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg cursor-pointer transition-all shadow-lg shadow-indigo-500/20">
        {isLoading ? '⏳ AI 正在拼命辨識中...' : '📤 點我上傳最新派單圖片'}
        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
      </label>
    </div>
  );
};